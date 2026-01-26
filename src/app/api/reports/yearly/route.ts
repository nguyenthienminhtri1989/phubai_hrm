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
    // 1. Lọc nhân viên (Logic giữ nguyên)
    const whereEmployee: any = {};
    if (departmentIds) whereEmployee.departmentId = { in: departmentIds };
    if (kipIds) whereEmployee.kipId = { in: kipIds };
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
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    // --- LOGIC 1: XẾP LOẠI (Dùng model MonthlyEvaluation) ---
    if (type === "evaluation") {
      // [ĐÃ SỬA] Dùng monthlyEvaluation thay vì evaluation
      const evaluations = await prisma.monthlyEvaluation.findMany({
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
            // Logic đếm tổng hợp
            if (ev.grade?.startsWith("A")) countA++;
            else if (ev.grade?.startsWith("B")) countB++;
            else if (ev.grade?.startsWith("C")) countC++;
          }
        });

        return {
          ...emp,
          departmentName: emp.department?.name,
          kipName: emp.kip?.name,
          data: monthlyGrades,
          summary: { col1: countA, col2: countB, col3: countC },
        };
      });
      return NextResponse.json(result);
    }

    // --- LOGIC 2 & 3: ĐẾM CÔNG / PHÉP (Dùng model Timesheet) ---
    // Giả sử model Timesheet có quan hệ: date, attendanceCode (code)
    let targetCodes: string[] = [];
    if (type === "workday") targetCodes = ["+", "XD"];
    if (type === "leave") targetCodes = ["F"];

    const timesheets = await prisma.timesheet.findMany({
      where: {
        employeeId: { in: employeeIds },
        date: { gte: startDate, lte: endDate },
        attendanceCode: { code: { in: targetCodes } },
      },
      select: {
        employeeId: true,
        date: true,
        attendanceCode: { select: { code: true } },
      },
    });

    const result = employees.map((emp) => {
      const empLogs = timesheets.filter((t) => t.employeeId === emp.id);
      const monthlyCounts = Array(12).fill(0);
      let totalCount = 0;

      empLogs.forEach((log) => {
        const monthIdx = new Date(log.date).getMonth();
        monthlyCounts[monthIdx] += 1;
        totalCount += 1;
      });

      let summaryData;
      if (type === "workday") {
        summaryData = { col1: totalCount };
      } else {
        // Tổng phép chuẩn là 14
        summaryData = { col1: totalCount, col2: 14 - totalCount };
      }

      return {
        ...emp,
        departmentName: emp.department?.name,
        kipName: emp.kip?.name,
        data: monthlyCounts,
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
