// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import StyledComponentsRegistry from "@/lib/AntdRegistry"; // Import vào

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HR Management App",
  description: "Ứng dụng quản lý nhân sự",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Bọc Registry ở đây để Ant Design hoạt động mượt mà */}
        <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
      </body>
    </html>
  );
}
