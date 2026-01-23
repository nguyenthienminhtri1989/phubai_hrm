// src/app/api/employees/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 1. Hàm GET: Lấy danh sách (Đã nâng cấp để hỗ trợ lọc)
export async function GET(request: Request) {
  try {
    // [MỚI] Lấy tham số từ URL gửi lên (ví dụ: ?departmentId=5)
    const { searchParams } = new URL(request.url);
    const departmentIdStr = searchParams.get("departmentId");
    const factoryIdStr = searchParams.get("factoryId");

    // [MỚI] Tạo điều kiện lọc (Where Condition)
    const whereCondition: any = {};

    // Nếu có departmentId -> Lọc theo phòng
    if (departmentIdStr && departmentIdStr !== "null") {
      whereCondition.departmentId = Number(departmentIdStr);
    }

    // Nếu có factoryId -> Lọc theo nhà máy (dự phòng)
    if (factoryIdStr && factoryIdStr !== "null") {
      whereCondition.department = {
        factoryId: Number(factoryIdStr),
      };
    }

    const employees = await prisma.employee.findMany({
      // [MỚI] Đưa điều kiện lọc vào đây
      where: whereCondition,
      
      orderBy: {
        code: "asc", // [GỢI Ý] Nên sắp xếp theo Mã hoặc Tên để dễ tìm trong dropdown
      },
      
      // Kỹ thuật lồng ghép dữ liệu (Giữ nguyên như cũ)
      include: {
        department: {
          include: {
            factory: true,
          },
        },
        kip: true,
      },
    });

    return NextResponse.json(employees);
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi khi lấy danh sách nhân viên: " + error },
      { status: 500 }
    );
  }
}

// 2. Hàm POST: Thêm nhân viên mới (GIỮ NGUYÊN CODE CỦA BẠN)
export async function POST(request: Request) {
  try {
    const body = await request.json();
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
      taxCode
    } = body;

    if (!code || !fullName || !departmentId) {
      return NextResponse.json(
        { error: "Mã, Họ tên và Phòng ban là bắt buộc!" },
        { status: 400 }
      );
    }

    const birthdayDate = birthday ? new Date(birthday) : null;
    const startDateDate = startDate ? new Date(startDate) : null;
    const idCardDateDate = idCardDate ? new Date(idCardDate) : null;

    const newEmployee = await prisma.employee.create({
      data: {
        code: code,
        fullName: fullName,
        birthday: birthdayDate,
        gender: gender,
        address: address,
        phone: phone,
        position: position,
        departmentId: Number(departmentId),
        kipId: kipId ? Number(kipId) : null,
        startDate: startDateDate,
        idCardNumber,
        idCardDate: idCardDateDate,
        idCardPlace,
        bankAccount,
        taxCode
      },
    });

    return NextResponse.json(newEmployee);
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi khi thêm nhân viên, có thể do trùng mã: " + error },
      { status: 400 }
    );
  }
}