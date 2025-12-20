import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// --- CẬP NHẬT ---
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Loại bỏ id khỏi body để tránh lỗi update id
    const { id: _, ...dataToUpdate } = body;

    const updated = await prisma.attendanceCode.update({
      where: { id: parseInt(id) },
      data: dataToUpdate,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi cập nhật: " + error },
      { status: 500 }
    );
  }
}

// --- Xóa ---
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Kiểm tra xem mã này đã được dùng chấm công chưa? Nếu dùng rồi thì không cho xóa
    const count = await prisma.timesheet.count({
      where: { attendanceCodeId: parseInt(id) },
    });

    if (count > 0) {
      return NextResponse.json(
        { error: "Không thể xóa vì đã có dữ liệu chấm công sử dụng mã này!" },
        { status: 400 }
      );
    }

    await prisma.attendanceCode.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: "Đã xóa" });
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi khi xóa: " + error },
      { status: 500 }
    );
  }
}
