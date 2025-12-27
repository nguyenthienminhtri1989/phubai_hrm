// src/app/api/timesheets/monthly/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import dayjs from "dayjs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const kipIdsStr = searchParams.get("kipIds"); // <--- Mới thêm
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    if (!month || !year) {
      return NextResponse.json(
        { error: "Thiếu thông tin thời gian (tháng, năm)" },
        { status: 400 }
      );
    }

    // 1. Kiểm tra điều kiện lọc: Phải có ít nhất 1 trong 2 (Phòng hoặc Kíp)
    if (!departmentId && !kipIdsStr) {
      return NextResponse.json(
        { error: "Vui lòng chọn Phòng ban hoặc Kíp" },
        { status: 400 }
      );
    }

    // 2. Xây dựng điều kiện lọc (Where Clause)
    const whereCondition: any = {};

    // Nếu chọn Phòng ban
    if (departmentId && departmentId !== "null") {
      whereCondition.departmentId = parseInt(departmentId);
    }

    // Nếu chọn Kíp (Ưu tiên lọc theo Kíp nếu có)
    if (kipIdsStr) {
      const kipIds = kipIdsStr.split(",").map(Number);
      whereCondition.kipId = { in: kipIds };
    }

    // 3. Xác định thời gian
    const startDate = dayjs(`${year}-${month}-01`).startOf("month").toDate();
    const endDate = dayjs(`${year}-${month}-01`).endOf("month").toDate();

    // 4. Truy vấn
    const employees = await prisma.employee.findMany({
      where: whereCondition,
      orderBy: { code: "asc" },
      include: {
        timesheets: {
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
          include: {
            attendanceCode: true,
          },
        },
        // Include thêm để hiển thị tên Kíp/Phòng nếu cần
        department: true,
        kip: true,
      },
    });

    return NextResponse.json(employees);
  } catch (error) {
    console.error("Lỗi lấy bảng công tháng: ", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
