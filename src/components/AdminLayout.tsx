"use client";

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
  Modal,
  Form,
  Input,
} from "antd";
import {
  ApartmentOutlined,
  TeamOutlined,
  BankOutlined,
  UnorderedListOutlined,
  FormOutlined,
  LogoutOutlined,
  TableOutlined,
  DashboardOutlined,
  UserOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  DownOutlined,
  QuestionCircleOutlined,
  AppstoreOutlined,
  CloudDownloadOutlined,
  LockOutlined,
  ImportOutlined,
  SettingOutlined,
  FieldTimeOutlined,
  KeyOutlined,
  BarChartOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import saveAs from "file-saver";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const { Header, Sider, Content, Footer } = Layout;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();

  // --- STATE CHO ĐỔI MẬT KHẨU ---
  const [isChangePassOpen, setIsChangePassOpen] = useState(false);
  const [passForm] = Form.useForm();
  const [passLoading, setPassLoading] = useState(false);

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // 1. Hàm xử lý Đăng xuất
  const handleLogout = () => {
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

  // 3. Hàm xử lý Đổi mật khẩu
  const handleChangePassword = async (values: any) => {
    setPassLoading(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (res.ok) {
        message.success("Đổi mật khẩu thành công! Vui lòng đăng nhập lại.");
        setIsChangePassOpen(false);
        passForm.resetFields();
        signOut({ callbackUrl: "/login" }); // Đăng xuất để user đăng nhập lại
      } else {
        message.error(data.error || "Có lỗi xảy ra");
      }
    } catch (error) {
      message.error("Lỗi kết nối server");
    } finally {
      setPassLoading(false);
    }
  };

  // 4. Menu User xổ xuống
  const userMenuItems = [
    {
      key: "info",
      label: (
        <div style={{ padding: "4px 8px", cursor: "default" }}>
          <div style={{ fontWeight: "bold" }}>
            {session?.user?.fullName || session?.user?.name || session?.user?.username}
          </div>
          <div style={{ fontSize: 12, color: "#666" }}>
            {session?.user?.role}
          </div>
        </div>
      ),
      disabled: true,
    },
    { type: "divider" as const },
    {
      key: "change-pass",
      icon: <KeyOutlined />,
      label: "Đổi mật khẩu",
      onClick: () => setIsChangePassOpen(true),
    },
    { type: "divider" as const },
    {
      key: "logout",
      danger: true,
      icon: <LogoutOutlined />,
      label: "Đăng xuất",
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider trigger={null} collapsible collapsed={collapsed}>
        {/* --- [SỬA ĐỔI] BỌC LINK QUANH LOGO ĐỂ VỀ TRANG CHỦ --- */}
        <Link href="/">
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
              cursor: "pointer", // Hiển thị hình bàn tay khi rê chuột
              borderRadius: "6px", // Bo góc nhẹ cho logo nhìn mượt hơn
              transition: "background 0.3s", // Hiệu ứng chuyển màu mượt mà
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)")}
          >
            {collapsed ? "PB" : "PHU BAI HRM"}
          </div>
        </Link>

        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={[pathname]}
          items={[
            {
              key: "catalog-management",
              icon: <AppstoreOutlined />,
              label: "Danh mục",
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
              key: "/evaluations/monthly",
              icon: <FormOutlined />,
              label: <Link href="/evaluations/monthly">Xếp loại A,B,C</Link>,
            },
            {
              key: "/timesheets/monthly",
              icon: <TableOutlined />,
              label: <Link href="/timesheets/monthly">Tổng hợp công</Link>,
            },
            {
              key: "/bravo-data",
              icon: <DownloadOutlined />,
              label: <Link href="/bravo-data">Xuất Excel BRAVO</Link>,
            },
            {
              key: "/overtime",
              icon: <FieldTimeOutlined />,
              label: <Link href="/overtime">Làm thêm giờ</Link>,
            },
            {
              key: "/dashboard",
              icon: <DashboardOutlined />,
              label: <Link href="/dashboard">Tổng quan</Link>,
            },
            {
              key: "/dashboard/departments",
              icon: <UnorderedListOutlined />,
              label: (
                <Link href="/dashboard/departments">Tình hình lao động</Link>
              ),
            },
            {
              key: "/evaluations/yearly",
              icon: <BarChartOutlined />,
              label: (
                <Link href="/evaluations/yearly">Tổng hợp năm</Link>
              ),
            },

            // --- [SỬA ĐỔI QUAN TRỌNG TẠI ĐÂY] ---
            // Hiện Menu Quản trị nếu là ADMIN HOẶC HR_MANAGER
            ...(["ADMIN", "HR_MANAGER"].includes(session?.user?.role as string)
              ? [
                {
                  key: "admin-management",
                  icon: <SettingOutlined />,
                  label: "Quản trị",
                  children: [
                    // Người dùng: Chỉ hiển thị cho ADMIN
                    ...(session?.user?.role === "ADMIN"
                      ? [
                        {
                          key: "/admin/users",
                          icon: <UserOutlined />,
                          label: <Link href="/admin/users">Người dùng</Link>,
                        },
                      ]
                      : []),

                    // Khóa sổ: Cả ADMIN và HR_MANAGER đều thấy
                    {
                      key: "/admin/lock-rules",
                      icon: <LockOutlined />,
                      label: <Link href="/admin/lock-rules">Khóa sổ</Link>,
                    },

                    // Import: Chỉ hiển thị cho ADMIN
                    ...(session?.user?.role === "ADMIN"
                      ? [
                        {
                          key: "/admin/employees/import",
                          icon: <ImportOutlined />,
                          label: <Link href="/admin/employees/import">Import</Link>,
                        },
                      ]
                      : []),
                  ],
                },
              ]
              : []),
            // ------------------------------------

            {
              key: "/help",
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

          <div style={{ display: "flex", alignItems: "center" }}>
            {/* Nút Backup (Chỉ Admin) */}
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

            {/* Dropdown User */}
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
                  {session?.user?.fullName || session?.user?.name || "Người dùng"}{" "}
                  <DownOutlined style={{ fontSize: 10 }} />
                </span>
              </div>
            </Dropdown>
          </div>
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

        {/* --- MODAL ĐỔI MẬT KHẨU --- */}
        <Modal
          title="Đổi mật khẩu cá nhân"
          open={isChangePassOpen}
          onCancel={() => {
            setIsChangePassOpen(false);
            passForm.resetFields();
          }}
          onOk={() => passForm.submit()}
          confirmLoading={passLoading}
          okText="Xác nhận"
          cancelText="Hủy"
        >
          <Form form={passForm} layout="vertical" onFinish={handleChangePassword}>
            <Form.Item
              name="oldPassword"
              label="Mật khẩu hiện tại"
              rules={[{ required: true, message: "Vui lòng nhập mật khẩu cũ" }]}
            >
              <Input.Password placeholder="Nhập mật khẩu cũ..." />
            </Form.Item>

            <Form.Item
              name="newPassword"
              label="Mật khẩu mới"
              rules={[
                { required: true, message: "Vui lòng nhập mật khẩu mới" },
                { min: 6, message: "Mật khẩu phải từ 6 ký tự" },
              ]}
            >
              <Input.Password placeholder="Nhập mật khẩu mới..." />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label="Nhập lại mật khẩu mới"
              dependencies={["newPassword"]}
              rules={[
                { required: true, message: "Vui lòng nhập lại mật khẩu" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("newPassword") === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error("Mật khẩu nhập lại không khớp!"));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="Xác nhận mật khẩu mới..." />
            </Form.Item>
          </Form>
        </Modal>
      </Layout>
    </Layout>
  );
}