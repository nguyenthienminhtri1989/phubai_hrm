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

        // [MỚI] Lấy thêm tham số view
        const viewMode = searchParams.get("view");

        // Validate thời gian
        if (!month || !year) {
            return NextResponse.json(
                { error: "Thiếu thông tin thời gian (tháng/năm)" },
                { status: 400 }
            );
        }

        // Điều kiện validation bộ lọc
        const hasDeptFilter = !!departmentIdStr || !!kipIdsStr;
        const hasNameFilter = !!nameStr && nameStr.trim() !== "";
        // [MỚI] Kiểm tra thêm điều kiện viewMode
        const isViewAll = viewMode === "all";

        // Logic chặn tải nặng: Nếu KHÔNG lọc VÀ KHÔNG phải xem tất cả -> Chặn
        if (!hasDeptFilter && !hasNameFilter && !isViewAll) {
            return NextResponse.json(
                { error: "Vui lòng chọn Phòng ban hoặc nhấn nút 'Xem tất cả'" },
                { status: 400 }
            );
        }
        const whereCondition: any = {};

        // 1. LỌC THEO TÊN
        if (nameStr && nameStr.trim() !== "") {
            const keyword = nameStr.trim();
            whereCondition.OR = [
                { fullName: { contains: keyword, mode: "insensitive" } },
                { code: { contains: keyword, mode: "insensitive" } },
            ];
        }

        // 2. LỌC THEO NHÀ MÁY
        if (factoryIdStr && factoryIdStr !== "null") {
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

        if (!isViewAll) {
            if (departmentIdStr && departmentIdStr !== "null") {
                const deptIds = departmentIdStr.split(",").map(Number).filter((n) => !isNaN(n));
                if (deptIds.length > 0) whereCondition.departmentId = { in: deptIds };
            }
            if (kipIdsStr) {
                const kipIds = kipIdsStr.split(",").map(Number).filter((n) => !isNaN(n));
                if (kipIds.length > 0) whereCondition.kipId = { in: kipIds };
            }
        }

        // Thời gian cho query Timesheet
        const startDate = dayjs(`${year}-${month}-01`).startOf("month").toDate();
        const endDate = dayjs(`${year}-${month}-01`).endOf("month").toDate();

        // === TRUY VẤN DATABASE ===
        const employees = await prisma.employee.findMany({
            where: whereCondition,
            orderBy: [
                { department: { factoryId: "asc" } },
                { department: { name: "asc" } },
                { kip: { name: "asc" } },
                { code: "asc" },
            ],
            include: {
                // Lấy dữ liệu chấm công trong tháng
                timesheets: {
                    where: { date: { gte: startDate, lte: endDate } },
                    include: { attendanceCode: true },
                },
                // Lấy thông tin phòng ban & nhà máy
                department: { include: { factory: true } },
                // Lấy thông tin Kíp
                kip: true,

                // [QUAN TRỌNG] Lấy dữ liệu Xếp loại (MonthlyEvaluation)
                evaluations: {
                    where: {
                        month: Number(month),
                        year: Number(year),
                    },
                    take: 1, // Lấy 1 bản ghi duy nhất khớp tháng/năm
                },
            },
        });

        // === MAP DỮ LIỆU TRẢ VỀ ===
        const data = employees.map((emp) => {
            // Lấy bản ghi xếp loại (nếu có)
            const evaluationRecord = emp.evaluations[0];

            return {
                id: emp.id,
                code: emp.code,
                fullName: emp.fullName,
                department: emp.department,
                kip: emp.kip,

                // Trả về giá trị grade (A, B, C) cho Frontend
                // Nếu chưa có xếp loại thì trả về null hoặc chuỗi rỗng
                classification: evaluationRecord ? evaluationRecord.grade : null,

                timesheets: emp.timesheets.map((t) => ({
                    date: dayjs(t.date).format("YYYY-MM-DD"),
                    attendanceCode: t.attendanceCode,
                })),
            };
        });

        return NextResponse.json(data);
    } catch (error) {
        console.error("Lỗi server API Monthly Timesheet: ", error);
        return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
    }
}