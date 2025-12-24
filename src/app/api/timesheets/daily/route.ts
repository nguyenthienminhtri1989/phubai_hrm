// src/app/api/timesheets/daily/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth"; // <--- THÊM DÒNG NÀY

// 1. LẤY DỮ LIỆU CHẤM CÔNG CỦA 1 PHÒNG BAN TRONG 1 NGÀY
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const dateStr = searchParams.get("date"); // Dạng YYYY-MM-DD

    if (!departmentId || !dateStr) {
      return NextResponse.json(
        {
          error: "Thiếu thông tin phòng ban hoặc ngày",
        },
        { status: 400 }
      );
    }

    // Chuyển ngày về dạng chuẩn Date chuẩn UTC (T00:00:00.000Z) để so sánh chính xác
    const targetDate = new Date(`${dateStr}T00:00:00.000Z`);

    // Lấy tất cả nhân viên của phòng ban đó
    const employees = await prisma.employee.findMany({
      where: { departmentId: parseInt(departmentId) },
      orderBy: { fullName: "asc" },
      include: {
        // Kèm theo dữ liệu chấm công của đúng ngày đó thôi
        timesheets: {
          where: { date: targetDate },
          include: { attendanceCode: true }, // Lấy luôn chi tiết mã công để hiện màu nếu cần
        },
      },
    });

    // Biến đổi dữ liệu cho Client dễ dùng
    const data = employees.map((emp) => {
      // Lấy record chấm công đầu tiên (nếu có)
      const timesheet = emp.timesheets[0];

      return {
        employeeId: emp.id,
        employeeCode: emp.code,
        fullName: emp.fullName,
        // Nếu có data thì lấy ID, không thì null
        attendanceCodeId: timesheet ? timesheet.attendanceCodeId : null,
        note: timesheet ? timesheet.note : "",
        // --- MỚI: Lấy thêm thời gian cập nhật ---
        updatedAt: timesheet ? timesheet.updatedAt : null,
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    console.log("Lỗi lấy dữ liệu chấm công: ", error);
    NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

// 2. LƯU DỮ LIỆU CHẤM CÔNG (HÀNG LOẠT)
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await request.json();
    const { date, departmentId, records } = body; // Nhớ gửi departmentId từ Client lên nhé
    // record là mảng: [{ employeeId: 1, attendanceCodeId: 2, note: '...' }, ...]

    // --- THÊM ĐOẠN KIỂM TRA NÀY ---
    if (!departmentId || !date || !records) {
      return NextResponse.json(
        { error: "Thiếu thông tin bắt buộc (departmentId, date, records)" },
        { status: 400 }
      );
    }
    // -----------------------------

    const dateObj = new Date(date);
    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();

    // --- LOGIC KIỂM TRA KHÓA SỔ ---

    // 1. Kiểm tra xem tháng này của phòng này đã khóa chưa
    const lockRecord = await prisma.timesheetLock.findUnique({
      where: {
        departmentId_month_year: {
          departmentId: Number(departmentId), // Đảm bảo là số
          month: month,
          year: year,
        },
      },
    });

    const isLocked = lockRecord?.isLocked || false;

    // 2. Nếu ĐÃ KHÓA
    if (isLocked) {
      // Nếu là TIMEKEEPER -> CHẶN ĐỨNG
      if (session.user.role === "TIMEKEEPER") {
        return NextResponse.json(
          {
            error: `Bảng công tháng ${month}/${year} đã bị KHÓA SỔ. Vui lòng liên hệ Phòng Nhân sự.`,
          },
          { status: 403 }
        );
      }

      // Nếu là ADMIN hoặc HR_MANAGER -> CHO PHÉP (Quyền sửa đổi phút cuối)
      // (Code chạy tiếp xuống dưới)
    }

    const targetDate = new Date(`${date}T00:00:00.000Z`);

    // Dùng Transaction để đảm bảo an toàn dữ liệu
    await prisma.$transaction(
      records.map((rec: any) =>
        prisma.timesheet.upsert({
          where: {
            // Ràng buộc Unique mà ta đã định nghĩa trong schema
            employeeId_date: {
              employeeId: rec.employeeId,
              date: targetDate,
            },
          },
          // Nếu đã có -> Update
          update: {
            attendanceCodeId: rec.attendanceCodeId,
            note: rec.note,
          },
          // Nếu chưa có -> Create mới
          create: {
            date: targetDate,
            employeeId: rec.employeeId,
            attendanceCodeId: rec.attendanceCodeId,
            note: rec.note,
          },
        })
      )
    );

    return NextResponse.json({ message: "Đã lưu chấm công thành công!" });
  } catch (error) {
    console.error("Lôi lưu chấm công: ", error);
    return NextResponse.json({ error: "Lỗi khi lưu dữ liệu" }, { status: 500 });
  }
}
