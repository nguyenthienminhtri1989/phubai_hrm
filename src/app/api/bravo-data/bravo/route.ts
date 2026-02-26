import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import dayjs from "dayjs";

// Ánh xạ Category sang Tiếng Việt
const CATEGORY_MAP: Record<string, string> = {
  TIME_WORK: "Lương thời gian",
  PAID_LEAVE: "Nghỉ hưởng 100% lương",
  SICK: "Chế độ Ốm / Tai nạn",
  MATERNITY: "Chế độ Thai sản",
  UNPAID: "Nghỉ không lương",
  AWOL: "Nghỉ vô lý do",
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get("month") || "");
    const year = parseInt(searchParams.get("year") || "");
    const factoryIdStr = searchParams.get("factoryId");
    const departmentIdStr = searchParams.get("departmentId");
    const kipIdsStr = searchParams.get("kipIds");

    if (!month || !year) {
      return NextResponse.json({ error: "Thiếu tháng/năm" }, { status: 400 });
    }

    const whereCondition: any = {};

    if (factoryIdStr && factoryIdStr !== "null") {
      whereCondition.department = { factoryId: Number(factoryIdStr) };
    }
    if (
      departmentIdStr &&
      departmentIdStr !== "null" &&
      departmentIdStr !== ""
    ) {
      const ids = departmentIdStr.split(",").map(Number);
      if (ids.length > 0) whereCondition.departmentId = { in: ids };
    }
    if (kipIdsStr && kipIdsStr !== "null" && kipIdsStr !== "") {
      const ids = kipIdsStr.split(",").map(Number);
      if (ids.length > 0) whereCondition.kipId = { in: ids };
    }

    const startDate = dayjs(`${year}-${month}-01`).startOf("month").toDate();
    const endDate = dayjs(`${year}-${month}-01`).endOf("month").toDate();
    const daysInMonth = dayjs(`${year}-${month}-01`).daysInMonth();

    // 1. Lấy dữ liệu (Prisma sẽ tự động gom nhóm nhân viên theo bộ phận nhờ orderBy)
    const employees = await prisma.employee.findMany({
      where: whereCondition,
      include: {
        department: true,
        timesheets: {
          where: { date: { gte: startDate, lte: endDate } },
          include: { attendanceCode: true },
        },
      },
      orderBy: [
        { department: { factoryId: "asc" } }, // Sắp xếp theo nhà máy trước
        { departmentId: "asc" }, // Cùng nhà máy thì gom theo Bộ phận
        { code: "asc" }, // Cùng bộ phận thì xếp theo Mã NV
      ],
    });

    const flatData = [];

    // 2. [THAY ĐỔI QUAN TRỌNG Ở ĐÂY] Vòng lặp Ngày nằm bên ngoài
    for (let d = 1; d <= daysInMonth; d++) {
      const currentDay = dayjs(`${year}-${month}-${d}`);
      const dateStrExport = currentDay.format("DD/MM/YY");
      const dateStrQuery = currentDay.format("YYYY-MM-DD");

      // Vòng lặp Nhân viên nằm bên trong (Lúc này danh sách NV đã được gom theo Bộ phận ở trên)
      for (const emp of employees) {
        // Tìm xem ngày này nhân viên có chấm công không
        const log = emp.timesheets.find(
          (t) => dayjs(t.date).format("YYYY-MM-DD") === dateStrQuery,
        );

        let attCode = "";
        let attCategory = "";

        if (log && log.attendanceCode) {
          attCode = log.attendanceCode.code;
          attCategory =
            CATEGORY_MAP[log.attendanceCode.category] ||
            log.attendanceCode.category;
        }

        // Đẩy dòng dữ liệu vào mảng
        flatData.push({
          ngay: dateStrExport,
          nvNhap: "H0030",
          boPhan: emp.department?.code || "",
          maCongThoiGian: "+",
          maNv: emp.code,
          tenNv: emp.fullName,
          maCong: attCode,
          loaiCong: attCategory,
        });
      }
    }

    return NextResponse.json(flatData);
  } catch (error) {
    console.error("Lỗi Export BRAVO:", error);
    return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
  }
}
