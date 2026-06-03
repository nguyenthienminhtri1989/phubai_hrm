// src/lib/requireAuth.ts
// Helper kiểm tra đăng nhập cho các API route.
// Dùng ở đầu mỗi handler:
//   const unauth = await requireAuth();
//   if (unauth) return unauth;
import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Trả về NextResponse 401 nếu chưa đăng nhập, ngược lại trả về null.
 * Giữ nguyên session ở caller nếu cần dùng thêm (gọi auth() lại nếu cần role).
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  return null;
}
