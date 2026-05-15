import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const fullName = body?.fullName?.trim();
    const username = body?.username?.trim().toLowerCase();
    const password = body?.password;
    const employeeCode = body?.employeeCode?.trim();
    const departmentId = Number(body?.departmentId);
    const kipId = body?.kipId ? Number(body.kipId) : null;

    if (!fullName || !username || !password || !body?.departmentId) {
      return NextResponse.json(
        { error: "Thiếu thông tin bắt buộc" },
        { status: 400 },
      );
    }

    if (!Number.isInteger(departmentId)) {
      return NextResponse.json(
        { error: "Phòng ban không hợp lệ" },
        { status: 400 },
      );
    }

    if (kipId !== null && !Number.isInteger(kipId)) {
      return NextResponse.json(
        { error: "Kíp không hợp lệ" },
        { status: 400 },
      );
    }

    if (fullName.length < 2) {
      return NextResponse.json(
        { error: "Họ và tên phải từ 2 ký tự" },
        { status: 400 },
      );
    }

    if (username.length < 3 || !/^[a-z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { error: "Tên đăng nhập không hợp lệ" },
        { status: 400 },
      );
    }

    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Mật khẩu phải từ 6 ký tự" },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json(
        { error: "Tên đăng nhập đã tồn tại" },
        { status: 409 },
      );
    }

    const department = await prisma.department.findUnique({
      where: { id: departmentId },
    });
    if (!department) {
      return NextResponse.json(
        { error: "Phòng ban không hợp lệ" },
        { status: 400 },
      );
    }

    if (kipId !== null) {
      const kip = await prisma.kip.findUnique({ where: { id: kipId } });
      if (!kip) {
        return NextResponse.json(
          { error: "Kíp không hợp lệ" },
          { status: 400 },
        );
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        fullName,
        username,
        password: hashedPassword,
        employeeCode: employeeCode || null,
        userDepartmentId: departmentId,
        registeredKipId: kipId,
        role: "STAFF",
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Lỗi đăng ký tài khoản:", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
