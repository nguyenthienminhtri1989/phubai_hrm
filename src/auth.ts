import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config"; // Import cấu hình nhẹ

const loginSchema = z.object({
  username: z.string().min(1, "Vui lòng nhập tài khoản"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

// Gộp cấu hình nhẹ + Provider nặng
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig, // Kế thừa cấu hình
  providers: [
    Credentials({
      credentials: {
        username: { label: "Tài khoản", type: "text" },
        password: { label: "Mật khẩu", type: "password" },
      },
      authorize: async (credentials) => {
        const { username, password } = await loginSchema.parseAsync(
          credentials
        );

        const user = await prisma.user.findUnique({
          where: { username },
          include: { managedDepartments: true },
        });

        if (!user) throw new Error("Tài khoản không tồn tại");

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) throw new Error("Sai mật khẩu");

        return {
          id: user.id.toString(),
          name: user.fullName,
          username: user.username,
          role: user.role,
          managedDeptIds: user.managedDepartments.map((d) => d.id),
        };
      },
    }),
  ],
});
