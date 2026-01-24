import NextAuth, { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";
import { Role } from "@prisma/client";

// Định nghĩa lại các trường mở rộng
declare module "next-auth" {
  /**
   * Mở rộng kiểu Session (được trả về từ useSession, auth())
   */
  interface Session {
    user: {
      id: string;
      username: string;
      fullName: string;
      role: Role;
      managedDeptIds: number[];
    } & DefaultSession["user"];
  }

  /**
   * Mở rộng kiểu User (được trả về lúc login)
   */
  interface User {
    id: string;
    username: string;
    fullName: string;
    role: Role;
    managedDeptIds: number[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    fullName: string;
    role: Role;
    managedDeptIds: number[];
  }
}
