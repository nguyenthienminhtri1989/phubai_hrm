"use client"; // Đảm bảo dòng này ở đầu

import React, { useState } from "react";
import {
  Layout,
  Menu,
  theme,
  Dropdown,
  Button,
  Avatar,
  Typography,
  message,
  Tooltip,
} from "antd";
import {
  ApartmentOutlined,
  TeamOutlined,
  BankOutlined,
  UnorderedListOutlined,
  FormOutlined,
  LogoutOutlined, // <--- Import icon Logout
  TableOutlined,
  DashboardOutlined,
  UserOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  DownOutlined,
  QuestionCircleOutlined,
  AppstoreOutlined, // <-- Thêm cái này (biểu tượng 4 ô vuông)
  CloudDownloadOutlined, // Nút backup database
} from "@ant-design/icons";
import saveAs from "file-saver";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react"; // <--- Import từ next-auth

const { Header, Sider, Content, Footer } = Layout;
const { Text } = Typography;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession(); // <--- Lấy thông tin user đang đăng nhập

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // Xử lý Đăng xuất
  const handleLogout = () => {
    // callbackUrl: '/login' -> Đăng xuất xong đá về trang Login
    signOut({ callbackUrl: "/login" });
  };

  // 2. Hàm xử lý Backup
  const handleDownloadBackup = async () => {
    const hide = message.loading("Đang tạo bản backup...", 0);
    try {
      const res = await fetch("/api/system/backup");

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Lỗi server");
      }

      // Nhận Blob từ server và tải về
      const blob = await res.blob();
      const dateStr = new Date().toISOString().slice(0, 10);
      saveAs(blob, `backup_phubai_hrm_${dateStr}.sql`);

      message.success("Tải backup thành công!");
    } catch (error: any) {
      message.error(error.message);
    } finally {
      hide();
    }
  };

  // Menu xổ xuống khi bấm vào Avatar
  const userMenuItems = [
    {
      key: "1",
      label: (
        <div style={{ padding: "4px 8px" }}>
          <div style={{ fontWeight: "bold" }}>
            {session?.user?.name || session?.user?.username}
          </div>
          <div style={{ fontSize: 12, color: "#666" }}>
            {session?.user?.role}
          </div>
        </div>
      ),
    },
    {
      type: "divider" as const,
    },
    {
      key: "2",
      danger: true, // Màu đỏ cảnh báo
      icon: <LogoutOutlined />,
      label: "Đăng xuất",
      onClick: handleLogout, // Gắn hàm logout vào đây
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider trigger={null} collapsible collapsed={collapsed}>
        <div
          className="demo-logo-vertical"
          style={{
            height: 32,
            margin: 16,
            background: "rgba(255, 255, 255, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: "bold",
          }}
        >
          {collapsed ? "PB" : "PHU BAI HRM"}
        </div>

        {/* MENU BÊN TRÁI GIỮ NGUYÊN (Tôi chỉ viết gọn lại để bạn dễ nhìn) */}
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={[pathname]}
          items={[
            // 2. NHÓM QUẢN LÝ DANH MỤC
            {
              key: "catalog-management", // Key này tên tùy ý
              icon: <AppstoreOutlined />, // Icon cho menu cha
              label: "Danh mục", // Tên hiển thị menu cha
              children: [
                {
                  key: "/factories",
                  icon: <BankOutlined />,
                  label: <Link href="/factories">Nhà máy</Link>,
                },
                {
                  key: "/departments",
                  icon: <ApartmentOutlined />,
                  label: <Link href="/departments">Phòng ban</Link>,
                },
                {
                  key: "/employees",
                  icon: <TeamOutlined />,
                  label: <Link href="/employees">Nhân viên</Link>,
                },
                {
                  key: "/attendance-codes",
                  icon: <UnorderedListOutlined />,
                  label: <Link href="/attendance-codes">Ký hiệu</Link>,
                },
              ],
            },
            {
              key: "/timesheets/daily",
              icon: <FormOutlined />,
              label: <Link href="/timesheets/daily">Chấm công</Link>,
            },
            {
              key: "/timesheets/monthly",
              icon: <TableOutlined />,
              label: <Link href="/timesheets/monthly">Tổng hợp công</Link>,
            },
            {
              key: "/dashboard",
              icon: <DashboardOutlined />,
              label: <Link href="/dashboard">Tổng quan</Link>,
            },
            {
              key: "/dashboard/departments",
              icon: <UnorderedListOutlined />, // Icon dạng danh sách
              label: (
                <Link href="/dashboard/departments">Chi tiết bộ phận</Link>
              ),
            },
            // Chỉ hiện User nếu là ADMIN
            ...(session?.user?.role === "ADMIN"
              ? [
                  {
                    key: "/admin/users",
                    icon: <UserOutlined />,
                    label: <Link href="/admin/users">Người dùng</Link>,
                  },
                ]
              : []),
            {
              key: "/help", // Đường dẫn khớp với folder bạn vừa tạo
              icon: <QuestionCircleOutlined />,
              label: <Link href="/help">Hướng dẫn</Link>,
            },
          ]}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            padding: 0,
            background: colorBgContainer,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingRight: 24,
          }}
        >
          {/* Nút Toggle Menu */}
          <div
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: "16px",
              width: 64,
              height: 64,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>

          {/* // 3. HIỂN THỊ NÚT (Chèn vào nơi bạn muốn, ví dụ trong Header) */}
          {/* Chỉ hiện nếu là ADMIN */}
          {session?.user?.role === "ADMIN" && (
            <Tooltip title="Sao lưu Dữ liệu">
              <Button
                type="text"
                icon={
                  <CloudDownloadOutlined
                    style={{ fontSize: 20, color: "#1890ff" }}
                  />
                }
                onClick={handleDownloadBackup}
                style={{ marginRight: 15 }}
              >
                Backup DB
              </Button>
            </Tooltip>
          )}
          {/* --- PHẦN USER INFO & LOGOUT Ở GÓC PHẢI --- */}
          <Dropdown menu={{ items: userMenuItems }} trigger={["click"]}>
            <div
              style={{
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Avatar
                style={{ backgroundColor: "#1677ff" }}
                icon={<UserOutlined />}
              />
              <span style={{ fontWeight: 500 }}>
                {session?.user?.name || "Người dùng"}{" "}
                <DownOutlined style={{ fontSize: 10 }} />
              </span>
            </div>
          </Dropdown>
        </Header>

        <Content
          style={{
            margin: "24px 16px",
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          {children}
        </Content>
        <Footer style={{ textAlign: "center" }}>
          Quản lý nhân sự ©2026 Thiết kế bởi Nguyễn Thiện Minh Trí
        </Footer>
      </Layout>
    </Layout>
  );
}
