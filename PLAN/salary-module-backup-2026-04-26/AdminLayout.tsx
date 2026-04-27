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
  Upload,
  ConfigProvider,
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
  CloudUploadOutlined,
  LockOutlined,
  ImportOutlined,
  SettingOutlined,
  FieldTimeOutlined,
  KeyOutlined,
  BarChartOutlined,
  DownloadOutlined,
  QrcodeOutlined,
  PieChartOutlined,
  DollarOutlined,
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

  // --- STATE CHO RESTORE DATABASE ---
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

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

  // 3. Hàm xử lý Restore
  const handleRestore = async () => {
    if (!restoreFile) {
      message.warning("Vui lòng chọn file SQL để khôi phục!");
      return;
    }
    setRestoreLoading(true);
    const hide = message.loading("Đang khôi phục dữ liệu...", 0);
    try {
      const formData = new FormData();
      formData.append("file", restoreFile);
      const res = await fetch("/api/system/restore", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Lỗi server khi restore");
      }
      message.success("Khôi phục dữ liệu thành công!");
      setIsRestoreOpen(false);
      setRestoreFile(null);
    } catch (error: any) {
      message.error(error.message);
    } finally {
      hide();
      setRestoreLoading(false);
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

        <ConfigProvider
          theme={{
            components: {
              Menu: {
                darkItemHoverBg: "#1677ff", // Màu nền xanh sáng khi rê chuột
                darkItemHoverColor: "#ffffff", // Chữ màu trắng khi rê chuột
                darkItemSelectedBg: "#003a8c", // Màu nền đậm hơn cho menu đang được chọn (Active)
              },
            },
          }}
        >
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
                key: "cong-tang-cuong",
                icon: <AppstoreOutlined />,
                label: "Công tăng cường",
                children: [
                  {
                    key: "/extra-timesheets/daily",
                    icon: <TeamOutlined />,
                    label: <Link href="/extra-timesheets/daily">Chấm công tăng cường</Link>,
                  },
                  {
                    key: "/extra-timesheets/monthly",
                    icon: <UnorderedListOutlined />,
                    label: <Link href="/extra-timesheets/monthly">Tổng hợp công tăng cường</Link>,
                  },
                ],
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
              {
                key: "statistics",
                icon: <PieChartOutlined />,
                label: "Thống kê",
                children: [
                  {
                    key: "/dashboard/statistics/employee",
                    icon: <TeamOutlined />,
                    label: <Link href="/dashboard/statistics/employee">Lao động</Link>,
                  },
                ],
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
                          // Backup Database: Chỉ ADMIN
                          {
                            key: "backup-db",
                            icon: <CloudDownloadOutlined />,
                            label: <span onClick={handleDownloadBackup} style={{ cursor: "pointer" }}>Backup DB</span>,
                          },
                          // Restore Database: Chỉ ADMIN
                          {
                            key: "restore-db",
                            icon: <CloudUploadOutlined />,
                            label: <span onClick={() => setIsRestoreOpen(true)} style={{ cursor: "pointer" }}>Restore DB</span>,
                          },
                        ]
                        : []),
                    ],
                  },
                ]
                : []),
              // ------------------------------------

              // --- MENU TIỀN LƯƠNG (ADMIN + HR_MANAGER) ---
              ...(["ADMIN", "HR_MANAGER"].includes(session?.user?.role as string)
                ? [
                    {
                      key: "salary-group",
                      icon: <DollarOutlined />,
                      label: "Tiền lương",
                      children: [
                        {
                          key: "/salary/calculate",
                          label: <Link href="/salary/calculate">Tính lương</Link>,
                        },
                        {
                          key: "/salary/performance",
                          label: <Link href="/salary/performance">Kết quả tháng</Link>,
                        },
                        {
                          key: "/salary/advance",
                          label: <Link href="/salary/advance">Tạm ứng</Link>,
                        },
                        {
                          key: "/salary/employee-info",
                          label: <Link href="/salary/employee-info">Thông tin lương NV</Link>,
                        },
                        {
                          key: "/salary/config",
                          label: <Link href="/salary/config">Cấu hình lương</Link>,
                        },
                      ],
                    },
                  ]
                : []),
              // -------------------------------------------

              {
                key: "tienich-group",
                icon: <FormOutlined />,
                label: "Tiện ích",
                children: [
                  {
                    key: "/help",
                    icon: <QuestionCircleOutlined />,
                    label: <Link href="/help">Hướng dẫn</Link>,
                  },
                  {
                    key: "/timesheets/daily-mobile",
                    icon: <FormOutlined />,
                    label: <Link href="/timesheets/daily-mobile">Mobile</Link>,
                  },
                  {
                    key: "/timesheets/daily-mobile/qr-generator",
                    icon: <QrcodeOutlined />,
                    label: <Link href="/timesheets/daily-mobile/qr-generator">Tạo QR Chấm công</Link>,
                  },
                ],
              },

            ]}
          />
        </ConfigProvider>
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

        {/* --- MODAL RESTORE DATABASE --- */}
        <Modal
          title="Khôi phục Database"
          open={isRestoreOpen}
          onCancel={() => {
            setIsRestoreOpen(false);
            setRestoreFile(null);
          }}
          onOk={handleRestore}
          confirmLoading={restoreLoading}
          okText="Khôi phục"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
        >
          <div style={{ marginBottom: 12, color: "#d4380d", fontWeight: 500 }}>
            ⚠️ Cảnh báo: Thao tác này sẽ ghi đè toàn bộ dữ liệu hiện tại!
          </div>
          <Upload
            accept=".sql"
            maxCount={1}
            beforeUpload={(file) => {
              setRestoreFile(file);
              return false; // Ngăn upload tự động
            }}
            onRemove={() => setRestoreFile(null)}
            fileList={restoreFile ? [{ uid: "-1", name: restoreFile.name, status: "done" }] : []}
          >
            <Button icon={<CloudUploadOutlined />}>Chọn file SQL</Button>
          </Upload>
          {restoreFile && (
            <div style={{ marginTop: 8, color: "#52c41a" }}>
              ✅ Đã chọn: <strong>{restoreFile.name}</strong>
            </div>
          )}
        </Modal>
      </Layout>
    </Layout>
  );
}