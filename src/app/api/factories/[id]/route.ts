// src/app/api/factories/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { message } from "antd";

// Hàm lấy ID từ URL (Ví dụ: /api/factories/1 -> id = 1)
// params chính là object chứa { id : '1' }
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    // Xóa trong database
    await prisma.factory.delete({
      where: { id: id },
    });

    return NextResponse.json({ message: "Xóa thành công!" });
  } catch (error) {
    // Lỗi thường gặp, không xóa được vì nhà máy này đang chứa phòng ban (Ràng buộc khóa ngoại)
    return NextResponse.json(
      {
        error:
          "Không thể xóa (Có thể do nhà máy này đang có phòng ban: " + error,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id); // Đổi chuỗi thành số
    const body = await request.json();
    const { code, name } = body;

    // Cập nhật dữ liệu
    const updatedFactory = await prisma.factory.update({
      where: { id: id },
      data: {
        code: code,
        name: name,
      },
    });

    return NextResponse.json(updatedFactory); // Trả về dữ liệu mới thêm để trình duyệt hiển thị
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi khi cập nhật: " + error },
      { status: 500 }
    );
  }
}
