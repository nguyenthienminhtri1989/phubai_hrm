// src/app/api/employees/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 1. Hàm GET, dùng để lấy danh sách nhân viên
export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: {
        id: "desc", // Người mới thêm hiện lên đầu
      },
      // Kỹ thuật lồng ghép dữ liệu (Nested Include)
      include: {
        department: {
          include: {
            factory: true, // Lấy luôn thông tin nhà máy của phòng ban đó
          },
        },
        kip: true, // Để hiển thị kíp ra bảng
      },
    });

    // Trả danh sách nhân viên về cho trình duyệt (Chuỗi JSON)
    return NextResponse.json(employees);
  } catch (error) {
    NextResponse.json(
      { error: "Lỗi khi lấy danh sách nhân viên: " + error },
      { status: 500 }
    );
  }
}

// 2. Hàm POST: Thêm nhân viên mới
export async function POST(request: Request) {
  try {
    // Chuyển dữ liệu JSON gửi lên từ giao diện rồi gán cho biến body
    const body = await request.json();
    // Lấy các trường dữ liệu từ body
    const {
      code,
      fullName,
      birthday,
      gender,
      address,
      phone,
      position,
      departmentId, // bắt buộc
      kipId,
      startDate, 
      idCardNumber, 
      idCardDate, 
      idCardPlace, 
      bankAccount, 
      taxCode
    } = body;

    // Kiểm tra dữ liệu bắt buộc
    if (!code || !fullName || !departmentId) {
      return NextResponse.json(
        { error: "Mã, Họ tên và Phòng ban là bắt buộc!" },
        { status: 400 }
      );
    }

    // XỬ LÝ NGÀY THÁNG (Quan trọng)
    // Nếu có gửi ngày sinh thì chuyển từ String sang Date object, nếu không thì để null
    const birthdayDate = birthday ? new Date(birthday) : null;
    const startDateDate = startDate ? new Date(startDate) : null;   // [MỚI]
    const idCardDateDate = idCardDate ? new Date(idCardDate) : null; // [MỚI]

    // Lưu dữ liệu vào database
    const newEmployee = await prisma.employee.create({
      data: {
        code: code,
        fullName: fullName,
        birthday: birthdayDate,
        gender: gender,
        address: address,
        phone: phone,
        position: position,
        departmentId: Number(departmentId), // Đảm bảo Id là số
        kipId: kipId ? Number(kipId) : null,
        startDate: startDateDate,
        idCardNumber,
        idCardDate: idCardDateDate,
        idCardPlace,
        bankAccount,
        taxCode
      },
    });

    // Báo về cho trình duyệt
    return NextResponse.json(newEmployee);
  } catch (error) {
    NextResponse.json(
      { error: "Lỗi khi thêm nhân viên, có thể do trùng mã: " + error },
      { status: 400 }
    );
  }
}
