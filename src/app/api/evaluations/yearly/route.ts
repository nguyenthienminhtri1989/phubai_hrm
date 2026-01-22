// src/app/api/evaluations/yearly/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentIdStr = searchParams.get("departmentId");
    const kipIdsStr = searchParams.get("kipIds");
    const factoryIdStr = searchParams.get("factoryId");
    const yearStr = searchParams.get("year");

    if (!yearStr) {
      return NextResponse.json({ error: "Thiếu thông tin năm" }, { status: 400 });
    }

    const year = parseInt(yearStr);
    const hasDeptFilter = !!departmentIdStr || !!kipIdsStr;
    
    // Logic chặn nếu không lọc (để tránh tải quá nặng)
    if (!hasDeptFilter) {
      return NextResponse.json({ error: "Vui lòng chọn Phòng ban" }, { status: 400 });
    }

    const whereCondition: any = {};

    // 1. LỌC NHÀ MÁY
    if (factoryIdStr && factoryIdStr !== "null") {
      whereCondition.department = {
        ...(whereCondition.department || {}),
        factoryId: Number(factoryIdStr),
      };
    }

    // 2. LỌC PHÒNG BAN
    if (departmentIdStr && departmentIdStr !== "null") {
      const deptIds = departmentIdStr.split(",").map(Number).filter((n) => !isNaN(n));
      if (deptIds.length > 0) {
        whereCondition.departmentId = { in: deptIds };
      }
    }

    // 3. LỌC KÍP
    if (kipIdsStr) {
      const kipIds = kipIdsStr.split(",").map(Number).filter((n) => !isNaN(n));
      if (kipIds.length > 0) {
        whereCondition.kipId = { in: kipIds };
      }
    }

    // === TRUY VẤN ===
    const employees = await prisma.employee.findMany({
      where: whereCondition,
      orderBy: [
        { department: { factoryId: "asc" } },
        { department: { name: "asc" } },
        { kip: { name: "asc" } },
        { code: "asc" },
      ],
      include: {
        department: true,
        kip: true,
        // Lấy tất cả đánh giá trong năm đó
        evaluations: {
          where: { year: year },
        },
      },
    });

    // === XỬ LÝ DỮ LIỆU TRẢ VỀ ===
    const data = employees.map((emp) => {
      // Tạo mảng 12 tháng rỗng
      const monthlyGrades = Array(12).fill(null);
      
      let countA = 0;
      let countB = 0;
      let countC = 0;

      emp.evaluations.forEach((eva) => {
        // eva.month chạy từ 1-12, index chạy từ 0-11
        if (eva.month >= 1 && eva.month <= 12) {
            monthlyGrades[eva.month - 1] = eva.grade;
            
            // Tính tổng (Logic đơn giản, bạn có thể custom thêm A+, B-...)
            const g = eva.grade.toUpperCase();
            if (g.startsWith("A")) countA++;
            else if (g.startsWith("B")) countB++;
            else if (g.startsWith("C")) countC++;
        }
      });

      return {
        id: emp.id,
        code: emp.code,
        fullName: emp.fullName,
        departmentName: emp.department.name,
        kipName: emp.kip ? emp.kip.name : "",
        monthlyGrades, // Mảng ["A", null, "B", ...]
        summary: { A: countA, B: countB, C: countC }
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Lỗi server API Yearly Eval: ", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}