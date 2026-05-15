import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    if (!["ADMIN", "HR_MANAGER"].includes(session?.user?.role || "")) {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const userIds = body?.userIds;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "Danh sách userIds không hợp lệ" },
        { status: 400 },
      );
    }

    const ids = userIds.map(Number).filter((id) => Number.isInteger(id));
    if (ids.length !== userIds.length) {
      return NextResponse.json(
        { error: "Danh sách userIds không hợp lệ" },
        { status: 400 },
      );
    }

    const users = await prisma.user.findMany({
      where: { id: { in: ids }, status: "PENDING" },
    });

    await Promise.all(
      users.map((user) =>
        prisma.user.update({
          where: { id: user.id },
          data: {
            status: "ACTIVE",
            ...(user.userDepartmentId
              ? {
                  managedDepartments: {
                    connect: [{ id: user.userDepartmentId }],
                  },
                }
              : {}),
          },
        }),
      ),
    );

    return NextResponse.json({ success: true, count: users.length });
  } catch (error) {
    console.error("Lỗi phê duyệt user:", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
