import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export async function POST(request: Request) {
  try {
    const unauth = await requireAuth();
    if (unauth) return unauth;
    const body = await request.json();
    const { month, year, evaluations } = body;
    // evaluations là mảng: [{ employeeId: 1, grade: "A" }, { employeeId: 2, grade: "B" }]

    if (!month || !year || !evaluations) {
      return NextResponse.json({ error: "Thiếu dữ liệu" }, { status: 400 });
    }

    // Dùng transaction để đảm bảo an toàn
    const operations = evaluations.map((item: any) => {
        return prisma.monthlyEvaluation.upsert({
            where: {
                employeeId_month_year: {
                    employeeId: item.employeeId,
                    month: Number(month),
                    year: Number(year)
                }
            },
            update: { grade: item.grade, note: item.note },
            create: {
                employeeId: item.employeeId,
                month: Number(month),
                year: Number(year),
                grade: item.grade,
                note: item.note
            }
        });
    });

    await prisma.$transaction(operations);

    return NextResponse.json({ message: "Đã lưu xếp loại thành công!" });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}