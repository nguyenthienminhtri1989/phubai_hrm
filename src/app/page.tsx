// src/app/page.tsx
"use client";
import AdminLayout from "@/components/AdminLayout";
import { useSession } from "next-auth/react";
import { Typography, Space } from "antd";
import {
  CheckCircleTwoTone,
  SafetyCertificateTwoTone,
  DashboardTwoTone
} from "@ant-design/icons";

const { Title, Text } = Typography;

export default function Home() {
  const { data: session } = useSession();
  const userName = session?.user?.fullName || session?.user?.name || session?.user?.username || "bạn";

  return (
    <AdminLayout>
      <div
        style={{
          width: "100%",
          minHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          // Nền gradient xanh nhạt sang trắng (rất dịu mắt và chuyên nghiệp)
          background: "linear-gradient(135deg, #f0f5ff 0%, #ffffff 100%)",
          borderRadius: "16px",
          padding: "20px",
          border: "1px solid #e6f0ff",
        }}
      >
        {/* KHỐI NỘI DUNG CHÍNH (White Card) */}
        <div
          style={{
            background: "#ffffff",
            padding: "50px 60px",
            borderRadius: "24px",
            boxShadow: "0 20px 40px rgba(0, 58, 140, 0.08)", // Đổ bóng xanh nhạt
            textAlign: "center",
            maxWidth: "800px",
            width: "100%",
            border: "1px solid #f0f0f0",
          }}
        >
          {/* LỜI CHÀO CÁ NHÂN */}
          <div
            style={{
              display: "inline-block",
              padding: "8px 24px",
              background: "#e6f4ff", // Nền xanh ant design
              color: "#1677ff",
              borderRadius: "50px",
              fontWeight: 600,
              fontSize: "16px",
              marginBottom: "24px",
              border: "1px solid #91caff",
            }}
          >
            👋 Xin chào, <span style={{ color: "#d9363e", fontWeight: "bold" }}>{userName}</span>!
          </div>

          {/* TIÊU ĐỀ CHÍNH */}
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 800,
              color: "#003a8c",
              marginBottom: "16px",
              lineHeight: 1.4,
              textTransform: "uppercase",
            }}
          >
            Hệ thống Quản lý Nhân sự <br />
            <span style={{ color: "#1677ff", fontSize: "38px" }}>Công ty CP Sợi Phú Bài</span>
          </h1>

          {/* LỜI DẪN */}
          <p style={{ fontSize: "18px", color: "#595959", marginBottom: "40px" }}>
            Chúc bạn một ngày làm việc hiệu quả. Vui lòng chọn các chức năng trên thanh menu bên trái để bắt đầu.
          </p>

          {/* CÁC ICON TRANG TRÍ (Hiển thị tính năng hệ thống) */}
          <div style={{ display: "flex", justifyContent: "center", gap: "50px", marginTop: "20px" }}>
            <div style={{ textAlign: "center" }}>
              <DashboardTwoTone twoToneColor="#1677ff" style={{ fontSize: "36px", marginBottom: "12px" }} />
              <div style={{ color: "#8c8c8c", fontSize: "14px", fontWeight: 500 }}>Trực quan</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <CheckCircleTwoTone twoToneColor="#52c41a" style={{ fontSize: "36px", marginBottom: "12px" }} />
              <div style={{ color: "#8c8c8c", fontSize: "14px", fontWeight: 500 }}>Chính xác</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <SafetyCertificateTwoTone twoToneColor="#faad14" style={{ fontSize: "36px", marginBottom: "12px" }} />
              <div style={{ color: "#8c8c8c", fontSize: "14px", fontWeight: 500 }}>Bảo mật</div>
            </div>
          </div>

        </div>
      </div>
    </AdminLayout>
  );
}