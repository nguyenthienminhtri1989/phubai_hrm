import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const FULL_ACCESS_ROLES = ["ADMIN", "HR_MANAGER"];
const TRANSFER_ROLES = ["ADMIN", "HR_MANAGER", "TIMEKEEPER", "STAFF"];

function parsePositiveInt(value: unknown) {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
}

function parseIdList(value: unknown) {
  if (!Array.isArray(value)) return null;
  const ids = value.map(parsePositiveInt);
  if (ids.some((id) => id === null)) return null;
  return Array.from(new Set(ids as number[]));
}

function getKipNumber(text?: string | null) {
  return text?.match(/\d+/)?.[0] || null;
}

export async function GET() {
  try {
    const session = await auth();
    const role = session?.user?.role || "";

    if (!session?.user || !TRANSFER_ROLES.includes(role)) {
      return NextResponse.json({ error: "Khong co quyen" }, { status: 403 });
    }

    const hasFullAccess = FULL_ACCESS_ROLES.includes(role);
    const managedDeptIds = session.user.managedDeptIds || [];

    if (!hasFullAccess && managedDeptIds.length === 0) {
      return NextResponse.json({
        departments: [],
        kips: [],
        employees: [],
      });
    }

    const departments = await prisma.department.findMany({
      where: hasFullAccess ? {} : { id: { in: managedDeptIds } },
      include: { factory: true },
      orderBy: { id: "asc" },
    });

    const factoryIds = Array.from(new Set(departments.map((d) => d.factoryId)));

    const [kips, employees] = await Promise.all([
      prisma.kip.findMany({
        where: hasFullAccess ? {} : { factoryId: { in: factoryIds } },
        include: { factory: true },
        orderBy: [{ factoryId: "asc" }, { id: "asc" }],
      }),
      prisma.employee.findMany({
        where: {
          isActive: true,
          ...(hasFullAccess ? {} : { departmentId: { in: managedDeptIds } }),
        },
        include: {
          department: { include: { factory: true } },
          kip: true,
        },
        orderBy: { code: "asc" },
      }),
    ]);

    return NextResponse.json({ departments, kips, employees });
  } catch (error) {
    console.error("Loi tai du lieu dieu chuyen:", error);
    return NextResponse.json({ error: "Loi server" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    const role = session?.user?.role || "";

    if (!session?.user || !TRANSFER_ROLES.includes(role)) {
      return NextResponse.json({ error: "Khong co quyen" }, { status: 403 });
    }

    const hasFullAccess = FULL_ACCESS_ROLES.includes(role);
    const managedDeptIds = session.user.managedDeptIds || [];

    if (!hasFullAccess && managedDeptIds.length === 0) {
      return NextResponse.json(
        { error: "Tai khoan chua duoc phan quyen bo phan" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    const employeeIds = parseIdList(body?.employeeIds);
    const targetDepartmentId = parsePositiveInt(body?.targetDepartmentId);
    const rawTargetKipId = body?.targetKipId;
    const targetKipId =
      rawTargetKipId === null || rawTargetKipId === undefined || rawTargetKipId === ""
        ? null
        : parsePositiveInt(rawTargetKipId);

    if (!employeeIds || employeeIds.length === 0 || !targetDepartmentId) {
      return NextResponse.json(
        { error: "Du lieu dieu chuyen khong hop le" },
        { status: 400 },
      );
    }

    const targetDepartment = await prisma.department.findUnique({
      where: { id: targetDepartmentId },
      include: { factory: true },
    });

    if (!targetDepartment) {
      return NextResponse.json(
        { error: "Bo phan dich khong ton tai" },
        { status: 404 },
      );
    }

    if (!hasFullAccess && !managedDeptIds.includes(targetDepartment.id)) {
      return NextResponse.json(
        { error: "Khong duoc dieu chuyen den bo phan nay" },
        { status: 403 },
      );
    }

    let normalizedTargetKipId: number | null = null;

    if (targetDepartment.isKip) {
      if (!targetKipId) {
        return NextResponse.json(
          { error: "Bo phan theo kip bat buoc chon kip" },
          { status: 400 },
        );
      }

      const targetKip = await prisma.kip.findUnique({
        where: { id: targetKipId },
      });

      if (!targetKip || targetKip.factoryId !== targetDepartment.factoryId) {
        return NextResponse.json(
          { error: "Kip khong thuoc cung nha may voi bo phan dich" },
          { status: 400 },
        );
      }

      const deptKipNumber = targetDepartment.code.match(
        new RegExp(`^${targetDepartment.factoryId}[a-zA-Z]+(\\d+)$`),
      )?.[1];
      const selectedKipNumber = getKipNumber(targetKip.name);

      if (deptKipNumber && selectedKipNumber && deptKipNumber !== selectedKipNumber) {
        return NextResponse.json(
          { error: "Kip khong khop voi ma bo phan dich" },
          { status: 400 },
        );
      }

      normalizedTargetKipId = targetKip.id;
    }

    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true,
        isActive: true,
        departmentId: true,
      },
    });

    if (employees.length !== employeeIds.length) {
      return NextResponse.json(
        { error: "Co nhan vien khong ton tai" },
        { status: 404 },
      );
    }

    if (employees.some((employee) => !employee.isActive)) {
      return NextResponse.json(
        { error: "Khong the dieu chuyen nhan vien da nghi viec" },
        { status: 400 },
      );
    }

    if (
      !hasFullAccess &&
      employees.some((employee) => !managedDeptIds.includes(employee.departmentId))
    ) {
      return NextResponse.json(
        { error: "Khong duoc dieu chuyen nhan vien ngoai pham vi phu trach" },
        { status: 403 },
      );
    }

    const result = await prisma.employee.updateMany({
      where: { id: { in: employeeIds } },
      data: {
        departmentId: targetDepartment.id,
        kipId: normalizedTargetKipId,
      },
    });

    return NextResponse.json({
      message: "Dieu chuyen thanh cong",
      count: result.count,
      targetDepartmentId: targetDepartment.id,
      targetKipId: normalizedTargetKipId,
    });
  } catch (error) {
    console.error("Loi dieu chuyen nhan vien:", error);
    return NextResponse.json({ error: "Loi server" }, { status: 500 });
  }
}
