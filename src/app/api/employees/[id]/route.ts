import { error } from "node:console";
// src/app/api/employees/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Hàm lấy ID từ URL (Ví dụ: /api/employees/1 -> id = 1)
// params chính là object chứa { id : '1' }

// --- API XÓA THÔNG TIN NHÂN VIÊN ---
export async function DELETE(
  request: Request,
  // params phải là promise
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Bước đầu tiên, await params trước
    const { id } = await params;
    const employeeId = parseInt(id);

    // [SỬA ĐỔI TẠI ĐÂY] Dùng update để chuyển trạng thái thành Nghỉ việc (isActive = false)
    await prisma.employee.update({
      where: { id: employeeId },
      data: { isActive: false },
    });

    // Xóa xong thì tạo chuỗi JSON báo về client
    return NextResponse.json({
      message: "Đã chuyển nhân viên sang trạng thái Nghỉ việc!",
    });
  } catch (error) {
    console.log("Lỗi khi xóa mềm nhân viên: ", error);
    return NextResponse.json(
      { error: "Lỗi khi xóa: " + error },
      { status: 500 },
    );
  }
}

// --- API CẬP NHẬT THÔNG TIN NHÂN VIÊN ---
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const employeeId = parseInt(id);
    const body = await request.json();

    // 1. Lấy tất cả các dữ liệu gửi lên từ form (Bổ sung isActive)
    const {
      code,
      fullName,
      departmentId,
      kipId,
      position,
      startDate,
      phone,
      gender,
      birthday,
      address,
      idCardNumber,
      idCardDate,
      idCardPlace,
      bankAccount,
      taxCode,
      isActive, // <-- [QUAN TRỌNG TẠI ĐÂY]
    } = body;

    // 2. Cập nhật vào Database
    const updatedEmployee = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        code,
        fullName,
        position,
        phone,
        gender,
        address,
        idCardNumber,
        idCardPlace,
        bankAccount,
        taxCode,

        // [SỬA LỖI Ở ĐÂY] Thay null thành undefined cho trường bắt buộc
        departmentId: departmentId ? Number(departmentId) : undefined,

        // kipId có thể rỗng (tùy chọn) nên nếu schema của bạn cho phép rỗng (Int?), để null là đúng
        kipId: kipId ? Number(kipId) : null,

        birthday: birthday ? new Date(birthday) : null,
        startDate: startDate ? new Date(startDate) : null,
        idCardDate: idCardDate ? new Date(idCardDate) : null,

        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json({
      message: "Cập nhật thành công!",
      data: updatedEmployee,
    });
  } catch (error) {
    console.error("Lỗi cập nhật nhân viên:", error);
    return NextResponse.json(
      { error: "Lỗi server khi cập nhật" },
      { status: 500 },
    );
  }
}
