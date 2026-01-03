import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// 1. LẤY DỮ LIỆU CHẤM CÔNG
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
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

    // Logic lọc:
    // 1. Nếu có departmentId -> Lọc theo Phòng (Đây là phòng KHÔNG thuộc Kíp)
    if (departmentId && departmentId !== "null" && departmentId !== "") {
      whereCondition.departmentId = parseInt(departmentId);
    }

    // 2. Nếu có kipIds -> Lọc theo Kíp (Các bộ phận sản xuất)
    if (kipIdsStr && kipIdsStr !== "") {
      const kipIds = kipIdsStr.split(",").map(Number);
      whereCondition.kipId = { in: kipIds };
    }

    // Nếu không chọn gì cả -> Trả về rỗng
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

    // --- KIỂM TRA KHÓA SỔ ---
    // Chỉ kiểm tra nếu người dùng chấm theo Phòng Ban cụ thể (có departmentId)
    // Nếu chấm theo Kíp (departmentId = null), tạm thời bỏ qua check khóa sổ phòng ban
    // (Hoặc logic này sẽ được nâng cấp sau để check khóa sổ của từng phòng trong kíp)
    if (departmentId) {
      const dateObj = new Date(date);
      const month = dateObj.getMonth() + 1;
      const year = dateObj.getFullYear();

      const lockRecord = await prisma.timesheetLock.findUnique({
        where: {
          departmentId_month_year: {
            departmentId: Number(departmentId),
            month: month,
            year: year,
          },
        },
      });

      if (lockRecord?.isLocked) {
        if (session.user.role === "TIMEKEEPER") {
          return NextResponse.json(
            { error: `Bảng công tháng ${month}/${year} đã bị KHÓA SỔ.` },
            { status: 403 }
          );
        }
      }
    }

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
