// src/app/api/evaluations/monthly/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get("month") || "");
    const year = parseInt(searchParams.get("year") || "");
    const factoryId = searchParams.get("factoryId");
    const departmentId = searchParams.get("departmentId"); // Chuỗi "1,2,3"
    const kipIds = searchParams.get("kipIds"); // Chuỗi "1,2"

    if (!month || !year) {
      return NextResponse.json({ error: "Thiếu tháng/năm" }, { status: 400 });
    }

    // Xây dựng bộ lọc (Giống hệt trang chấm công)
    const whereCondition: any = {
       // Chỉ lấy nhân viên đang làm việc (nếu có cột status)
    };

    if (factoryId) {
        whereCondition.department = { factoryId: Number(factoryId) };
    }

    if (departmentId) {
        const ids = departmentId.split(",").map(Number);
        whereCondition.departmentId = { in: ids };
    }

    if (kipIds) {
        const ids = kipIds.split(",").map(Number);
        whereCondition.kipId = { in: ids };
    }

    // Lấy danh sách nhân viên + Kết quả xếp loại của tháng đó (nếu có)
    const employees = await prisma.employee.findMany({
      where: whereCondition,
      orderBy: [
        { kip: { name: "asc" } },
        { department: { name: "asc" } },
        { code: "asc" }
      ],
      include: {
        department: true,
        kip: true,
        // Kèm theo kết quả đánh giá của tháng/năm đang chọn
        evaluations: {
          where: {
            month: month,
            year: year
          }
        }
      }
    });

    // Làm phẳng dữ liệu để Frontend dễ dùng
    const data = employees.map(emp => ({
        id: emp.id,
        code: emp.code,
        fullName: emp.fullName,
        departmentName: emp.department.name,
        kipName: emp.kip?.name || "",
        // Nếu có đánh giá thì lấy cái đầu tiên (vì quan hệ 1-n nhưng đã filter unique), ko thì null
        grade: emp.evaluations.length > 0 ? emp.evaluations[0].grade : null,
        note: emp.evaluations.length > 0 ? emp.evaluations[0].note : "",
    }));

    return NextResponse.json(data);

  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}