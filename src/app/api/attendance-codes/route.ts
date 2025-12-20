import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// --- Lấy danh sách ----
export async function GET() {
  try {
    const codes = await prisma.attendanceCode.findMany({
      orderBy: { id: "asc" },
    });
    return NextResponse.json(codes);
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi tải dữ liệu: " + error },
      { status: 500 }
    );
  }
}

// --- Thêm mới ---
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, name, category, color, factor, description } = body;

    const newCode = await prisma.attendanceCode.create({
      data: {
        code,
        name,
        category,
        color,
        factor: factor ? parseFloat(factor) : 1, // Mặc định hệ số 1 nếu không nhập
        description,
      },
    });

    return NextResponse.json(newCode);
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi thêm mới: " + error },
      { status: 500 }
    );
  }
}
