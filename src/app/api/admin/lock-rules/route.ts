import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// 1. LẤY DANH SÁCH LUẬT KHÓA
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!["ADMIN", "HR_MANAGER"].includes(session?.user?.role || "")) {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    }

    const rules = await prisma.lockRule.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        factory: true,
        // [MỚI] Include danh sách phòng ban bị khóa
        departments: {
          include: {
            department: {
              include: { factory: true },
            },
          },
        },
      },
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

// Helper: Kiểm tra xung đột lệnh khóa (trả về lệnh xung đột nếu có)
async function checkConflict(
  fromDate: Date,
  toDate: Date,
  type: "ALL" | "FACTORY" | "DEPARTMENT",
  factoryId?: number | null,
  departmentIds?: number[],
  excludeId?: number, // Dùng khi UPDATE để loại trừ chính nó
) {
  const baseWhere: any = {
    fromDate: { lte: toDate },
    toDate: { gte: fromDate },
  };
  if (excludeId) baseWhere.id = { not: excludeId };

  if (type === "ALL") {
    // Khóa toàn hệ thống: xung đột với bất kỳ lệnh nào cùng thời gian
    return prisma.lockRule.findFirst({ where: baseWhere });
  }

  if (type === "FACTORY") {
    // Khóa nhà máy X: xung đột nếu có lệnh toàn hệ thống hoặc lệnh cùng nhà máy
    return prisma.lockRule.findFirst({
      where: {
        ...baseWhere,
        OR: [
          { factoryId: null, departments: { none: {} } }, // Khóa toàn hệ thống
          { factoryId: factoryId, departments: { none: {} } }, // Cùng nhà máy
        ],
      },
    });
  }

  if (type === "DEPARTMENT" && departmentIds && departmentIds.length > 0) {
    // Lấy thông tin phòng ban để biết nhà máy
    const depts = await prisma.department.findMany({
      where: { id: { in: departmentIds } },
      select: { id: true, factoryId: true },
    });
    const factoryIds = [...new Set(depts.map((d) => d.factoryId))];

    // Xung đột nếu có:
    // 1. Lệnh khóa toàn hệ thống
    // 2. Lệnh khóa nhà máy của phòng ban đó
    // 3. Lệnh khóa phòng ban trùng với 1 trong các phòng ban đang chọn
    return prisma.lockRule.findFirst({
      where: {
        ...baseWhere,
        OR: [
          { factoryId: null, departments: { none: {} } }, // Toàn hệ thống
          {
            factoryId: { in: factoryIds },
            departments: { none: {} },
          }, // Cùng nhà máy
          {
            departments: {
              some: { departmentId: { in: departmentIds } },
            },
          }, // Cùng phòng ban
        ],
      },
    });
  }

  return null;
}

