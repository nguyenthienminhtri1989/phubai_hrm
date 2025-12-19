// src/app/api/departments/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { message } from "antd";

// Hàm lấy ID từ URL (Ví dụ: /api/departments/1 -> id = 1)
// params chính là object chứa { id : '1' }

// --- API XÓA PHÒNG BAN ---
export async function DELETE(
  request: Request,
  // Sửa kiểu dữ liệu: params là Promise
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // BƯỚC QUAN TRỌNG: Phải await params trước
    const { id } = await params;
    const departmentId = parseInt(id);

    // Xóa trong database
    await prisma.department.delete({
      where: { id: departmentId },
    });

    return NextResponse.json({ message: "Xóa thành công!" });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Không thể xóa (Có thể do phòng ban này đang có nhân viên)," + error,
      },
      { status: 500 }
    );
  }
}

// --- API CẬP NHẬT PHÒNG BAN ---
export async function PATCH(
  request: Request,
  // Sửa kiểu dữ liệu: params là Promise
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // BƯỚC QUAN TRỌNG: Phải await params trước khi dùng
    const { id } = await params;
    const departmentId = parseInt(id);

    const body = await request.json(); // Chuyển gói hàng JSON từ client gửi lên thành Object
    const { code, name, factoryId } = body;

    // Cập nhật dữ liệu
    const updatedDepartment = await prisma.department.update({
      where: { id: departmentId },
      data: {
        code: code,
        name: name,
        factoryId: parseInt(factoryId),
      },
    });

    return NextResponse.json(updatedDepartment);
  } catch (error) {
    console.log(error); // In lỗi ra terminal server để xem chi tiết
    return NextResponse.json({ error: "Lỗi khi cập nhật, " }, { status: 500 });
  }
}
