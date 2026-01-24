// src/app/api/users/[id]/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth"; // Hoặc đường dẫn auth của bạn
import bcrypt from "bcryptjs";

interface Props {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, props: Props) {
  try {
    // --- QUAN TRỌNG: Phải await params ở đây nữa (Next.js 15) ---
    const params = await props.params;
    const id = parseInt(params.id);

    if (isNaN(id))
      return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });

    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    }

    const body = await request.json();
    const { password, fullName, role, departmentIds } = body;

    const updateData: any = {
      fullName,
      role,
    };

    // 1. Logic cập nhật mật khẩu (Admin Reset)
    // Chỉ hash và update nếu Admin có nhập gì đó vào ô mật khẩu
    if (password && password.trim() !== "") {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // 2. Logic cập nhật phòng ban [ĐÃ SỬA ĐỔI CHO STAFF]
    if (Array.isArray(departmentIds)) {
      // Trường hợp có gửi danh sách phòng ban lên (dù là rỗng [])
      updateData.managedDepartments = {
        // Ép kiểu về Number để tránh lỗi Prisma
        set: departmentIds.map((deptId: any) => ({ id: Number(deptId) })),
      };
    } else {
      // Trường hợp không gửi departmentIds lên (ví dụ chỉ sửa tên)
      // Ta kiểm tra: Nếu Role mới không cần phòng ban -> Xóa sạch liên kết cũ cho sạch DB
      // Các role cần phòng ban là: TIMEKEEPER và STAFF
      if (role !== "TIMEKEEPER" && role !== "STAFF") {
        updateData.managedDepartments = { set: [] };
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      message: "Cập nhật thành công",
      user: updatedUser,
    });
  } catch (error: any) {
    console.error("LỖI SỬA:", error);
    return NextResponse.json(
      { error: "Lỗi cập nhật: " + error.message },
      { status: 500 }
    );
  }
}