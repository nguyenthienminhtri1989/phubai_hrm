// src/app/api/timesheets/monthly/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import dayjs from "dayjs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentIdStr = searchParams.get("departmentId"); // Nhận chuỗi "1,2,3"
    const kipIdsStr = searchParams.get("kipIds");
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    if (!month || !year) {
      return NextResponse.json(
        { error: "Thiếu thông tin thời gian" },
        { status: 400 }
      );
    }

    if (!departmentIdStr && !kipIdsStr) {
      return NextResponse.json(
        { error: "Vui lòng chọn bộ lọc" },
        { status: 400 }
      );
    }

    const whereCondition: any = {};

    // --- [SỬA ĐỔI QUAN TRỌNG: HỖ TRỢ NHIỀU PHÒNG BAN] ---
    if (departmentIdStr && departmentIdStr !== "null") {
      const deptIds = departmentIdStr
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      if (deptIds.length > 0) {
        whereCondition.departmentId = { in: deptIds };
      }
    }
    // ----------------------------------------------------

    if (kipIdsStr) {
      const kipIds = kipIdsStr
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      // Nếu chưa lọc theo phòng (NM3) thì lọc theo Kíp
      if (!whereCondition.departmentId && kipIds.length > 0) {
        whereCondition.kipId = { in: kipIds };
      }
    }

    // Thời gian
    const startDate = dayjs(`${year}-${month}-01`).startOf("month").toDate();
    const endDate = dayjs(`${year}-${month}-01`).endOf("month").toDate();

    const employees = await prisma.employee.findMany({
      where: whereCondition,
      orderBy: [
        { kip: { name: "asc" } },
        { department: { name: "asc" } },
        { code: "asc" },
      ],
      include: {
        timesheets: {
          where: {
            date: { gte: startDate, lte: endDate },
          },
          include: { attendanceCode: true },
        },
        department: true,
        kip: true,
      },
    });

    // Map lại cấu trúc dữ liệu trả về cho gọn
    const data = employees.map((emp) => ({
      id: emp.id,
      code: emp.code,
      fullName: emp.fullName,
      department: emp.department,
      kip: emp.kip,
      timesheets: emp.timesheets.map((t) => ({
        date: dayjs(t.date).format("YYYY-MM-DD"),
        attendanceCode: t.attendanceCode,
      })),
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error("Lỗi server: ", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
