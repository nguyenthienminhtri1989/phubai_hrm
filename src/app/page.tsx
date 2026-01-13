// src/app/page.tsx
"use client";
import AdminLayout from "@/components/AdminLayout";
import Image from "next/image";

export default function Home() {
  return (
    <AdminLayout>
      {/* Container bao ngoài: Cần position relative để chứa ảnh fill */}
      <div
        style={{
          position: "relative",
          width: "100%",
          minHeight: "85vh", // Chiều cao tối thiểu (85% màn hình)
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "8px",
          overflow: "hidden", // Bo góc để ảnh không bị tràn ra ngoài
        }}
      >
        {/* --- 1. ẢNH NỀN --- */}
        <Image
          src="/images/phubai_company.jpg" // <-- Thay tên file ảnh của bạn ở đây
          alt="Phu Bai Background"
          fill // Tự động tràn đầy khung cha
          style={{
            objectFit: "cover", // Giữ tỷ lệ ảnh, cắt bớt phần thừa
            zIndex: 0, // Nằm dưới cùng
          }}
          priority // Tải ngay lập tức
          quality={100}
        />

        {/* --- 2. LỚP PHỦ MỜ (OVERLAY) --- */}
        {/* Lớp này giúp làm mờ ảnh nền đi một chút để chữ dễ đọc hơn */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(255, 255, 255, 0.4)", // Màu trắng mờ 60% (đổi thành 0,0,0,0.6 nếu muốn nền tối)
            zIndex: 1,
          }}
        ></div>

        {/* --- 3. NỘI DUNG CHỮ --- */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            textAlign: "center",
            padding: "20px",
          }}
        >
          <h1
            className="text-3xl font-bold"
            style={{
              marginBottom: "20px",
              color: "#003a8c", // Màu xanh đậm cho nổi bật
              textTransform: "uppercase",
              textShadow: "1px 1px 2px rgba(255,255,255,0.8)", // Đổ bóng nhẹ cho chữ
            }}
          >
            Chào mừng đến với hệ thống quản lý nhân sự <br /> Công ty CP Sợi Phú
            Bài
          </h1>

          <p style={{ fontSize: "20px", fontWeight: 500, color: "#333" }}>
            Vui lòng chọn chức năng ở menu bên trái để bắt đầu làm việc.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
