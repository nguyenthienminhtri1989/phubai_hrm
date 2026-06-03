"use client";

import React from "react";
import { useSession, signOut } from "next-auth/react";
import { Button, Avatar, Spin } from "antd";
import { UserOutlined, LogoutOutlined, HomeOutlined } from "@ant-design/icons";
import Link from "next/link";

// Role map sang tiếng Việt
const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Quản trị viên",
  HR_MANAGER: "Quản lý nhân sự",
  TIMEKEEPER: "Người chấm công",
  LEADER: "Ban lãnh đạo",
  STAFF: "Nhân viên",
};

/**
 * ========================================================
 * HƯỚNG DẪN THÊM TRANG MOBILE MỚI
 * ========================================================
 * Khi phát triển thêm tính năng mobile, chỉ cần thêm 1 object
 * vào mảng MOBILE_FEATURES bên dưới theo cấu trúc:
 *
 * {
 *   key: "unique-key",          // string định danh duy nhất
 *   label: "Tên chức năng",     // hiển thị trên card
 *   description: "Mô tả ngắn", // dòng phụ trên card
 *   icon: "emoji",              // emoji hoặc React node
 *   href: "/đường-dẫn",        // URL của trang đó
 *   color: "#hexcolor",         // màu chủ đạo của card
 * }
 *
 * Không cần sửa bất kỳ chỗ nào khác — grid tự động render.
 * ========================================================
 */
const MOBILE_FEATURES = [
  {
    key: "daily",
    label: "Chấm công",
    description: "Chấm công hàng ngày",
    icon: "📋",
    href: "/timesheets/daily-mobile",
    color: "#1677ff",
  },
  {
    key: "monthly",
    label: "Tổng hợp tháng",
    description: "Xem công theo tháng",
    icon: "📅",
    href: "/mobile/timesheet",
    color: "#52c41a",
  },
  {
    key: "yearly",
    label: "Tổng hợp năm",
    description: "Xem công theo năm",
    icon: "📊",
    href: "/mobile/yearly",
    color: "#fa8c16",
  },
  {
    key: "evaluation",
    label: "Xếp loại",
    description: "Xếp loại nhân viên",
    icon: "🏆",
    href: "/evaluations/mobile",
    color: "#722ed1",
  },
  {
    key: "announcements",
    label: "Thông báo",
    description: "Thông báo nội bộ",
    icon: "📢",
    href: "/mobile/announcements",
    color: "#f5222d",
  },
];

export default function MobileHomePage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <Spin size="large" />
      </div>
    );
  }

  const userName = session?.user?.fullName || session?.user?.name || "Bạn";
  const role = session?.user?.role as string | undefined;
  const roleLabel = role ? (ROLE_LABELS[role] || role) : "";

  return (
    <div style={{
      minHeight: "100vh",
      maxWidth: 480,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      background: "linear-gradient(160deg, #f0f5ff 0%, #fafafa 60%, #fff7e6 100%)",
    }}>

      {/* ── HEADER ── */}
      <div style={{
        background: "linear-gradient(135deg, #1677ff 0%, #0958d9 100%)",
        padding: "32px 20px 28px",
        color: "#fff",
        borderRadius: "0 0 28px 28px",
        boxShadow: "0 4px 20px rgba(22,119,255,0.25)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar size={52} icon={<UserOutlined />}
            style={{ background: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 2 }}>Xin chào 👋</div>
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userName}
            </div>
            {roleLabel && (
              <div style={{ fontSize: 12, marginTop: 4, background: "rgba(255,255,255,0.18)", display: "inline-block", padding: "2px 10px", borderRadius: 20, fontWeight: 500 }}>
                {roleLabel}
              </div>
            )}
          </div>
          <Link href="/">
            <Button
              icon={<HomeOutlined />}
              aria-label="Về trang chủ"
              style={{
                background: "rgba(255,255,255,0.2)", border: "none", color: "#fff",
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              }}
            />
          </Link>
        </div>
      </div>

      {/* ── SECTION LABEL ── */}
      <div style={{ padding: "20px 16px 8px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#888", letterSpacing: 0.8, textTransform: "uppercase" }}>
          Chức năng
        </div>
      </div>

      {/* ── FEATURE GRID ── */}
      <div style={{ padding: "0 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {MOBILE_FEATURES.map((feature) => (
          <Link key={feature.key} href={feature.href} style={{ textDecoration: "none" }}>
            <div style={{
              background: "#fff",
              borderRadius: 18,
              padding: "20px 16px 18px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
              border: `1.5px solid ${feature.color}22`,
              cursor: "pointer",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
              userSelect: "none",
              WebkitTapHighlightColor: "transparent",
            }}
              onMouseDown={e => (e.currentTarget.style.transform = "scale(0.96)")}
              onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
              onTouchStart={e => (e.currentTarget.style.transform = "scale(0.96)")}
              onTouchEnd={e => (e.currentTarget.style.transform = "scale(1)")}
            >
              {/* Icon circle */}
              <div style={{
                width: 52, height: 52, borderRadius: 16,
                background: `${feature.color}18`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 26, marginBottom: 12,
              }}>
                {feature.icon}
              </div>

              <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a1a", lineHeight: 1.3, marginBottom: 4 }}>
                {feature.label}
              </div>
              <div style={{ fontSize: 11, color: "#999", lineHeight: 1.4 }}>
                {feature.description}
              </div>

              {/* Color accent bar */}
              <div style={{ height: 3, borderRadius: 2, background: feature.color, marginTop: 12, opacity: 0.7 }} />
            </div>
          </Link>
        ))}
      </div>

      {/* ── SPACER ── */}
      <div style={{ flex: 1 }} />

      {/* ── FOOTER ── */}
      <div style={{ padding: "24px 20px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "#bbb", marginBottom: 14 }}>
          Phú Bài HRM · v1.0
        </div>
        <Button
          icon={<LogoutOutlined />}
          onClick={() => signOut({ callbackUrl: "/login" })}
          style={{
            borderRadius: 20, height: 38, paddingInline: 24,
            fontSize: 13, color: "#ff4d4f", borderColor: "#ffccc7",
          }}
        >
          Đăng xuất
        </Button>
      </div>
    </div>
  );
}
