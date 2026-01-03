// src/app/api/dashboard/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import dayjs from "dayjs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const factoryId = searchParams.get("factoryId"); // Lọc theo nhà máy (nếu có)
    const dateStr = searchParams.get("date");

    // Mặc định là hôm nay
    const date = dateStr ? new Date(dateStr) : new Date();

    // Xác định khoảng thời gian của ngày đó (00:00 -> 23:59)
    const startOfDay = dayjs(date).startOf("day").toDate();
    const endOfDay = dayjs(date).endOf("day").toDate();

    // 1. Chuẩn bị bộ lọc phòng ban
    const whereDept: any = {};
    if (factoryId) {
      whereDept.factoryId = parseInt(factoryId);
    }

    const departments = await prisma.department.findMany({
      where: whereDept,
      include: { factory: true },
    });

    // 2. Tính toán số liệu
    // --- KHAI BÁO CÁC MÃ CÔNG ĐƯỢC COI LÀ "VẮNG" TẠI ĐÂY ---
    // Bạn hãy liệt kê tất cả các mã tương ứng với ý bạn:
    // P: Phép, O: Vô lý do, Ô: Ốm, TS: Thai sản, TN: Tai nạn, RO: Nghỉ không lương...
    const absenceCodes = [
      "F",
      "L",
      "R",
      "B",
      "ĐC",
      "Ô",
      "CÔ",
      "T",
      "DS",
      "CL",
      "TS",
      "RO",
      "O",
      "NB",
    ];

    const departmentStats = await Promise.all(
      departments.map(async (dept) => {
        // A. TỔNG NHÂN VIÊN (Mẫu số)
        // Code sẽ đếm tất cả nhân viên đang có trong danh sách phòng ban này.
        const totalStaff = await prisma.employee.count({
          where: {
            departmentId: dept.id,
          },
        });

        // B. SỐ NHÂN VIÊN VẮNG (Tử số)
        // Logic: Đếm trong bảng Timesheet, ngày hôm đó, có mã nằm trong danh sách "absenceCodes"
        const absentCount = await prisma.timesheet.count({
          where: {
            employee: { departmentId: dept.id }, // Thuộc phòng ban này
            date: {
              gte: startOfDay,
              lte: endOfDay,
            },
            attendanceCode: {
              code: { in: absenceCodes }, // <--- Mấu chốt nằm ở đây
            },
          },
        });

        return {
          key: dept.id,
          departmentName: dept.name,
          factoryName: dept.factory?.name,
          totalStaff,
          absentCount,
          // Tính % vắng
          absentRate:
            totalStaff > 0 ? ((absentCount / totalStaff) * 100).toFixed(1) : 0,
        };
      })
    );

    // Sắp xếp: Đưa phòng nào vắng nhiều nhất lên đầu
    departmentStats.sort((a, b) => b.absentCount - a.absentCount);

    return NextResponse.json({ stats: departmentStats });
  } catch (error) {
    console.error("Lỗi Dashboard Detail:", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
