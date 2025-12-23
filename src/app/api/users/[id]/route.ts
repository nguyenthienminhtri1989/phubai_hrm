// src/app/api/users/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";

// Định nghĩa kiểu cho params (Bắt buộc với Next.js 15)
type Props = {
  params: Promise<{ id: string }>;
};

// 1. HÀM XÓA USER (DELETE)
export async function DELETE(request: Request, props: Props) {
  try {
    // --- QUAN TRỌNG: Phải await params trước ---
    const params = await props.params;
    const id = parseInt(params.id);

    if (isNaN(id))
      return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });

    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    }

    if (session.user.id === id.toString()) {
      return NextResponse.json(
        { error: "Không thể tự xóa tài khoản đang đăng nhập" },
        { status: 400 }
      );
    }

    // Kiểm tra và gỡ kết nối phòng ban trước khi xóa
    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: { managedDepartments: true },
    });

    if (!existingUser)
      return NextResponse.json(
        { error: "User không tồn tại" },
        { status: 404 }
      );

    if (existingUser.managedDepartments.length > 0) {
      await prisma.user.update({
        where: { id },
        data: { managedDepartments: { set: [] } },
      });
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ message: "Đã xóa thành công" });
  } catch (error: any) {
    console.error("LỖI XÓA:", error);
    return NextResponse.json(
      { error: "Lỗi server: " + error.message },
      { status: 500 }
    );
  }
}

// 2. HÀM SỬA USER (PUT)
export async function PUT(request: Request, props: Props) {
  try {
    // --- QUAN TRỌNG: Phải await params ở đây nữa ---
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

    // Logic cập nhật mật khẩu
    if (password && password.trim() !== "") {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Logic cập nhật phòng ban (Xử lý kỹ kiểu dữ liệu Number)
    if (Array.isArray(departmentIds)) {
      updateData.managedDepartments = {
        // Ép kiểu về Number để tránh lỗi Prisma
        set: departmentIds.map((deptId: any) => ({ id: Number(deptId) })),
      };
    } else {
      // Nếu đổi sang vai trò khác (không phải Timekeeper), tự động xóa quyền chấm công cũ
      if (role !== "TIMEKEEPER") {
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
