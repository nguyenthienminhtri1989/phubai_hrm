// src/app/api/users/[id]/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
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
    // [MỚI] Lấy thêm employeeCode và userDepartmentId từ body gửi lên
    const {
      password,
      fullName,
      role,
      departmentIds,
      employeeCode,
      userDepartmentId,
    } = body;

    // Khởi tạo object dữ liệu cần update
    const updateData: any = {
      fullName,
      role,
      // [MỚI] Cập nhật Mã NV (nếu rỗng thì set null)
      employeeCode: employeeCode || null,
      // [MỚI] Cập nhật Phòng trực thuộc (nếu có giá trị thì ép kiểu số, không thì null)
      userDepartmentId: userDepartmentId ? Number(userDepartmentId) : null,
    };

    // 1. Logic cập nhật mật khẩu (Admin Reset)
    // Chỉ hash và update nếu Admin có nhập gì đó vào ô mật khẩu
    if (password && password.trim() !== "") {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // 2. Logic cập nhật phòng ban PHỤ TRÁCH (managedDepartments)
    if (Array.isArray(departmentIds)) {
      // Trường hợp có gửi danh sách phòng ban lên (dù là rỗng [])
      updateData.managedDepartments = {
        // Ép kiểu về Number để tránh lỗi Prisma
        set: departmentIds.map((deptId: any) => ({ id: Number(deptId) })),
      };
    } else {
      // Trường hợp không gửi departmentIds lên (ví dụ chỉ sửa tên/mã NV)
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

// Bổ sung thêm hàm DELETE (nếu file cũ của bạn chưa có hoặc bạn muốn xóa User chuẩn)
export async function DELETE(request: Request, props: Props) {
  try {
    const params = await props.params;
    const id = parseInt(params.id);

    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    }

    // Kiểm tra xem có xóa chính mình không
    // (Tùy chọn: dùng session.user.id để so sánh nếu muốn chặn)

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Đã xóa user thành công" });
  } catch (error: any) {
    return NextResponse.json({ error: "Lỗi xóa user" }, { status: 500 });
  }
}
