// src/app/api/factories/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// --- QUAN TRỌNG: Định nghĩa kiểu Props cho Next.js 15 ---
type Props = {
  params: Promise<{ id: string }>;
};

// 1. LẤY CHI TIẾT NHÀ MÁY (GET)
export async function GET(request: Request, props: Props) {
  try {
    const params = await props.params; // <--- Await params
    const id = parseInt(params.id);

    if (isNaN(id))
      return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });

    const factory = await prisma.factory.findUnique({
      where: { id },
    });

    if (!factory)
      return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

    return NextResponse.json(factory);
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

// 2. CẬP NHẬT NHÀ MÁY (PATCH) - Đây là hàm bị báo lỗi
export async function PATCH(request: Request, props: Props) {
  try {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    }

    const params = await props.params; // <--- SỬA LỖI CHÍNH Ở ĐÂY
    const id = parseInt(params.id);

    if (isNaN(id))
      return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });

    const body = await request.json();
    const { name, code } = body;

    const updatedFactory = await prisma.factory.update({
      where: { id },
      data: { name, code },
    });

    return NextResponse.json(updatedFactory);
  } catch (error) {
    console.error("Lỗi update factory:", error);
    return NextResponse.json({ error: "Lỗi cập nhật" }, { status: 500 });
  }
}

// 3. XÓA NHÀ MÁY (DELETE)
export async function DELETE(request: Request, props: Props) {
  try {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    }

    const params = await props.params; // <--- Await params
    const id = parseInt(params.id);

    if (isNaN(id))
      return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });

    // Kiểm tra ràng buộc trước khi xóa (có phòng ban nào không)
    const departmentsCount = await prisma.department.count({
      where: { factoryId: id },
    });

    if (departmentsCount > 0) {
      return NextResponse.json(
        { error: "Không thể xóa: Nhà máy này đang có phòng ban trực thuộc." },
        { status: 400 }
      );
    }

    await prisma.factory.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Đã xóa thành công" });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
