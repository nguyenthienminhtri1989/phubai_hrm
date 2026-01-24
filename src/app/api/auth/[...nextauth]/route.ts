// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth"; // Import từ file auth.ts ở bước 2

export const { GET, POST } = handlers;