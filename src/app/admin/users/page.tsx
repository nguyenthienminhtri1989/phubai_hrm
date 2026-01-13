"use client";

import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  message,
  Popconfirm,
  Space,
  Tooltip,
} from "antd";
import {
  UserAddOutlined,
  DeleteOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { useSession } from "next-auth/react";

const ROLES = [
  { value: "ADMIN", label: "Quản trị hệ thống (Admin)", color: "red" },
  { value: "HR_MANAGER", label: "Quản lý chấm công", color: "blue" },
  { value: "LEADER", label: "Xem báo cáo", color: "purple" },
  { value: "TIMEKEEPER", label: "Người chấm công", color: "green" },
];

export default function UserManagementPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // State quản lý Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null); // null = Chế độ Thêm, có object = Chế độ Sửa

  const [form] = Form.useForm();
  const selectedRole = Form.useWatch("role", form);

  // 1. Tải dữ liệu
  const fetchData = async () => {
    setLoading(true);
    try {
      const [userRes, deptRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/departments"),
      ]);
      if (userRes.ok) setUsers(await userRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());
    } catch (error) {
      message.error("Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. Mở Modal ở chế độ THÊM MỚI
  const handleOpenAdd = () => {
    setEditingUser(null); // Xóa user đang sửa
    form.resetFields(); // Xóa trắng form
    form.setFieldValue("role", "TIMEKEEPER"); // Mặc định role
    setIsModalOpen(true);
  };

  // 3. Mở Modal ở chế độ SỬA
  const handleOpenEdit = (record: any) => {
    setEditingUser(record);
    // Đổ dữ liệu cũ vào form
    form.setFieldsValue({
      username: record.username,
      fullName: record.fullName,
      role: record.role,
      // Map danh sách object phòng ban thành mảng ID: [1, 3]
      departmentIds: record.managedDepartments.map((d: any) => d.id),
      password: "", // Mật khẩu để trống (chỉ nhập nếu muốn đổi)
    });
    setIsModalOpen(true);
  };

  // 4. Xử lý Lưu (Chung cho cả Thêm và Sửa)
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Nếu là Sửa -> PUT, Nếu là Thêm -> POST
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (res.ok) {
        message.success(
          editingUser ? "Cập nhật thành công!" : "Tạo tài khoản thành công!"
        );
        setIsModalOpen(false);
        fetchData(); // Tải lại bảng
      } else {
        const err = await res.json();
        message.error(err.error || "Có lỗi xảy ra");
      }
    } catch (error) {
      console.log(error);
    }
  };

  // 5. Xử lý Xóa
  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      message.success("Đã xóa user");
      fetchData();
    } else {
      const err = await res.json();
      message.error(err.error);
    }
  };

  const columns = [
    {
      title: "Tài khoản",
      dataIndex: "username",
      key: "username",
      render: (text: string) => <b>{text}</b>,
    },
    {
      title: "Họ và tên",
      dataIndex: "fullName",
      key: "fullName",
    },
    {
      title: "Vai trò",
      dataIndex: "role",
      key: "role",
      render: (role: string) => {
        const r = ROLES.find((i) => i.value === role);
        return <Tag color={r?.color}>{r?.label || role}</Tag>;
      },
    },
    {
      title: "Phòng ban quản lý",
      dataIndex: "managedDepartments",
      key: "depts",
      render: (depts: any[]) => (
        <div>
          {depts && depts.length > 0 ? (
            depts.map((d) => <Tag key={d.id}>{d.name}</Tag>)
          ) : (
            <span style={{ color: "#999" }}>-</span>
          )}
        </div>
      ),
    },
    {
      title: "Hành động",
      key: "action",
      render: (_: any, record: any) => (
        <Space>
          {/* NÚT SỬA */}
          <Tooltip title="Sửa thông tin">
            <Button
              icon={<EditOutlined />}
              size="small"
              type="primary"
              ghost
              onClick={() => handleOpenEdit(record)}
              disabled={record.username === "admin"} // Không cho sửa admin gốc (nếu muốn)
            />
          </Tooltip>

          {/* NÚT XÓA */}
          <Popconfirm
            title="Bạn chắc chắn muốn xóa?"
            onConfirm={() => handleDelete(record.id)}
            disabled={
              record.username === "admin" ||
              record.username === session?.user?.username
            }
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              size="small"
              disabled={
                record.username === "admin" ||
                record.username === session?.user?.username
              }
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (session?.user?.role !== "ADMIN") {
    return (
      <AdminLayout>
        <div>Bạn không có quyền truy cập trang này.</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <h2>Quản lý Tài khoản hệ thống</h2>
        <Button
          type="primary"
          icon={<UserAddOutlined />}
          onClick={handleOpenAdd} // Gọi hàm mở modal thêm mới
        >
          Tạo tài khoản mới
        </Button>
      </div>

      <Table
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={loading}
        bordered
      />

      <Modal
        title={editingUser ? "Cập nhật tài khoản" : "Tạo tài khoản mới"}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => setIsModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="username"
            label="Tên đăng nhập"
            rules={[{ required: true }]}
          >
            {/* Khi sửa thì không cho đổi Username để tránh lỗi hệ thống */}
            <Input placeholder="VD: soi1_leader" disabled={!!editingUser} />
          </Form.Item>

          <Form.Item
            name="password"
            label={
              editingUser ? "Mật khẩu mới (Để trống nếu không đổi)" : "Mật khẩu"
            }
            rules={[
              { required: !editingUser, message: "Vui lòng nhập mật khẩu" },
            ]}
          >
            <Input.Password
              placeholder={
                editingUser ? "Nhập mật khẩu mới..." : "Nhập mật khẩu"
              }
            />
          </Form.Item>

          <Form.Item
            name="fullName"
            label="Họ và tên hiển thị"
            rules={[{ required: true }]}
          >
            <Input placeholder="VD: Nguyễn Văn A" />
          </Form.Item>

          <Form.Item name="role" label="Vai trò" rules={[{ required: true }]}>
            <Select options={ROLES} />
          </Form.Item>

          {/* Chỉ hiện chọn phòng ban nếu Role là TIMEKEEPER */}
          {selectedRole === "TIMEKEEPER" && (
            <Form.Item
              name="departmentIds"
              label="Phân quyền chấm công"
              rules={[
                {
                  required: true,
                  message: "Vui lòng chọn ít nhất 1 phòng ban",
                },
              ]}
            >
              <Select
                mode="multiple"
                placeholder="Chọn phòng ban..."
                optionFilterProp="children"
                allowClear
                style={{ width: "100%" }}
              >
                {departments.map((d) => (
                  <Select.Option key={d.id} value={d.id}>
                    {d.name} ({d.factory?.name})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </AdminLayout>
  );
}
