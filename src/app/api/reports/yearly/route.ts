// src/app/api/reports/yearly/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(
    searchParams.get("year") || new Date().getFullYear().toString(),
  );
  const factoryId = searchParams.get("factoryId");
  const departmentIds = searchParams
    .get("departmentId")
    ?.split(",")
    .map(Number);
  const kipIds = searchParams.get("kipIds")?.split(",").map(Number);
  const type = searchParams.get("type") || "evaluation"; // evaluation | workday | leave

  try {
    // 1. Lọc nhân viên theo Phòng/Kíp
    const whereEmployee: any = {};
    if (departmentIds) whereEmployee.departmentId = { in: departmentIds };
    if (kipIds) whereEmployee.kipId = { in: kipIds };
    // Nếu lọc theo nhà máy mà chưa lọc phòng ban, cần lấy tất cả NV trong nhà máy đó (thông qua phòng ban)
    if (factoryId && !departmentIds) {
      whereEmployee.department = { factoryId: parseInt(factoryId) };
    }

    const employees = await prisma.employee.findMany({
      where: whereEmployee,
      select: {
        id: true,
        code: true,
        fullName: true,
        department: { select: { name: true } },
        kip: { select: { name: true } },
      },
      orderBy: { code: "asc" },
    });

    const employeeIds = employees.map((e) => e.id);
    const startDate = new Date(year, 0, 1); // 01/01
    const endDate = new Date(year, 11, 31); // 31/12

    // --- LOGIC 1: XẾP LOẠI (Lấy từ bảng Evaluation) ---
    if (type === "evaluation") {
      const evaluations = await prisma.evaluation.findMany({
        where: {
          employeeId: { in: employeeIds },
          year: year,
        },
      });

      const result = employees.map((emp) => {
        const empEvals = evaluations.filter((ev) => ev.employeeId === emp.id);
        const monthlyGrades = Array(12).fill(null);
        let countA = 0,
          countB = 0,
          countC = 0;

        empEvals.forEach((ev) => {
          const monthIdx = ev.month - 1;
          if (monthIdx >= 0 && monthIdx < 12) {
            monthlyGrades[monthIdx] = ev.grade;
            if (ev.grade?.startsWith("A")) countA++;
            else if (ev.grade?.startsWith("B")) countB++;
            else if (ev.grade?.startsWith("C")) countC++;
          }
        });

        return {
          ...emp,
          departmentName: emp.department?.name,
          kipName: emp.kip?.name,
          data: monthlyGrades, // Mảng 12 tháng (A, B, C...)
          summary: { col1: countA, col2: countB, col3: countC }, // A, B, C
        };
      });
      return NextResponse.json(result);
    }

    // --- LOGIC 2 & 3: ĐẾM CÔNG / PHÉP (Lấy từ bảng Timesheet) ---
    // Xác định mã chấm công cần đếm
    let targetCodes: string[] = [];
    if (type === "workday") targetCodes = ["+", "XD"];
    if (type === "leave") targetCodes = ["F"];

    // Truy vấn dữ liệu chấm công gói gọn (Aggregate)
    // Lưu ý: groupBy có thể không hỗ trợ join code trực tiếp tùy DB, nên ta dùng findMany + xử lý code JS cho linh hoạt
    const timesheets = await prisma.timesheet.findMany({
      where: {
        employeeId: { in: employeeIds },
        date: { gte: startDate, lte: endDate },
        attendanceCode: { code: { in: targetCodes } }, // Chỉ lấy những ngày có mã cần tìm
      },
      select: {
        employeeId: true,
        date: true,
        attendanceCode: { select: { code: true } }, // Để debug hoặc tính toán nếu cần hệ số
      },
    });

    const result = employees.map((emp) => {
      const empLogs = timesheets.filter((t) => t.employeeId === emp.id);
      const monthlyCounts = Array(12).fill(0);
      let totalCount = 0;

      empLogs.forEach((log) => {
        const monthIdx = new Date(log.date).getMonth(); // 0-11
        monthlyCounts[monthIdx] += 1; // Cộng 1 công
        totalCount += 1;
      });

      // Cấu trúc trả về summary tùy theo loại báo cáo
      let summaryData;
      if (type === "workday") {
        summaryData = { col1: totalCount }; // Tổng công đi làm
      } else {
        // Phép: col1 = Đã nghỉ, col2 = Còn lại (14 - Đã nghỉ)
        summaryData = { col1: totalCount, col2: 14 - totalCount };
      }

      return {
        ...emp,
        departmentName: emp.department?.name,
        kipName: emp.kip?.name,
        data: monthlyCounts, // Mảng 12 tháng (số lượng)
        summary: summaryData,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: "Lỗi server: " + error.message },
      { status: 500 },
    );
  }
}
