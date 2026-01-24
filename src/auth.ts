// auth.ts (Nằm cùng cấp với folder app)
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config"; // Giữ nguyên import này

const loginSchema = z.object({
  username: z.string().min(1, "Vui lòng nhập tài khoản"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Tài khoản", type: "text" },
        password: { label: "Mật khẩu", type: "password" },
      },
      authorize: async (credentials) => {
        try {
          const { username, password } = await loginSchema.parseAsync(credentials);

          const user = await prisma.user.findUnique({
            where: { username },
            include: { managedDepartments: true },
          });

          if (!user) return null; // v5 khuyến khích return null thay vì throw

          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch) return null;

          // Trả về object user
          return {
            id: user.id.toString(),
            name: user.fullName, // Map fullName vào name chuẩn của Auth.js
            username: user.username,
            role: user.role,
            // Lưu ý: Auth.js v5 ép kiểu User trả về khá chặt, ta sẽ xử lý dữ liệu mở rộng ở callback bên dưới
            managedDepartments: user.managedDepartments, 
          } as any;
        } catch (e) {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    // 1. Chuyển dữ liệu từ User (lúc đăng nhập) sang Token (JWT)
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        token.role = (user as any).role;
        // Lấy danh sách ID phòng ban
        token.managedDeptIds = (user as any).managedDepartments?.map((d: any) => d.id) || [];
        token.fullName = (user as any).name; // Lấy từ field 'name' ở trên
      }
      return token;
    },
    // 2. Chuyển dữ liệu từ Token sang Session (để Client dùng)
    async session({ session, token }) {
      if (session.user) {
        // Gán lại các trường tùy chỉnh
        (session.user as any).id = token.id;
        (session.user as any).username = token.username;
        (session.user as any).role = token.role;
        (session.user as any).fullName = token.fullName;
        (session.user as any).managedDeptIds = token.managedDeptIds;
      }
      return session;
    },
  },
});