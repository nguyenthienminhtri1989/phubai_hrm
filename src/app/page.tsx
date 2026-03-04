// src/app/page.tsx
"use client";
import AdminLayout from "@/components/AdminLayout";
import { useSession } from "next-auth/react";
import { Typography, Row, Col, Card, Tag } from "antd";
import Link from "next/link";
import {
  FormOutlined,
  TableOutlined,
  BarChartOutlined,
  DashboardOutlined,
  TeamOutlined,
  FieldTimeOutlined,
  DownloadOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  CalendarOutlined,
  BankOutlined,
  ApartmentOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

const MODULES = [
  {
    title: "Chấm công",
    desc: "Nhập & tra cứu dữ liệu chấm công hàng ngày",
    icon: <FormOutlined style={{ fontSize: 28 }} />,
    href: "/timesheets/daily",
    color: "#1677ff",
    bg: "#e6f4ff",
    tag: "Hàng ngày",
  },
  {
    title: "Tổng hợp công",
    desc: "Xem báo cáo tổng hợp công tháng theo phòng ban",
    icon: <TableOutlined style={{ fontSize: 28 }} />,
    href: "/timesheets/monthly",
    color: "#13c2c2",
    bg: "#e6fffb",
    tag: "Hàng tháng",
  },
  {
    title: "Xếp loại A,B,C",
    desc: "Đánh giá và xếp loại năng suất nhân viên theo tháng",
    icon: <BarChartOutlined style={{ fontSize: 28 }} />,
    href: "/evaluations/monthly",
    color: "#722ed1",
    bg: "#f9f0ff",
    tag: "Đánh giá",
  },
  {
    title: "Dashboard",
    desc: "Tổng quan tình hình nhân sự theo ngày toàn công ty",
    icon: <DashboardOutlined style={{ fontSize: 28 }} />,
    href: "/dashboard",
    color: "#eb2f96",
    bg: "#fff0f6",
    tag: "Thống kê",
  },
  {
    title: "Làm thêm giờ",
    desc: "Quản lý và theo dõi dữ liệu làm thêm giờ (OT)",
    icon: <FieldTimeOutlined style={{ fontSize: 28 }} />,
    href: "/overtime",
    color: "#fa8c16",
    bg: "#fff7e6",
    tag: "Tăng ca",
  },
  {
    title: "Công tăng cường",
    desc: "Chấm công và tổng hợp công tăng cường hàng tháng",
    icon: <AppstoreOutlined style={{ fontSize: 28 }} />,
    href: "/extra-timesheets/daily",
    color: "#52c41a",
    bg: "#f6ffed",
    tag: "Đặc biệt",
  },
  {
    title: "Tình hình lao động",
    desc: "Báo cáo chi tiết biến động nhân sự theo phòng ban",
    icon: <UnorderedListOutlined style={{ fontSize: 28 }} />,
    href: "/dashboard/departments",
    color: "#1890ff",
    bg: "#e6f7ff",
    tag: "Báo cáo",
  },
  {
    title: "Xuất Excel BRAVO",
    desc: "Xuất dữ liệu chấm công sang định dạng cho BRAVO",
    icon: <DownloadOutlined style={{ fontSize: 28 }} />,
    href: "/bravo-data",
    color: "#d48806",
    bg: "#fffbe6",
    tag: "Xuất dữ liệu",
  },
  {
    title: "Nhân viên",
    desc: "Quản lý hồ sơ và thông tin toàn bộ nhân viên",
    icon: <TeamOutlined style={{ fontSize: 28 }} />,
    href: "/employees",
    color: "#096dd9",
    bg: "#e6f4ff",
    tag: "Danh mục",
  },
];

function getTodayStr() {
  const now = new Date();
  const weekdays = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
  const day = weekdays[now.getDay()];
  return `${day}, ngày ${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`;
}

export default function Home() {
  const { data: session } = useSession();
  const userName = session?.user?.fullName || session?.user?.name || session?.user?.username || "bạn";

  return (
    <AdminLayout>
      {/* ===== HERO SECTION ===== */}
      <div
        style={{
          background: "linear-gradient(135deg, #003a8c 0%, #1677ff 60%, #40a9ff 100%)",
          borderRadius: "16px",
          padding: "40px 48px",
          marginBottom: 32,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 24,
          boxShadow: "0 8px 32px rgba(22, 119, 255, 0.25)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative circles */}
        <div style={{
          position: "absolute", right: -60, top: -60,
          width: 240, height: 240, borderRadius: "50%",
          background: "rgba(255,255,255,0.06)", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", right: 60, bottom: -80,
          width: 180, height: 180, borderRadius: "50%",
          background: "rgba(255,255,255,0.04)", pointerEvents: "none",
        }} />

        {/* Left: greeting */}
        <div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.15)", borderRadius: 50,
            padding: "4px 16px", marginBottom: 16,
            color: "#fff", fontSize: 14, fontWeight: 500,
          }}>
            <CalendarOutlined />
            {getTodayStr()}
          </div>
          <Title level={2} style={{ color: "#fff", margin: 0, fontWeight: 800, lineHeight: 1.3 }}>
            Xin chào, <span style={{ color: "#ffd666" }}>{userName}</span>!
          </Title>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 16, marginTop: 8, display: "block" }}>
            Chào mừng đến với Hệ thống Quản lý Nhân sự
          </Text>
        </div>

        {/* Right: company info */}
        <div style={{
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.25)",
          borderRadius: 12, padding: "16px 28px",
          textAlign: "center", backdropFilter: "blur(4px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", marginBottom: 6 }}>
            <BankOutlined style={{ fontSize: 24, color: "#ffd666" }} />
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>
              CÔNG TY CP SỢI PHÚ BÀI
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <ApartmentOutlined style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }} />
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
              Hệ thống HRM nội bộ
            </span>
          </div>
        </div>
      </div>

      {/* ===== QUICK ACCESS SECTION ===== */}
      <div style={{ marginBottom: 12 }}>
        <Title level={4} style={{ color: "#1d2939", margin: "0 0 20px 4px", fontWeight: 700 }}>
          Truy cập nhanh
        </Title>
        <Row gutter={[16, 16]}>
          {MODULES.map((mod) => (
            <Col xs={24} sm={12} md={8} lg={8} xl={6} key={mod.href}>
              <Link href={mod.href} style={{ display: "block" }}>
                <Card
                  hoverable
                  style={{
                    borderRadius: 12,
                    border: "1px solid #f0f0f0",
                    height: "100%",
                    transition: "all 0.25s ease",
                    cursor: "pointer",
                  }}
                  styles={{
                    body: { padding: "20px 22px" },
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${mod.color}33`;
                    (e.currentTarget as HTMLElement).style.borderColor = mod.color;
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    (e.currentTarget as HTMLElement).style.borderColor = "#f0f0f0";
                    (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 52, height: 52, borderRadius: 12,
                    background: mod.bg, color: mod.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 14,
                  }}>
                    {mod.icon}
                  </div>

                  {/* Title + Tag */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#1d2939" }}>{mod.title}</span>
                    <Tag color={mod.color} style={{ fontSize: 11, borderRadius: 50, margin: 0 }}>
                      {mod.tag}
                    </Tag>
                  </div>

                  {/* Description */}
                  <Text style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                    {mod.desc}
                  </Text>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      </div>
    </AdminLayout>
  );
}
