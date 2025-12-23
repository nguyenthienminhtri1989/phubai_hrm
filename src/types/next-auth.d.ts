import NextAuth, { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

// Định nghĩa lại các trường mở rộng
declare module "next-auth" {
  /**
   * Mở rộng kiểu Session (được trả về từ useSession, auth())
   */
  interface Session {
    user: {
      id: string;
      username: string;
      role: "ADMIN" | "HR_MANAGER" | "LEADER" | "TIMEKEEPER"; // Hoặc để string nếu muốn linh hoạt
      managedDeptIds: number[];
    } & DefaultSession["user"];
  }

  /**
   * Mở rộng kiểu User (được trả về lúc login)
   */
  interface User {
    id: string;
    username: string;
    role: "ADMIN" | "HR_MANAGER" | "LEADER" | "TIMEKEEPER";
    managedDeptIds: number[];
  }
}

declare module "next-auth/jwt" {
  /**
   * Mở rộng kiểu JWT (token)
   */
  interface JWT {
    id: string;
    username: string;
    role: "ADMIN" | "HR_MANAGER" | "LEADER" | "TIMEKEEPER";
    managedDeptIds: number[];
  }
}
