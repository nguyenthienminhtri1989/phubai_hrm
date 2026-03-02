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
    // Gọi await params
    const { id } = await params;
    const employeeId = parseInt(id);

    const body = await request.json(); // Chuyển gói hàng JSON từ client gửi lên thành Object
    const {
      code,
      fullName,
      birthday,
      gender,
      address,
      phone,
      position,
      departmentId,
      kipId,
      startDate,
      idCardNumber,
      idCardDate,
      idCardPlace,
      bankAccount,
      taxCode,
    } = body; // Lấy những thứ cần thiết từ cục hàng body ra để dùng (cập nhật)

    // FIX: Xử lý ngày sinh an toàn hơn
    // Nếu birthday hợp lệ thì new Date, nếu không thì undefined
    const formatBirthday = birthday ? new Date(birthday) : undefined;
    const formatStartDate = startDate ? new Date(startDate) : null; // [MỚI]
    const formatIdCardDate = idCardDate ? new Date(idCardDate) : null; // [MỚI]

    // Cập nhật vào cơ sở dữ liệu
    const updatedEmployee = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        code: code,
        fullName: fullName,
        birthday: formatBirthday,
        gender: gender,
        address: address,
        phone: phone,
        position: position,
        // FIX: Thêm kiểm tra departmentId trước khi parse để tránh NaN nếu lỡ null
        departmentId: departmentId ? parseInt(departmentId) : undefined,
        kipId: kipId ? Number(kipId) : null,
        startDate: formatStartDate,
        idCardNumber,
        idCardDate: formatIdCardDate,
        idCardPlace,
        bankAccount,
        taxCode,
      },
    });

    return NextResponse.json(updatedEmployee);
  } catch (error) {
    console.log(error); // In lỗi ra terminal server để xem chi tiết
    return NextResponse.json({ error: "Lỗi khi cập nhật, " }, { status: 500 });
  }
}
