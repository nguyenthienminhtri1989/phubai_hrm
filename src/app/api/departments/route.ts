// src/app/api/departments/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 1. Hàm GET, dùng để lấy danh sách phòng ban
export async function GET() {
  try {
    // Gọi prisma để lấy danh sách phòng ban
    const departments = await prisma.department.findMany({
      orderBy: {
        id: "asc",
      },
      // TỐI ƯU: Lấy kèm thông tin của nhà máy liên quan
      include: {
        factory: true,
      },
    });

    // Trả kết quả dạng JSON về cho giao diện
    return NextResponse.json(departments);
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi khi lấy danh sách phòng ban: " + error },
      { status: 500 }
    );
  }
}

// 2. Hàm POST, dùng để thêm phòng ban
export async function POST(request: Request) {
  try {
    // Đọc dữ liệu gửi lên từ giao diện
    // Chuyển chuỗi JSON từ trình duyệt gửi lên thành Object rồi gán cho body
    const body = await request.json();
    const { name, code, factoryId } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: "Mã và tên phòng ban là bắt buộc!" },
        { status: 400 }
      );
    }

    // Lưu vào database
    const newDepartment = await prisma.department.create({
      data: {
        name: name,
        code: code,
        factoryId: factoryId, // Nếu factoryId có giá trị thì lưu, nếu null/undefined thì Prisma tự hiểu là null
      },
    });

    // Trả về giao diện thông tin bản ghi vừa được thêm
    return NextResponse.json(newDepartment);
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi khi thêm phòng ban: " + error },
      { status: 400 }
    );
  }
}
