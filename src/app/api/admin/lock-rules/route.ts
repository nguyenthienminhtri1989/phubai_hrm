import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// 1. LẤY DANH SÁCH LUẬT
export async function GET(request: Request) {
  try {
    const session = await auth();
    // Đã có sẵn ADMIN và HR_MANAGER
    if (!["ADMIN", "HR_MANAGER"].includes(session?.user?.role || "")) {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    }

    const rules = await prisma.lockRule.findMany({
      orderBy: { createdAt: "desc" },
      include: { factory: true },
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

// 2. TẠO LUẬT MỚI (KHÓA SỔ)
export async function POST(request: Request) {
  try {
    const session = await auth();
    // [ĐÃ SỬA] Cho phép cả HR_MANAGER
    if (!["ADMIN", "HR_MANAGER"].includes(session?.user?.role || "")) {
      return NextResponse.json(
        { error: "Chỉ Admin hoặc HR Manager mới được khóa sổ" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { factoryId, fromDate, toDate, reason } = body;

    if (!fromDate || !toDate) {
      return NextResponse.json(
        { error: "Thiếu thời gian khóa" },
        { status: 400 },
      );
    }

    const from = new Date(new Date(fromDate).setHours(0, 0, 0, 0));
    const to = new Date(new Date(toDate).setHours(23, 59, 59, 999));

    await prisma.lockRule.create({
      data: {
        factoryId: factoryId ? Number(factoryId) : null,
        fromDate: from,
        toDate: to,
        reason: reason,
      },
    });

    return NextResponse.json({ message: "Đã tạo lệnh khóa thành công!" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi khi tạo khóa" }, { status: 500 });
  }
}

// 3. XÓA LUẬT (MỞ KHÓA)
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    // [ĐÃ SỬA] Cho phép cả HR_MANAGER
    if (!["ADMIN", "HR_MANAGER"].includes(session?.user?.role || "")) {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Thiếu ID" }, { status: 400 });

    await prisma.lockRule.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ message: "Đã mở khóa (xóa luật) thành công!" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

// 4. CẬP NHẬT LUẬT (SỬA)
export async function PUT(request: Request) {
  try {
    const session = await auth();
    // [ĐÃ SỬA] Cho phép cả HR_MANAGER
    if (!["ADMIN", "HR_MANAGER"].includes(session?.user?.role || "")) {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    }

    const body = await request.json();
    const { id, fromDate, toDate, reason } = body;

    if (!id || !fromDate || !toDate) {
      return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 });
    }

    const from = new Date(new Date(fromDate).setHours(0, 0, 0, 0));
    const to = new Date(new Date(toDate).setHours(23, 59, 59, 999));

    await prisma.lockRule.update({
      where: { id: Number(id) },
      data: {
        fromDate: from,
        toDate: to,
        reason: reason,
      },
    });

    return NextResponse.json({ message: "Đã cập nhật lệnh khóa thành công!" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
