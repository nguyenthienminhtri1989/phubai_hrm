"use client";

import React, { useState } from "react";
import { Form, Input, Button, Card, message, Typography } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { signIn } from "next-auth/react"; // Hàm đăng nhập của client
import { useRouter } from "next/navigation";
import Image from "next/image";

const { Title } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // Gọi hàm đăng nhập của NextAuth
      const result = await signIn("credentials", {
        username: values.username,
        password: values.password,
        redirect: false, // Không tự chuyển trang để mình tự xử lý
      });

      if (result?.error) {
        message.error("Đăng nhập thất bại: Sai tài khoản hoặc mật khẩu");
      } else {
        message.success("Đăng nhập thành công!");
        router.push("/dashboard"); // Chuyển hướng vào trong
        router.refresh();
      }
    } catch (error) {
      message.error("Lỗi hệ thống");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(135deg, #1890ff 0%, #001529 100%)", // Màu xanh công nghiệp
      }}
    >
      <Card
        style={{
          width: 400,
          borderRadius: 10,
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}
      >
        <div
          style={{
            display: "flex", // 1. Kích hoạt Flexbox
            flexDirection: "column", // 2. Xếp các phần tử theo chiều dọc
            alignItems: "center", // 3. Căn giữa theo chiều ngang (Quan trọng!)
            marginBottom: 24,
          }}
        >
          <Image
            src="/image/logo/LogoSPB.png"
            alt="Logo"
            width={60} // Chỉnh độ rộng tùy ý
            height={60} // Chỉnh độ cao tùy ý
            style={{
              objectFit: "contain",
              marginBottom: 16, // Khoảng cách với dòng chữ dưới
            }}
            priority
          />
          <Title level={3} style={{ margin: 0 }}>
            QUẢN LÝ CHẤM CÔNG
          </Title>
          <div style={{ color: "#888" }}>Công ty Cổ phần Sợi Phú Bài</div>
        </div>

        <Form name="login" onFinish={onFinish} layout="vertical" size="large">
          <Form.Item
            name="username"
            rules={[{ required: true, message: "Vui lòng nhập tài khoản!" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Tài khoản" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: "Vui lòng nhập mật khẩu!" }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              ĐĂNG NHẬP
            </Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: "center", fontSize: 12, color: "#999" }}>
          © 2025 Phu Bai Spinning. Designed by Mr.Tri
        </div>
      </Card>
    </div>
  );
}
