import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { employeeIds, kipId } = body;

    // 1. Kiểm tra đầu vào
    if (
      !employeeIds ||
      !Array.isArray(employeeIds) ||
      employeeIds.length === 0
    ) {
      return NextResponse.json(
        { error: "Danh sách nhân viên không hợp lệ" },
        { status: 400 }
      );
    }

    // 2. ÉP KIỂU AN TOÀN (Quan trọng nhất)
    // Chuyển đổi mảng ["1", "5"] thành [1, 5] để Prisma hiểu
    const idsAsNumbers = employeeIds.map((id: any) => Number(id));

    // Xử lý KipID:
    // - Nếu có giá trị (ví dụ 5) -> chuyển thành số 5
    // - Nếu là null/undefined/0 -> chuyển thành null (để gỡ Kíp)
    const finalKipId = kipId && Number(kipId) > 0 ? Number(kipId) : null;

    console.log("Đang cập nhật:", { ids: idsAsNumbers, kip: finalKipId }); // Log để soi nếu còn lỗi

    // 3. Thực hiện Update
    const result = await prisma.employee.updateMany({
      where: {
        id: { in: idsAsNumbers }, // Prisma bắt buộc phải nhận mảng số nguyên ở đây
      },
      data: {
        kipId: finalKipId,
      },
    });

    return NextResponse.json({
      message: "Thành công",
      count: result.count,
    });
  } catch (error: any) {
    // In lỗi chi tiết ra Terminal của VS Code để bạn đọc được
    console.error("❌ Lỗi Bulk Update:", error);

    return NextResponse.json(
      { error: "Lỗi server: " + (error.message || "") },
      { status: 500 }
    );
  }
}
