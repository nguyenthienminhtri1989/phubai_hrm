"use client";

import React from "react";
import { Button, Card, Typography } from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";
import Link from "next/link";

const { Title, Paragraph } = Typography;

export default function PendingPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background:
          "linear-gradient(135deg, #f4f8fb 0%, #dcebf7 45%, #eef5e8 100%)",
      }}
    >
      <Card
        style={{
          width: "100%",
          maxWidth: 420,
          textAlign: "center",
          borderRadius: 8,
          boxShadow: "0 8px 24px rgba(22, 58, 82, 0.14)",
        }}
      >
        <ClockCircleOutlined style={{ fontSize: 48, color: "#1677ff" }} />
        <Title level={3} style={{ marginTop: 20, marginBottom: 12 }}>
          Yêu cầu đã được gửi!
        </Title>
        <Paragraph style={{ fontSize: 16, marginBottom: 24 }}>
          Tài khoản của bạn đang chờ Admin phê duyệt. Vui lòng liên hệ quản lý
          hoặc chờ thông báo.
        </Paragraph>
        <Link href="/login">
          <Button type="primary">Quay về trang đăng nhập</Button>
        </Link>
      </Card>
    </div>
  );
}
