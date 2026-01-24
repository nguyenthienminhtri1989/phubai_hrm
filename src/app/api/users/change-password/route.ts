// src/app/api/user/change-password/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Đường dẫn file cấu hình Auth của bạn
import bcrypt from "bcryptjs"; // Cần cài: npm install bcryptjs @types/bcryptjs

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.username) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const body = await request.json();
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: "Vui lòng nhập đủ thông tin" }, { status: 400 });
    }

    if (newPassword.length < 6) {
        return NextResponse.json({ error: "Mật khẩu mới quá ngắn" }, { status: 400 });
    }

    // 1. Tìm user trong DB
    const user = await prisma.user.findUnique({
      where: { username: session.user.username },
    });

    if (!user) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 });
    }

    // 2. Kiểm tra mật khẩu cũ
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: "Mật khẩu cũ không đúng" }, { status: 400 });
    }

    // 3. Mã hóa mật khẩu mới
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 4. Cập nhật vào DB
    await prisma.user.update({
      where: { username: session.user.username },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ message: "Đổi mật khẩu thành công" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}