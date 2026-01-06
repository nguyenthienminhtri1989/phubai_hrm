// src/app/api/dashboard/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import dayjs from "dayjs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const factoryId = searchParams.get("factoryId");
    const dateStr = searchParams.get("date");

    // Mặc định là hôm nay
    const date = dateStr ? new Date(dateStr) : new Date();

    // Xác định khoảng thời gian của ngày đó
    const startOfDay = dayjs(date).startOf("day").toDate();
    const endOfDay = dayjs(date).endOf("day").toDate();

    // 1. Chuẩn bị bộ lọc phòng ban
    const whereDept: any = {};
    if (factoryId) {
      whereDept.factoryId = parseInt(factoryId);
    }

    // 2. TRUY VẤN TỐI ƯU (Lấy phòng ban + Nhân viên + Timesheet trong 1 lần gọi)
    const departments = await prisma.department.findMany({
      where: whereDept,
      include: {
        factory: true,
        employees: {
          select: {
            id: true,
            // Lấy timesheet của nhân viên trong ngày đó
            timesheets: {
              where: {
                date: {
                  gte: startOfDay,
                  lte: endOfDay,
                },
              },
              include: {
                attendanceCode: true, // Lấy mã công để check vắng
              },
            },
          },
        },
      },
    });

    // 3. Danh sách các mã được coi là "VẮNG"
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

    // 4. Tính toán số liệu
    const departmentStats = departments.map((dept) => {
      const totalStaff = dept.employees.length;

      // Biến đếm
      let timekeepingCount = 0; // Số người ĐÃ có dữ liệu chấm công
      let absentCount = 0; // Số người Vắng

      dept.employees.forEach((emp) => {
        // Kiểm tra xem nhân viên có bản ghi chấm công nào không
        if (emp.timesheets.length > 0) {
          timekeepingCount++; // Đã chấm công

          // Kiểm tra xem mã công có thuộc nhóm Vắng không
          const code = emp.timesheets[0].attendanceCode.code;
          if (absenceCodes.includes(code)) {
            absentCount++;
          }
        }
      });

      // --- [LOGIC MỚI] XÁC ĐỊNH TRẠNG THÁI ---
      let status = "PENDING"; // Mặc định: Chưa chấm (Xám)
      if (timekeepingCount > 0) {
        if (timekeepingCount >= totalStaff && totalStaff > 0) {
          status = "DONE"; // Đã chấm đủ 100% (Xanh lá)
        } else {
          status = "PROCESSING"; // Đang chấm dở (Xanh dương/Cam)
        }
      }
      // ---------------------------------------

      return {
        key: dept.id,
        id: dept.id, // Thêm id để frontend dùng nếu cần
        departmentName: dept.name,
        factoryName: dept.factory?.name,
        totalStaff,
        absentCount,
        timekeepingCount, // Trả về số lượng người đã chấm
        status, // Trả về trạng thái (PENDING | PROCESSING | DONE)
        percent:
          totalStaff > 0
            ? Math.round((timekeepingCount / totalStaff) * 100)
            : 0, // % Tiến độ
        absentRate:
          totalStaff > 0 ? ((absentCount / totalStaff) * 100).toFixed(1) : 0, // % Vắng
      };
    });

    // Sắp xếp:
    // Ưu tiên 1: Đưa phòng đang chấm (PROCESSING) lên đầu để nhắc nhở
    // Ưu tiên 2: Phòng vắng nhiều lên trên
    departmentStats.sort((a, b) => {
      if (a.status === "PROCESSING" && b.status !== "PROCESSING") return -1;
      if (b.status === "PROCESSING" && a.status !== "PROCESSING") return 1;
      return Number(b.absentCount) - Number(a.absentCount);
    });

    return NextResponse.json({ stats: departmentStats });
  } catch (error) {
    console.error("Lỗi Dashboard Detail:", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
