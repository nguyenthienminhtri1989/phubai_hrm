import type { NextAuthConfig } from "next-auth";

// Cấu hình này an toàn để chạy trên Edge (Middleware)
export const authConfig = {
  pages: {
    signIn: "/login", // Trang đăng nhập tùy chỉnh
  },
  callbacks: {
    // Logic kiểm tra quyền truy cập (Authorized)
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;

      // Danh sách các trang cần bảo vệ
      const protectedRoutes = [
        "/",
        "/dashboard",
        "/timesheets",
        "/employees",
        "/departments",
      ];

      // Kiểm tra xem trang hiện tại có nằm trong danh sách bảo vệ không
      const isProtectedRoute = protectedRoutes.some(
        (route) =>
          nextUrl.pathname === route || nextUrl.pathname.startsWith(route + "/")
      );

      if (isProtectedRoute) {
        if (isLoggedIn) return true;
        return false; // Chưa đăng nhập -> Tự động đá về Login
      } else if (isLoggedIn && nextUrl.pathname.startsWith("/login")) {
        // Đã đăng nhập mà vào trang login -> Đá về Dashboard
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
    // Chuyển dữ liệu từ Token sang Session (Để Client dùng)
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.managedDeptIds = token.managedDeptIds;
        session.user.username = token.username;
      }
      return session;
    },
    async jwt({ token, user }: any) {
      if (user) {
        token.role = user.role;
        token.managedDeptIds = user.managedDeptIds;
        token.username = user.username;
      }
      return token;
    },
  },
  providers: [], // Để trống ở đây, sẽ nạp Provider ở file auth.ts
} satisfies NextAuthConfig;
