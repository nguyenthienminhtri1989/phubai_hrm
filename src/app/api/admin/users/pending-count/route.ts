import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!["ADMIN", "HR_MANAGER"].includes(session?.user?.role || "")) {
      return NextResponse.json({ count: 0 });
    }

    const count = await prisma.user.count({
      where: { status: "PENDING" },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Lỗi đếm user chờ duyệt:", error);
    return NextResponse.json({ count: 0 });
  }
}
