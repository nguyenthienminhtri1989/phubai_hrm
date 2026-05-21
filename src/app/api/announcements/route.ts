import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET: Danh sách thông báo (cho user đã đăng nhập)
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.announcement.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          author: { select: { fullName: true, role: true } },
        },
      }),
      prisma.announcement.count(),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

// POST: Đăng thông báo mới (ADMIN / HR_MANAGER)
export async function POST(request: Request) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role;
    if (!["ADMIN", "HR_MANAGER"].includes(role || "")) {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    }

    const body = await request.json();
    const { title, content, imageUrl } = body;

    if (!title || String(title).trim().length < 2) {
      return NextResponse.json({ error: "Tiêu đề tối thiểu 2 ký tự" }, { status: 400 });
    }
    if (!content || String(content).trim().length < 5) {
      return NextResponse.json({ error: "Nội dung tối thiểu 5 ký tự" }, { status: 400 });
    }

    const authorId = Number((session!.user as any).id);

    const created = await prisma.announcement.create({
      data: {
        title: String(title).trim(),
        content: String(content).trim(),
        imageUrl: imageUrl ? String(imageUrl) : null,
        authorId,
      },
      include: { author: { select: { fullName: true, role: true } } },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi khi tạo thông báo" }, { status: 500 });
  }
}
