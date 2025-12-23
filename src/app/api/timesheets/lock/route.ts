import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// 1. LẤY TRẠNG THÁI KHÓA (Để hiển thị lên giao diện: Ổ khóa đóng hay mở)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const departmentId = searchParams.get("departmentId");
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  if (!departmentId || !month || !year) return NextResponse.json({});

  const lockRecord = await prisma.timesheetLock.findUnique({
    where: {
      departmentId_month_year: {
        departmentId: parseInt(departmentId),
        month: parseInt(month),
        year: parseInt(year),
      },
    },
  });

  return NextResponse.json({ isLocked: lockRecord?.isLocked || false });
}

// 2. THỰC HIỆN KHÓA / MỞ KHÓA
export async function POST(request: Request) {
  try {
    const session = await auth();
    // Chỉ Admin hoặc HR mới được quyền Khóa/Mở
    if (!["ADMIN", "HR_MANAGER"].includes(session?.user?.role || "")) {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    }

    const body = await request.json();
    const { departmentId, month, year, isLocked } = body;

    const lockRecord = await prisma.timesheetLock.upsert({
      where: {
        departmentId_month_year: {
          departmentId: parseInt(departmentId),
          month: parseInt(month),
          year: parseInt(year),
        },
      },
      update: {
        isLocked: isLocked,
        lockedBy: session?.user?.username,
      },
      create: {
        departmentId: parseInt(departmentId),
        month: parseInt(month),
        year: parseInt(year),
        isLocked: isLocked,
        lockedBy: session?.user?.username,
      },
    });

    return NextResponse.json({
      message: isLocked ? "Đã khóa sổ" : "Đã mở khóa",
      isLocked: lockRecord.isLocked,
    });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
