// src/app/page.tsx
"use client";
import AdminLayout from "@/components/AdminLayout";

export default function Home() {
  return (
    <AdminLayout>
      <h1 className="text-3xl font-bold">
        Chào mừng đến với hệ thống quản lý nhân sự công ty CP Sợi Phú Bài
      </h1>
      <p style={{ fontSize: "22px" }}>
        Vui lòng chọn chức năng ở menu bên trái.
      </p>
    </AdminLayout>
  );
}
