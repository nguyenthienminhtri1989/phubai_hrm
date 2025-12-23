// src/app/api/users/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { auth } from "@/auth"; // Để kiểm tra quyền Admin

export async function GET(request: Request) {
  try {
    // 1. Kiểm tra quyền (Chỉ Admin mới được xem danh sách)
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Không có quyền truy cập" },
        { status: 403 }
      );
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        managedDepartments: true, // Lấy danh sách phòng ban họ quản lý
      },
    });

    // Loại bỏ password trước khi trả về client để bảo mật
    const safeUsers = users.map((u) => {
      const { password, ...rest } = u;
      return rest;
    });

    return NextResponse.json(safeUsers);
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // 1. Kiểm tra quyền Admin
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Không có quyền truy cập" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { username, password, fullName, role, departmentIds } = body;

    // 2. Validate cơ bản
    if (!username || !password || !role) {
      return NextResponse.json(
        { error: "Thiếu thông tin bắt buộc" },
        { status: 400 }
      );
    }

    // 3. Kiểm tra trùng username
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Tên đăng nhập đã tồn tại" },
        { status: 400 }
      );
    }

    // 4. Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Tạo user và liên kết phòng ban (nếu có)
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        fullName,
        role,
        // Logic connect Many-to-Many
        managedDepartments:
          departmentIds && departmentIds.length > 0
            ? {
                connect: departmentIds.map((id: number) => ({ id })),
              }
            : undefined,
      },
    });

    return NextResponse.json({
      message: "Tạo tài khoản thành công",
      user: newUser,
    });
  } catch (error) {
    console.error("Lỗi tạo user:", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
