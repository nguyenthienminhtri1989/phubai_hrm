// src/components/AdminLayout.tsx
"use client"; // Vì layout có tương tác (click menu) nên phải là Client Component

import React, { useState } from "react";
import {
  ApartmentOutlined,
  TeamOutlined,
  BankOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { Layout, Menu, theme } from "antd";
import { useRouter, usePathname } from "next/navigation"; // Dùng để chuyển trang trong Next.js

const { Header, Content, Footer, Sider } = Layout;

// Định nghĩa các mục trong Menu
const items = [
  { key: "/factories", icon: <BankOutlined />, label: "Quản lý Nhà máy" },
  {
    key: "/departments",
    icon: <ApartmentOutlined />,
    label: "Quản lý Phòng ban",
  },
  { key: "/employees", icon: <TeamOutlined />, label: "Quản lý Nhân viên" },
  {
    key: "/attendance-codes",
    icon: <UnorderedListOutlined />,
    label: "Danh mục chấm công",
  },
];

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const router = useRouter(); // Khởi tạo router
  const pathname = usePathname(); // <--- Lấy đường dẫn hiện tại (VD: /departments)

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* SIDER: Thanh bên trái */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
      >
        <div
          style={{
            height: 32,
            margin: 16,
            background: "rgba(255, 255, 255, 0.2)",
            textAlign: "center",
            color: "white",
            lineHeight: "32px",
            fontWeight: "bold",
          }}
        >
          PHU BAI APP
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          items={items}
          // Sự kiện khi click vào menu
          onClick={(info) => {
            router.push(info.key); // Chuyển hướng đến trang tương ứng
          }}
        />
      </Sider>

      {/* CONTENT: Phần nội dung bên phải */}
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }} />
        <Content style={{ margin: "0 16px" }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              marginTop: 16,
            }}
          >
            {children} {/* Nội dung của từng trang sẽ hiện ở đây */}
          </div>
        </Content>
        <Footer style={{ textAlign: "center" }}>
          HR Management ©2025 Created by Nguyen Thien Minh Tri
        </Footer>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
