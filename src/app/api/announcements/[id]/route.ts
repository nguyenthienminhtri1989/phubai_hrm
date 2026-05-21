import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import fs from "fs";
import path from "path";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role;
    if (!["ADMIN", "HR_MANAGER"].includes(role || "")) {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    }

    const { id } = await params;
    const aId = parseInt(id);
    if (!aId) return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });

    const announcement = await prisma.announcement.findUnique({ where: { id: aId } });
    if (!announcement) {
      return NextResponse.json({ error: "Không tìm thấy thông báo" }, { status: 404 });
    }

    // Xóa file ảnh trên disk nếu có
    if (announcement.imageUrl) {
      try {
        const filePath = path.join(process.cwd(), "public", announcement.imageUrl);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {
        console.error("Không xóa được file ảnh:", e);
      }
    }

    await prisma.announcement.delete({ where: { id: aId } });
    return NextResponse.json({ message: "Đã xóa thông báo" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
