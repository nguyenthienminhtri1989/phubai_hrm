// src/app/page.tsx
"use client";
import AdminLayout from "@/components/AdminLayout";

export default function Home() {
  return (
    <AdminLayout>
      <h1>Chào mừng đến với hệ thống quản lý nhân sự</h1>
      <p>Vui lòng chọn chức năng ở menu bên trái.</p>
    </AdminLayout>
  );
}
