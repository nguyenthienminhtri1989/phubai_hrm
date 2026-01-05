// src/app/api/timesheets/daily/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// 1. LẤY DỮ LIỆU CHẤM CÔNG
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentIdStr = searchParams.get("departmentId");
    const dateStr = searchParams.get("date");
    const kipIdsStr = searchParams.get("kipIds");

    if (!dateStr) {
      return NextResponse.json(
        { error: "Thiếu ngày chấm công" },
        { status: 400 }
      );
    }

    const targetDate = new Date(`${dateStr}T00:00:00.000Z`);
    const whereCondition: any = {};

    // Logic lọc: Hỗ trợ nhiều Department ID (NM2, NM1)
    if (
      departmentIdStr &&
      departmentIdStr !== "null" &&
      departmentIdStr !== ""
    ) {
      const deptIds = departmentIdStr
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));

      if (deptIds.length > 0) {
        whereCondition.departmentId = { in: deptIds };
      }
    }

    // Logic lọc: Hỗ trợ Kíp (NM3 hoặc lọc thêm)
    if (kipIdsStr && kipIdsStr !== "") {
      const kipIds = kipIdsStr
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      if (kipIds.length > 0) {
        whereCondition.kipId = { in: kipIds };
      }
    }

    if (Object.keys(whereCondition).length === 0) {
      return NextResponse.json([]);
    }

    const employees = await prisma.employee.findMany({
      where: whereCondition,
      orderBy: [
        { kip: { name: "asc" } },
        { department: { name: "asc" } },
        { fullName: "asc" },
      ],
      include: {
        timesheets: {
          where: { date: targetDate },
          include: { attendanceCode: true },
        },
        kip: true,
        department: true,
      },
    });

    const data = employees.map((emp) => {
      const timesheet = emp.timesheets[0];
      return {
        employeeId: emp.id,
        employeeCode: emp.code,
        fullName: emp.fullName,
        departmentName: emp.department?.name,
        departmentCode: emp.department?.code,
        kipName: emp.kip?.name,
        attendanceCodeId: timesheet ? timesheet.attendanceCodeId : null,
        note: timesheet ? timesheet.note : "",
        updatedAt: timesheet ? timesheet.updatedAt : null,
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    console.log("Lỗi lấy dữ liệu: ", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

// 2. LƯU DỮ LIỆU (ĐÃ BỔ SUNG LOGIC KHÓA SỔ MỚI)
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await request.json();
    const { date, records } = body;

    if (!date || !records || records.length === 0) {
      return NextResponse.json(
        { error: "Dữ liệu không hợp lệ hoặc danh sách rỗng" },
        { status: 400 }
      );
    }

    const targetDate = new Date(`${date}T00:00:00.000Z`);

    // --- [BẮT ĐẦU] LOGIC KIỂM TRA KHÓA SỔ (LOCK RULE) ---

    // 1. Xác định Nhà máy của nhân viên đang được chấm
    // Lấy thông tin của nhân viên đầu tiên trong danh sách để tìm Nhà máy
    const firstEmpId = records[0].employeeId;
    const employeeInfo = await prisma.employee.findUnique({
      where: { id: firstEmpId },
      include: { department: { include: { factory: true } } },
    });

    const factoryId = employeeInfo?.department?.factory?.id;

    // 2. Tìm luật khóa đang hiệu lực
    const activeLock = await prisma.lockRule.findFirst({
      where: {
        fromDate: { lte: targetDate }, // Ngày chấm >= Ngày bắt đầu khóa
        toDate: { gte: targetDate }, // Ngày chấm <= Ngày kết thúc khóa
        OR: [
          { factoryId: null }, // Khóa toàn bộ hệ thống
          { factoryId: factoryId ? factoryId : undefined }, // Khóa riêng nhà máy này
        ],
      },
    });

    // 3. Nếu tìm thấy luật khóa -> CHẶN
    if (activeLock) {
      // Cho phép Admin sửa bất chấp khóa (nếu muốn chặn cả Admin thì xóa dòng if này)
      if (session.user.role !== "ADMIN") {
        return NextResponse.json(
          {
            error: `ĐÃ KHÓA SỔ! Dữ liệu bị khóa từ ${activeLock.fromDate.toLocaleDateString(
              "vi-VN"
            )} đến ${activeLock.toDate.toLocaleDateString("vi-VN")} (${
              activeLock.reason || "Không có lý do"
            }).`,
          },
          { status: 403 }
        );
      }
    }
    // --- [KẾT THÚC] LOGIC KIỂM TRA KHÓA SỔ ---

    // Thực hiện lưu
    await prisma.$transaction(
      records.map((rec: any) =>
        prisma.timesheet.upsert({
          where: {
            employeeId_date: {
              employeeId: rec.employeeId,
              date: targetDate,
            },
          },
          update: {
            attendanceCodeId: rec.attendanceCodeId,
            note: rec.note,
          },
          create: {
            date: targetDate,
            employeeId: rec.employeeId,
            attendanceCodeId: rec.attendanceCodeId,
            note: rec.note,
          },
        })
      )
    );

    return NextResponse.json({ message: "Đã lưu thành công!" });
  } catch (error) {
    console.error("Lỗi lưu chấm công: ", error);
    return NextResponse.json({ error: "Lỗi khi lưu dữ liệu" }, { status: 500 });
  }
}
