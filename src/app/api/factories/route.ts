// src/app/api/factories/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { error } from "node:console";

// 1. Hàm GET: Dùng để lấy danh sách nhà máy
export async function GET() {
  try {
    // Gọi prisma để lấy toàn bộ dữ liệu từ bảng Factory
    const factories = await prisma.factory.findMany({
      orderBy: {
        id: "asc", // Sắp xếp theo Id tăng dần
      },
    });

    // Trả về kết quả dạng JSON cho phía giao diện
    return NextResponse.json(factories);
  } catch (error) {
    return NextResponse.json(
      { error: "Không thể lấy dữ liệu nhà máy: " + error },
      { status: 500 }
    );
  }
}

// 2. Hàm POST: Dùng để thêm mới một nhà máy
export async function POST(request: Request) {
  try {
    // Đọc dữ liệu gửi lên từ giao diện
    const body = await request.json();
    const { code, name } = body;

    // Kiểm tra dữ liệu đầu vào
    if (!code || !name) {
      return NextResponse.json(
        { error: "Mã và tên nhà máy là bắt buộc" },
        { status: 400 }
      );
    }

    // Gọi prisma để tạo bản ghi mới
    const newFactory = await prisma.factory.create({
      data: {
        code: code,
        name: name,
      },
    });
    return NextResponse.json(newFactory);
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi khi thêm nhà máy (có thể do trùng mã): " + error },
      { status: 500 }
    );
  }
}
