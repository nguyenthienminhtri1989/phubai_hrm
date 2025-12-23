// src/app/api/stats/daily/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import dayjs from "dayjs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date"); // YYYY-MM-DD

    if (!dateStr) {
      return NextResponse.json({ error: "Thiếu ngày" }, { status: 400 });
    }

    const targetDate = new Date(`${dateStr}T00:00:00.000Z`);

    // Lấy toàn bộ nhân viên kèm theo:
    // 1. Phòng ban -> Nhà máy (Để phân loại)
    // 2. Chấm công của ngày đó (Để đếm)
    const employees = await prisma.employee.findMany({
      include: {
        department: {
          include: {
            factory: true,
          },
        },
        timesheets: {
          where: { date: targetDate },
          include: { attendanceCode: true },
        },
      },
    });

    // Trả về dữ liệu thô để Frontend tự "xào nấu"
    return NextResponse.json(employees);
  } catch (error) {
    console.log("Lỗi trả về: ", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
