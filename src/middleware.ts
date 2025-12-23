import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Tạo một bản auth nhẹ dành riêng cho Middleware
export default NextAuth(authConfig).auth;

export const config = {
  // Chạy trên tất cả các route trừ file tĩnh
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
