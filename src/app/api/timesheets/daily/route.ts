// src/app/api/timesheets/daily/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// 1. LẤY DỮ LIỆU CHẤM CÔNG
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentIdStr = searchParams.get("departmentId"); // Nhận chuỗi "1,2,3"
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

    // --- [SỬA ĐỔI QUAN TRỌNG] ---
    // Logic lọc: Hỗ trợ nhiều Department ID cùng lúc (Do chọn nhiều Kíp hoặc chọn Tổ)
    if (
      departmentIdStr &&
      departmentIdStr !== "null" &&
      departmentIdStr !== ""
    ) {
      // Tách chuỗi "15,16" thành mảng số [15, 16]
      const deptIds = departmentIdStr
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));

      if (deptIds.length > 0) {
        whereCondition.departmentId = { in: deptIds };
      }
    }
    // ----------------------------

    // 2. Nếu có kipIds -> Lọc theo Kíp (Dành cho NM3 hoặc bộ lọc bổ sung)
    if (kipIdsStr && kipIdsStr !== "") {
      const kipIds = kipIdsStr
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      if (kipIds.length > 0) {
        // Lưu ý: Nếu đã lọc theo departmentId (NM2) thì kipId là điều kiện giao (AND)
        // Nếu chưa có departmentId (NM3), nó sẽ lọc nhân viên thuộc các kíp này
        whereCondition.kipId = { in: kipIds };
      }
    }

    // Nếu không chọn gì cả (cả Dept và Kíp đều rỗng) -> Trả về rỗng để tránh tải trộm bộ
    if (Object.keys(whereCondition).length === 0) {
      return NextResponse.json([]);
    }

    const employees = await prisma.employee.findMany({
      where: whereCondition,
      orderBy: [
        { kip: { name: "asc" } }, // Ưu tiên xếp theo Kíp
        { department: { name: "asc" } }, // Sau đó đến tên bộ phận
        { fullName: "asc" }, // Cuối cùng là tên
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
        departmentCode: emp.department?.code, // Trả thêm code nếu cần debug
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

// 2. LƯU DỮ LIỆU
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await request.json();
    const { date, departmentId, records } = body;

    if (!date || !records) {
      return NextResponse.json(
        { error: "Thiếu thông tin bắt buộc" },
        { status: 400 }
      );
    }

    const targetDate = new Date(`${date}T00:00:00.000Z`);

    // Thực hiện lưu (Transaction để đảm bảo toàn vẹn)
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
