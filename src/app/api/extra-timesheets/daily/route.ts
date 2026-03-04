import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentIdStr = searchParams.get("departmentId");
    const dateStr = searchParams.get("date");
    const kipIdsStr = searchParams.get("kipIds");

    if (!dateStr)
      return NextResponse.json(
        { error: "Thiếu ngày chấm công" },
        { status: 400 },
      );

    const targetDate = new Date(`${dateStr}T00:00:00.000Z`);
    const whereCondition: any = {};

    if (
      departmentIdStr &&
      departmentIdStr !== "null" &&
      departmentIdStr !== ""
    ) {
      const deptIds = departmentIdStr
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      if (deptIds.length > 0) whereCondition.departmentId = { in: deptIds };
    }
    if (kipIdsStr && kipIdsStr !== "") {
      const kipIds = kipIdsStr
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      if (kipIds.length > 0) whereCondition.kipId = { in: kipIds };
    }

    if (Object.keys(whereCondition).length === 0) return NextResponse.json([]);

    whereCondition.isActive = true; // Bỏ qua người đã nghỉ việc

    const employees = await prisma.employee.findMany({
      where: whereCondition,
      orderBy: [
        { kip: { name: "asc" } },
        { department: { name: "asc" } },
        { fullName: "asc" },
      ],
      include: {
        extraTimesheets: {
          // [SỬA LẠI THÀNH BẢNG MỚI]
          where: { date: targetDate },
          include: { attendanceCode: true },
        },
        kip: true,
        department: true,
      },
    });

    const data = employees.map((emp) => {
      const timesheet = emp.extraTimesheets[0];
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
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user)
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const body = await request.json();
    const { date, records } = body;

    if (!date || !records || records.length === 0)
      return NextResponse.json(
        { error: "Dữ liệu không hợp lệ" },
        { status: 400 },
      );

    const targetDate = new Date(`${date}T00:00:00.000Z`);

    // (Bạn có thể copy logic kiểm tra khóa sổ của bảng cũ vào đây nếu cần, hiện tại mình giữ ngắn gọn)

    const operations = records.map((rec: any) => {
      if (!rec.attendanceCodeId) {
        return prisma.extraTimesheet.deleteMany({
          // [SỬA] Dùng extraTimesheet
          where: { employeeId: rec.employeeId, date: targetDate },
        });
      } else {
        return prisma.extraTimesheet.upsert({
          // [SỬA] Dùng extraTimesheet
          where: {
            employeeId_date: { employeeId: rec.employeeId, date: targetDate },
          },
          update: { attendanceCodeId: rec.attendanceCodeId, note: rec.note },
          create: {
            date: targetDate,
            employeeId: rec.employeeId,
            attendanceCodeId: rec.attendanceCodeId,
            note: rec.note,
          },
        });
      }
    });

    await prisma.$transaction(operations);
    return NextResponse.json({ message: "Đã lưu thành công!" });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi khi lưu dữ liệu" }, { status: 500 });
  }
}
