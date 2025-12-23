// src/app/api/timesheets/monthly/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import dayjs from "dayjs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const month = searchParams.get("month"); // 1-12
    const year = searchParams.get("year"); // 2025

    if (!departmentId || !month || !year) {
      return NextResponse.json(
        { error: "Thiếu thông tin bộ lọc" },
        { status: 400 }
      );
    }

    // 1. Xác định thời gian (Ngày đầu và ngày cuối tháng)
    const startDate = dayjs(`${year}-${month}-01`).startOf("month").toDate();
    const endDate = dayjs(`${year}-${month}-01`).endOf("month").toDate();

    // 2. Lấy dữ liệu
    const employees = await prisma.employee.findMany({
      where: {
        departmentId: parseInt(departmentId),
        // Gợi ý: Có thể thêm điều kiện chỉ lấy nhân viên đang làm việc
        // status: 'ACTIVE'
      },
      // Sắp xếp: Hiện tại đang theo Mã NV.
      // Nếu bạn muốn xếp theo Tên (A-Z) thì đổi thành: { firstName: 'asc' } hoặc { fullName: 'asc' }
      orderBy: { code: "asc" },
      include: {
        timesheets: {
          where: {
            date: {
              gte: startDate, // >= Ngày 1
              lte: endDate, // <= Ngày cuối
            },
          },
          include: {
            attendanceCode: true, // Lấy màu và ký hiệu công
          },
        },
      },
    });

    return NextResponse.json(employees);
  } catch (error) {
    console.error("Lỗi lấy bảng công tháng: ", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
