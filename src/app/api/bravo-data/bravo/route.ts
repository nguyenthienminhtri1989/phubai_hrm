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

    // Xử lý bộ lọc: Nếu không có tham số -> Lấy toàn bộ công ty
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

    // Thời gian quét
    const startDate = dayjs(`${year}-${month}-01`).startOf("month").toDate();
    const endDate = dayjs(`${year}-${month}-01`).endOf("month").toDate();
    const daysInMonth = dayjs(`${year}-${month}-01`).daysInMonth();

    // Lấy nhân viên kèm phòng ban và dữ liệu chấm công
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
        { department: { factoryId: "asc" } },
        { department: { name: "asc" } },
        { code: "asc" },
      ],
    });

    const flatData = [];

    // Duyệt qua từng nhân viên
    for (const emp of employees) {
      // Duyệt qua từng ngày trong tháng
      for (let d = 1; d <= daysInMonth; d++) {
        // Cột 1: Định dạng DD/MM/YY
        const currentDay = dayjs(`${year}-${month}-${d}`);
        const dateStrExport = currentDay.format("DD/MM/YY");
        const dateStrQuery = currentDay.format("YYYY-MM-DD");

        // Tìm xem ngày này có chấm công không
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

        // Tạo 1 dòng dữ liệu
        flatData.push({
          ngay: dateStrExport, // 1
          nvNhap: "H0030", // 2
          boPhan: emp.department?.code || "", // 3
          maCongThoiGian: "+", // 4
          maNv: emp.code, // 5
          tenNv: emp.fullName, // 6
          maCong: attCode, // 7 (Trống nếu chưa chấm)
          loaiCong: attCategory, // 8 (Trống nếu chưa chấm)
        });
      }
    }

    return NextResponse.json(flatData);
  } catch (error) {
    console.error("Lỗi Export BRAVO:", error);
    return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
  }
}
