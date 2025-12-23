// src/app/layout.tsx
import React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import StyledComponentsRegistry from "@/lib/AntdRegistry"; // Import vào
import { ConfigProvider } from "antd"; // Cấu hình thiết kế bảng dữ liệu

// 1. IMPORT CÁI NÀY VÀO
import SessionProviderWrapper from "@/components/SessionProviderWrapper";

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
        <StyledComponentsRegistry>
          <SessionProviderWrapper>
            <ConfigProvider
              theme={{
                components: {
                  Table: {
                    // --- CẤU HÌNH MÀU SẮC BẢNG Ở ĐÂY ---
                    headerBg: "#12174A", // Màu nền Header (Ví dụ: Xanh đen)
                    headerColor: "#ffffff", // Màu chữ Header (Trắng)
                    headerSortActiveBg: "#002140", // Màu nền khi cột đang được sort
                    headerSortHoverBg: "#002140", // Màu nền khi di chuột vào header
                    rowHoverBg: "#A1E0FF", // Màu nền dòng khi di chuột vào (tùy chọn)
                  },
                },
              }}
            >
              {children}
            </ConfigProvider>
          </SessionProviderWrapper>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