// 2. TẠO LUẬT MỚI (ADMIN và HR_MANAGER)
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!["ADMIN", "HR_MANAGER"].includes(session?.user?.role || "")) {
      return NextResponse.json(
        { error: "Chỉ Admin hoặc HR Manager mới được khóa sổ" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { lockType, factoryId, departmentIds, fromDate, toDate, reason } =
      body;

    // lockType: "ALL" | "FACTORY" | "DEPARTMENT"
    if (!lockType || !fromDate || !toDate) {
      return NextResponse.json(
        { error: "Thiếu thông tin (loại khóa, thời gian)" },
        { status: 400 },
      );
    }

    if (lockType === "FACTORY" && !factoryId) {
      return NextResponse.json(
        { error: "Vui lòng chọn nhà máy cần khóa" },
        { status: 400 },
      );
    }

    if (
      lockType === "DEPARTMENT" &&
      (!departmentIds || departmentIds.length === 0)
    ) {
      return NextResponse.json(
        { error: "Vui lòng chọn ít nhất một phòng ban / công đoạn" },
        { status: 400 },
      );
    }

    const from = new Date(new Date(fromDate).setHours(0, 0, 0, 0));
    const to = new Date(new Date(toDate).setHours(23, 59, 59, 999));

    // Kiểm tra xung đột
    const conflict = await checkConflict(
      from,
      to,
      lockType,
      lockType === "FACTORY" ? Number(factoryId) : null,
      lockType === "DEPARTMENT" ? departmentIds.map(Number) : [],
    );

    if (conflict) {
      return NextResponse.json(
        {
          error: `Xung đột! Đã tồn tại lệnh khóa chồng lên thời gian này (lý do: "${conflict.reason || "không có lý do"}"). Vui lòng kiểm tra lại.`,
        },
        { status: 409 },
      );
    }

    // Tạo lệnh khóa
    await prisma.lockRule.create({
      data: {
        factoryId:
          lockType === "FACTORY" ? Number(factoryId) : null,
        fromDate: from,
        toDate: to,
        reason: reason,
        // [MỚI] Tạo kèm các liên kết phòng ban
        departments:
          lockType === "DEPARTMENT"
            ? {
                create: departmentIds.map((dId: number) => ({
                  departmentId: Number(dId),
                })),
              }
            : undefined,
      },
    });

    return NextResponse.json({ message: "Đã tạo lệnh khóa thành công!" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi khi tạo khóa" }, { status: 500 });
  }
}

// 3. XÓA LUẬT (MỞ KHÓA) - ADMIN và HR_MANAGER
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!["ADMIN", "HR_MANAGER"].includes(session?.user?.role || "")) {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Thiếu ID" }, { status: 400 });

    // onDelete: Cascade trên LockRuleDepartment sẽ tự xóa các liên kết phòng ban
    await prisma.lockRule.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ message: "Đã mở khóa (xóa luật) thành công!" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

// 4. CẬP NHẬT LUẬT (SỬA) - ADMIN và HR_MANAGER
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!["ADMIN", "HR_MANAGER"].includes(session?.user?.role || "")) {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    }

    const body = await request.json();
    const { id, lockType, factoryId, departmentIds, fromDate, toDate, reason } =
      body;

    if (!id || !lockType || !fromDate || !toDate) {
      return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 });
    }

    const from = new Date(new Date(fromDate).setHours(0, 0, 0, 0));
    const to = new Date(new Date(toDate).setHours(23, 59, 59, 999));

    // Kiểm tra xung đột (loại trừ chính bản ghi đang sửa)
    const conflict = await checkConflict(
      from,
      to,
      lockType,
      lockType === "FACTORY" ? Number(factoryId) : null,
      lockType === "DEPARTMENT" ? (departmentIds || []).map(Number) : [],
      Number(id),
    );

    if (conflict) {
      return NextResponse.json(
        {
          error: `Xung đột! Đã tồn tại lệnh khóa chồng lên thời gian này (lý do: "${conflict.reason || "không có lý do"}"). Vui lòng kiểm tra lại.`,
        },
        { status: 409 },
      );
    }

    // Cập nhật: Xóa liên kết phòng ban cũ, thêm mới nếu cần
    await prisma.$transaction([
      // Xóa toàn bộ liên kết phòng ban cũ
      prisma.lockRuleDepartment.deleteMany({
        where: { lockRuleId: Number(id) },
      }),
      // Cập nhật lệnh khóa chính
      prisma.lockRule.update({
        where: { id: Number(id) },
        data: {
          factoryId:
            lockType === "FACTORY" ? Number(factoryId) : null,
          fromDate: from,
          toDate: to,
          reason: reason,
          // Tạo lại liên kết phòng ban mới nếu cần
          departments:
            lockType === "DEPARTMENT" && departmentIds?.length > 0
              ? {
                  create: departmentIds.map((dId: number) => ({
                    departmentId: Number(dId),
                  })),
                }
              : undefined,
        },
      }),
    ]);

    return NextResponse.json({ message: "Đã cập nhật lệnh khóa thành công!" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
