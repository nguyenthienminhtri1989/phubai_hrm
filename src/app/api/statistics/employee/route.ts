import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import dayjs from "dayjs";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    // Build where clause
    const where: {
      isActive: boolean;
      startDate?: {
        gte?: Date;
        lte?: Date;
      };
    } = {
      isActive: true,
    };

    if (fromDate || toDate) {
      where.startDate = {};
      if (fromDate) {
        where.startDate.gte = dayjs(fromDate).startOf("day").toDate();
      }
      if (toDate) {
        where.startDate.lte = dayjs(toDate).endOf("day").toDate();
      }
    }

    const employees = await prisma.employee.findMany({
      where,
      select: {
        gender: true,
        birthday: true,
      },
    });

    const total = employees.length;
    let maleCount = 0;
    let femaleCount = 0;
    let otherGenderCount = 0;

    let ageGroup18_25 = 0;
    let ageGroup26_35 = 0;
    let ageGroup36_45 = 0;
    let ageGroup46_55 = 0;
    let ageGroup55Plus = 0;
    let ageGroupUnknown = 0;

    employees.forEach((emp) => {
      // Gender grouping
      const g = (emp.gender || "").trim().toLowerCase();
      if (g === "nam") {
        maleCount++;
      } else if (g === "nữ" || g === "nu") {
        femaleCount++;
      } else {
        otherGenderCount++;
      }

      // Age grouping
      if (emp.birthday) {
        const age = dayjs().diff(dayjs(emp.birthday), "year");
        if (age >= 18 && age <= 25) ageGroup18_25++;
        else if (age >= 26 && age <= 35) ageGroup26_35++;
        else if (age >= 36 && age <= 45) ageGroup36_45++;
        else if (age >= 46 && age <= 55) ageGroup46_55++;
        else if (age > 55) ageGroup55Plus++;
        else ageGroupUnknown++; // Edge case: under 18 or negative
      } else {
        ageGroupUnknown++;
      }
    });

    const genderData = [
      { name: "Nam", value: maleCount },
      { name: "Nữ", value: femaleCount },
    ];
    if (otherGenderCount > 0) {
      genderData.push({ name: "Chưa xác định", value: otherGenderCount });
    }

    const ageData = [
      { name: "18-25", value: ageGroup18_25 },
      { name: "26-35", value: ageGroup26_35 },
      { name: "36-45", value: ageGroup36_45 },
      { name: "46-55", value: ageGroup46_55 },
      { name: "56+", value: ageGroup55Plus },
      { name: "Chưa xác định", value: ageGroupUnknown },
    ];

    return NextResponse.json({
      total,
      genderData,
      ageData,
      filterApplied: !!(fromDate || toDate),
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Error fetching employee statistics:", err.message);
    return NextResponse.json({ error: "Lỗi server khi lấy thống kê" }, { status: 500 });
  }
}
