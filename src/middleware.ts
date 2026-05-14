import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

// Tạo một bản auth nhẹ dành riêng cho Middleware
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  // --- MOBILE REDIRECT ---
  // Sau khi NextAuth đã xác thực session, thêm logic redirect mobile
  const userAgent = req.headers.get("user-agent") || "";
  const isMobile =
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const { pathname } = req.nextUrl;

  // Chỉ redirect nếu:
  // 1. Là thiết bị mobile (theo User-Agent)
  // 2. Đang ở trang "/" hoặc "/dashboard"
  // 3. Chưa ở nhóm /mobile (tránh vòng lặp)
  if (
    isMobile &&
    !pathname.startsWith("/mobile") &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/login") &&
    (pathname === "/" || pathname === "/dashboard")
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/mobile";
    return NextResponse.redirect(url);
  }
});

export const config = {
  // Chạy trên tất cả các route trừ file tĩnh
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
