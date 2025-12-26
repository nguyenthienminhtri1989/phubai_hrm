import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const kips = await prisma.kip.findMany({
      orderBy: { name: "asc" },
      // --- BẮT BUỘC PHẢI CÓ DÒNG NÀY ---
      include: {
        factory: true, // Lấy kèm thông tin nhà máy
      },
    });
    return NextResponse.json(kips);
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi tải danh sách Kíp" },
      { status: 500 }
    );
  }
}
