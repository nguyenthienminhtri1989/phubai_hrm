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
  { value: "HR_MANAGER", label: "Quản lý nhân sự", color: "blue" },
  { value: "LEADER", label: "Xem báo cáo", color: "purple" },
  { value: "TIMEKEEPER", label: "Người chấm công", color: "green" },
  { value: "STAFF", label: "Nhân viên", color: "brown" }, // Role mới
];

export default function UserManagementPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // State quản lý Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const [form] = Form.useForm();

  // Theo dõi giá trị Role đang chọn để hiện ẩn ô Phòng ban
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
    setEditingUser(null);
    form.resetFields();
    form.setFieldValue("role", "STAFF"); // Mặc định role STAFF cho an toàn
    setIsModalOpen(true);
  };

  // 3. Mở Modal ở chế độ SỬA
  const handleOpenEdit = (record: any) => {
    setEditingUser(record);
    form.setFieldsValue({
      username: record.username,
      fullName: record.fullName,
      role: record.role,
      departmentIds: record.managedDepartments.map((d: any) => d.id),
      password: "",
    });
    setIsModalOpen(true);
  };

  // 4. Xử lý Lưu
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (res.ok) {
        message.success(editingUser ? "Cập nhật thành công!" : "Tạo tài khoản thành công!");
        setIsModalOpen(false);
        fetchData();
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
      title: "Phòng ban phụ trách",
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
          <Tooltip title="Sửa thông tin">
            <Button
              icon={<EditOutlined />}
              size="small"
              type="primary"
              ghost
              onClick={() => handleOpenEdit(record)}
              disabled={record.username === "admin"}
            />
          </Tooltip>

          <Popconfirm
            title="Bạn chắc chắn muốn xóa?"
            onConfirm={() => handleDelete(record.id)}
            disabled={record.username === "admin" || record.username === session?.user?.username}
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              size="small"
              disabled={record.username === "admin" || record.username === session?.user?.username}
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
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
        <h2>Quản lý Tài khoản hệ thống</h2>
        <Button type="primary" icon={<UserAddOutlined />} onClick={handleOpenAdd}>
          Tạo tài khoản mới
        </Button>
      </div>

      <Table dataSource={users} columns={columns} rowKey="id" loading={loading} bordered />

      <Modal
        title={editingUser ? "Cập nhật tài khoản" : "Tạo tài khoản mới"}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => setIsModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true }]}>
            <Input placeholder="VD: nv_to1" disabled={!!editingUser} />
          </Form.Item>

          <Form.Item
            name="password"
            label={editingUser ? "Mật khẩu mới (Để trống nếu không đổi)" : "Mật khẩu"}
            rules={[{ required: !editingUser, message: "Vui lòng nhập mật khẩu" }]}
          >
            <Input.Password placeholder={editingUser ? "Nhập mật khẩu mới..." : "Nhập mật khẩu"} />
          </Form.Item>

          <Form.Item name="fullName" label="Họ và tên hiển thị" rules={[{ required: true }]}>
            <Input placeholder="VD: Nguyễn Văn A" />
          </Form.Item>

          <Form.Item name="role" label="Vai trò" rules={[{ required: true }]}>
            <Select options={ROLES} />
          </Form.Item>

          {/* [QUAN TRỌNG] Logic hiển thị ô chọn phòng ban */}
          {/* Hiện nếu là TIMEKEEPER (để chấm công) HOẶC STAFF (để xem dữ liệu/nhập OT) */}
          {["TIMEKEEPER", "STAFF"].includes(selectedRole) && (
            <Form.Item
              name="departmentIds"
              label={selectedRole === "TIMEKEEPER" ? "Phân quyền chấm công" : "Phòng ban được xem dữ liệu"}
              rules={[{ required: true, message: "Vui lòng chọn ít nhất 1 phòng ban" }]}
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