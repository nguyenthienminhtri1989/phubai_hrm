// src/app/api/timesheets/monthly/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import dayjs from "dayjs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentIdStr = searchParams.get("departmentId");
    const kipIdsStr = searchParams.get("kipIds");
    const factoryIdStr = searchParams.get("factoryId");
    const nameStr = searchParams.get("name");
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    if (!month || !year) {
      return NextResponse.json(
        { error: "Thiếu thông tin thời gian" },
        { status: 400 }
      );
    }

    // [SỬA ĐỔI]: Nới lỏng điều kiện validation
    const hasDeptFilter = !!departmentIdStr || !!kipIdsStr;
    const hasNameFilter = !!nameStr && nameStr.trim() !== ""; // Chỉ cần có tên là đủ

    // Nếu không có bộ lọc nào (Không Phòng, Không Kíp, Không Tên) -> Chặn
    if (!hasDeptFilter && !hasNameFilter) {
      return NextResponse.json(
        {
          error: "Vui lòng chọn Phòng ban hoặc nhập Tên nhân viên để tìm kiếm",
        },
        { status: 400 }
      );
    }

    const whereCondition: any = {};

    // 1. LỌC THEO TÊN (Nếu có)
    if (nameStr && nameStr.trim() !== "") {
      const keyword = nameStr.trim();
      whereCondition.OR = [
        { fullName: { contains: keyword, mode: "insensitive" } },
        { code: { contains: keyword, mode: "insensitive" } },
      ];
    }

    // 2. LỌC THEO NHÀ MÁY (Nếu CÓ chọn thì lọc, KHÔNG chọn thì tìm toàn công ty)
    if (factoryIdStr && factoryIdStr !== "null") {
      // Nếu đã có condition department (do logic dưới) thì merge vào, chưa có thì tạo mới
      whereCondition.department = {
        ...(whereCondition.department || {}),
        factoryId: Number(factoryIdStr),
      };
    }

    // 3. LỌC THEO PHÒNG BAN
    if (departmentIdStr && departmentIdStr !== "null") {
      const deptIds = departmentIdStr
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      if (deptIds.length > 0) {
        whereCondition.departmentId = { in: deptIds };
      }
    }

    // 4. LỌC THEO KÍP
    if (kipIdsStr) {
      const kipIds = kipIdsStr
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      if (kipIds.length > 0) {
        whereCondition.kipId = { in: kipIds };
      }
    }

    // Thời gian
    const startDate = dayjs(`${year}-${month}-01`).startOf("month").toDate();
    const endDate = dayjs(`${year}-${month}-01`).endOf("month").toDate();

    const employees = await prisma.employee.findMany({
      where: whereCondition,
      orderBy: [
        { department: { factoryId: "asc" } }, // [MỚI] Sắp xếp theo Nhà máy trước
        { department: { name: "asc" } },
        { kip: { name: "asc" } },
        { code: "asc" },
      ],
      include: {
        timesheets: {
          where: { date: { gte: startDate, lte: endDate } },
          include: { attendanceCode: true },
        },
        department: { include: { factory: true } }, // [MỚI] Include thêm Factory để hiển thị
        kip: true,
      },
    });

    // Map data
    const data = employees.map((emp) => ({
      id: emp.id,
      code: emp.code,
      fullName: emp.fullName,
      department: emp.department,
      kip: emp.kip,
      timesheets: emp.timesheets.map((t) => ({
        date: dayjs(t.date).format("YYYY-MM-DD"),
        attendanceCode: t.attendanceCode,
      })),
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error("Lỗi server: ", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
