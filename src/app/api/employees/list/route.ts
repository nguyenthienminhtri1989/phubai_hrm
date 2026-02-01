// src/app/api/employees/list/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Lấy danh sách nhân viên rút gọn để làm dropdown
    const employees = await prisma.employee.findMany({
      select: {
        id: true,
        code: true,
        fullName: true,
        departmentId: true, // Lấy ID phòng để tự động điền
        department: {
          select: { name: true, factory: { select: { name: true } } },
        },
      },
      orderBy: { code: "asc" },
    });

    return NextResponse.json(employees);
  } catch (error) {
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
