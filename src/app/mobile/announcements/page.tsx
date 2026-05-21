"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Empty, Spin, message, Button } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Quản trị viên",
  HR_MANAGER: "Quản lý nhân sự",
  TIMEKEEPER: "Người chấm công",
  LEADER: "Ban lãnh đạo",
  STAFF: "Nhân viên",
};

interface Announcement {
  id: number;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  author: { fullName: string | null; role: string };
}

const PAGE_SIZE = 10;

export default function MobileAnnouncementsPage() {
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchPage = async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/announcements?page=${p}&limit=${PAGE_SIZE}`);
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || "Lỗi tải dữ liệu");
        return;
      }
      setTotal(data.total || 0);
      setList((prev) => (p === 1 ? data.items : [...prev, ...data.items]));
    } catch {
      message.error("Lỗi kết nối server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage(1);
  }, []);

  const hasMore = list.length < total;
  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPage(next);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        maxWidth: 480,
        margin: "0 auto",
        background: "linear-gradient(160deg, #fff1f0 0%, #fafafa 60%, #fff 100%)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #f5222d 0%, #cf1322 100%)",
          color: "#fff",
          padding: "20px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderRadius: "0 0 20px 20px",
          boxShadow: "0 3px 12px rgba(245,34,45,0.25)",
        }}
      >
        <Link href="/mobile" style={{ color: "#fff", display: "flex", alignItems: "center" }}>
          <ArrowLeftOutlined style={{ fontSize: 20 }} />
        </Link>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Thông báo nội bộ</div>
      </div>

      {/* Body */}
      <div style={{ padding: "16px 12px", flex: 1 }}>
        {loading && list.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin />
          </div>
        ) : list.length === 0 ? (
          <Empty description="Chưa có thông báo nào" style={{ padding: 40 }} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {list.map((a) => (
              <div
                key={a.id}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: 16,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  borderLeft: "4px solid #f5222d",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: "#1a1a1a" }}>
                  📢 {a.title}
                </div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>
                  {dayjs(a.createdAt).format("DD/MM/YYYY · HH:mm")}
                  {" — "}
                  {a.author?.fullName || "Ẩn danh"}{" "}
                  ({ROLE_LABELS[a.author?.role] || a.author?.role})
                </div>
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    color: "#333",
                  }}
                >
                  {a.content}
                </div>
                {a.imageUrl && (
                  <img
                    src={a.imageUrl}
                    alt={a.title}
                    style={{
                      width: "100%",
                      marginTop: 10,
                      borderRadius: 10,
                      objectFit: "cover",
                      maxHeight: 360,
                    }}
                  />
                )}
              </div>
            ))}

            {hasMore && (
              <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                <Button onClick={loadMore} loading={loading}>
                  Xem thêm
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
