// src/app/api/overtime/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import dayjs from "dayjs";

// 1. GET: Lấy danh sách (Có lọc theo Tháng + Phòng ban)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const monthStr = searchParams.get("month");
    const yearStr = searchParams.get("year");
    
    const whereCondition: any = {};
    
    // Lọc theo Phòng ban
    if (departmentId) {
      whereCondition.employee = { departmentId: Number(departmentId) };
    }

    // Lọc theo Tháng (Nếu có chọn)
    if (monthStr && yearStr) {
      const startOfMonth = dayjs(`${yearStr}-${monthStr}-01`).startOf('month').toDate();
      const endOfMonth = dayjs(`${yearStr}-${monthStr}-01`).endOf('month').toDate();
      whereCondition.startTime = {
        gte: startOfMonth,
        lte: endOfMonth,
      };
    }

    const records = await prisma.overtimeRecord.findMany({
      where: whereCondition,
      orderBy: { startTime: "desc" }, // Mới nhất lên đầu
      include: {
        employee: {
          include: { department: { include: { factory: true } } } // Include sâu để lấy tên nhà máy
        }
      }
    });

    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

// 2. POST: Thêm mới
export async function POST(request: Request) {
  try {
    const body = await request.json();
    // [MỚI] Nhận thêm createdBy từ frontend gửi lên
    const { employeeId, content, startTime, endTime, createdBy } = body;

    const start = dayjs(startTime);
    const end = dayjs(endTime);
    const diffMinutes = end.diff(start, "minute");

    if (diffMinutes <= 0) return NextResponse.json({ error: "Giờ ra phải lớn hơn giờ vào" }, { status: 400 });

    const newRecord = await prisma.overtimeRecord.create({
      data: {
        employeeId: Number(employeeId),
        content,
        startTime: start.toDate(),
        endTime: end.toDate(),
        totalMinutes: diffMinutes,
        createdBy: createdBy,  // Lưu người tạo
      },
      include: { employee: { include: { department: { include: { factory: true } } } } }
    });

    return NextResponse.json(newRecord);
  } catch (error) {
    return NextResponse.json({ error: "Lỗi lưu dữ liệu" }, { status: 500 });
  }
}

// 3. PUT: Cập nhật (Sửa)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, content, startTime, endTime } = body;

    const start = dayjs(startTime);
    const end = dayjs(endTime);
    const diffMinutes = end.diff(start, "minute");

    if (diffMinutes <= 0) return NextResponse.json({ error: "Giờ ra phải lớn hơn giờ vào" }, { status: 400 });

    const updatedRecord = await prisma.overtimeRecord.update({
      where: { id: Number(id) },
      data: {
        content,
        startTime: start.toDate(),
        endTime: end.toDate(),
        totalMinutes: diffMinutes,
      },
      include: { employee: { include: { department: { include: { factory: true } } } } }
    });

    return NextResponse.json(updatedRecord);
  } catch (error) {
    return NextResponse.json({ error: "Lỗi cập nhật" }, { status: 500 });
  }
}

// 4. DELETE: Xóa
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Thiếu ID" }, { status: 400 });

    await prisma.overtimeRecord.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi xóa dữ liệu" }, { status: 500 });
  }
}