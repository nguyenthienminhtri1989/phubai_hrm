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
  Tabs,
  Badge,
} from "antd";
import {
  UserAddOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { useSession } from "next-auth/react";

const ROLES = [
  { value: "ADMIN", label: "Quản trị hệ thống (Admin)", color: "red" },
  { value: "HR_MANAGER", label: "Quản lý nhân sự", color: "blue" },
  { value: "LEADER", label: "Xem báo cáo", color: "purple" },
  { value: "TIMEKEEPER", label: "Người chấm công", color: "green" },
  { value: "STAFF", label: "Nhân viên", color: "brown" },
];

export default function UserManagementPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<any[]>([]);
  const [searchFullName, setSearchFullName] = useState("");
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedPendingRowKeys, setSelectedPendingRowKeys] = useState<React.Key[]>([]);
  const [approvalLoading, setApprovalLoading] = useState<"approve" | "reject" | null>(null);

  const [form] = Form.useForm();
  const selectedRole = Form.useWatch("role", form);
  const userRole = session?.user?.role;
  const canReviewUsers = ["ADMIN", "HR_MANAGER"].includes(userRole || "");
  const canManageUsers = userRole === "ADMIN";

  const fetchData = async () => {
    setLoading(true);
    try {
      const [userRes, deptRes, empRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/departments"),
        fetch("/api/employees/list"),
      ]);

      if (userRes.ok) {
        setUsers(await userRes.json());
        setSelectedPendingRowKeys([]);
      }
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (empRes.ok) setEmployees(await empRes.json());

    } catch {
      message.error("Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldValue("role", "STAFF");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (record: any) => {
    setEditingUser(record);
    form.setFieldsValue({
      username: record.username,
      fullName: record.fullName,
      role: record.role,
      departmentIds: record.managedDepartments.map((d: any) => d.id),
      password: "",
      employeeCode: record.employeeCode,
      userDepartmentId: record.userDepartmentId,
    });
    setIsModalOpen(true);
  };

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

  const handleSelectEmployee = (value: string) => {
    const selectedEmp = employees.find(e => e.code === value);
    if (selectedEmp) {
      form.setFieldsValue({
        fullName: selectedEmp.fullName,
        userDepartmentId: selectedEmp.departmentId,
      });
      message.info(`Đã chọn: ${selectedEmp.fullName}`);
    }
  };

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

  const handlePendingAction = async (action: "approve" | "reject") => {
    if (selectedPendingRowKeys.length === 0) return;

    setApprovalLoading(action);
    try {
      const res = await fetch(`/api/admin/users/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selectedPendingRowKeys.map(Number) }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        message.error(data.error || "Không thể xử lý danh sách đã chọn");
        return;
      }

      message.success(
        action === "approve"
          ? `Đã duyệt ${data.count || selectedPendingRowKeys.length} tài khoản`
          : `Đã từ chối ${data.count || selectedPendingRowKeys.length} tài khoản`,
      );
      setSelectedPendingRowKeys([]);
      fetchData();
    } catch {
      message.error("Lỗi kết nối server");
    } finally {
      setApprovalLoading(null);
    }
  };

  const baseColumns = [
    {
      title: "Tài khoản",
      dataIndex: "username",
      key: "username",
      render: (text: string) => <b>{text}</b>,
    },
    {
      title: "Mã NV",
      dataIndex: "employeeCode",
      key: "employeeCode",
      render: (text: string) => text ? <Tag>{text}</Tag> : <span style={{ color: '#ccc' }}>-</span>,
    },
    {
      title: "Họ và tên",
      dataIndex: "fullName",
      key: "fullName",
    },
    {
      title: "Phòng trực thuộc",
      dataIndex: "userDepartment",
      key: "userDepartment",
      render: (dept: any) => dept ? <Tag color="cyan">{dept.name}</Tag> : <span style={{ color: '#ccc' }}>-</span>,
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
  ];

  const actionColumn = {
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
  };

  const activeColumns = canManageUsers ? [...baseColumns, actionColumn] : baseColumns;

  const pendingColumns = [
    {
      title: "Họ tên",
      dataIndex: "fullName",
      key: "fullName",
    },
    {
      title: "Tên ĐN",
      dataIndex: "username",
      key: "username",
      render: (text: string) => <b>{text}</b>,
    },
    {
      title: "Mã NV",
      dataIndex: "employeeCode",
      key: "employeeCode",
      render: (text: string) => text ? <Tag>{text}</Tag> : <span style={{ color: "#ccc" }}>-</span>,
    },
    {
      title: "Phòng ban đăng ký",
      dataIndex: ["userDepartment", "name"],
      key: "userDepartment",
      render: (_: any, record: any) =>
        record.userDepartment?.name || <span style={{ color: "#ccc" }}>Chưa chọn</span>,
    },
    {
      title: "Ngày đăng ký",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (value: string) =>
        value ? new Date(value).toLocaleDateString("vi-VN") : "-",
    },
  ];

  const matchesFullNameSearch = (user: any) =>
    (user.fullName || "")
      .toLowerCase()
      .includes(searchFullName.trim().toLowerCase());

  const activeUsers = users.filter((user) => (user.status || "ACTIVE") === "ACTIVE");
  const pendingUsers = users.filter((user) => user.status === "PENDING");
  const filteredActiveUsers = activeUsers.filter(matchesFullNameSearch);
  const filteredPendingUsers = pendingUsers.filter(matchesFullNameSearch);

  if (!canReviewUsers) {
    return (
      <AdminLayout>
        <div>Bạn không có quyền truy cập trang này.</div>
      </AdminLayout>
    );
  };

  return (
    <AdminLayout>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
        <h2>Quản lý Tài khoản hệ thống</h2>
        {canManageUsers && (
          <Button type="primary" icon={<UserAddOutlined />} onClick={handleOpenAdd}>
            Tạo tài khoản mới
          </Button>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="Tìm theo họ và tên user"
          allowClear
          value={searchFullName}
          onChange={(e) => setSearchFullName(e.target.value)}
        />
      </div>

      <Tabs
        items={[
          {
            key: "active",
            label: "Tài khoản hoạt động",
            children: (
              <Table
                dataSource={filteredActiveUsers}
                columns={activeColumns}
                rowKey="id"
                loading={loading}
                bordered
              />
            ),
          },
          {
            key: "pending",
            label: (
              <span>
                Chờ duyệt{" "}
                <Badge count={pendingUsers.length} size="small" />
              </span>
            ),
            children: (
              <>
                <div
                  style={{
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span>Đã chọn: {selectedPendingRowKeys.length}</span>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    disabled={selectedPendingRowKeys.length === 0}
                    loading={approvalLoading === "approve"}
                    onClick={() => handlePendingAction("approve")}
                  >
                    Duyệt hàng loạt
                  </Button>
                  <Button
                    danger
                    icon={<CloseOutlined />}
                    disabled={selectedPendingRowKeys.length === 0}
                    loading={approvalLoading === "reject"}
                    onClick={() => handlePendingAction("reject")}
                  >
                    Từ chối
                  </Button>
                </div>
                <Table
                  dataSource={filteredPendingUsers}
                  columns={pendingColumns}
                  rowKey="id"
                  loading={loading}
                  bordered
                  rowSelection={{
                    selectedRowKeys: selectedPendingRowKeys,
                    onChange: setSelectedPendingRowKeys,
                  }}
                />
              </>
            ),
          },
        ]}
      />

      <Modal
        title={editingUser ? "Cập nhật tài khoản" : "Tạo tài khoản mới"}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => setIsModalOpen(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="VD: nv_to1" disabled={!!editingUser} />
            </Form.Item>

            <Form.Item
              name="employeeCode"
              label="Liên kết Nhân Viên"
              style={{ flex: 1.5 }}
              help="Gõ tên hoặc mã để tìm kiếm"
            >
              <Select
                placeholder="Chọn nhân viên..."
                showSearch
                allowClear
                onChange={handleSelectEmployee}
                options={employees.map((emp) => ({
                  value: emp.code,
                  label: `${emp.code} - ${emp.fullName}`,
                  dept: emp.department?.name,
                }))}
                // @ts-ignore - filterOption is still fully supported in Ant Design
                filterOption={(input, option) => {
                  const label = option?.label?.toString().toLowerCase() || '';
                  return label.includes(input.toLowerCase());
                }}
                optionRender={(option) => (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{option.label}</span>
                    <span style={{ color: '#999', fontSize: 12 }}>
                      {option.data.dept}
                    </span>
                  </div>
                )}
              />
            </Form.Item>
          </div>

          <Form.Item name="fullName" label="Họ và tên hiển thị" rules={[{ required: true }]}>
            <Input placeholder="VD: Nguyễn Văn A" />
          </Form.Item>

          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="role" label="Vai trò" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select options={ROLES} />
            </Form.Item>

            <Form.Item name="userDepartmentId" label="Phòng ban trực thuộc" style={{ flex: 1 }}>
              <Select
                placeholder="Chọn phòng ban..."
                showSearch
                allowClear
                options={departments.map((d) => ({
                  value: d.id,
                  label: `${d.name} - ${d.factory?.name}`,
                }))}
                // @ts-ignore
                filterOption={(input, option) => {
                  const label = option?.label?.toString().toLowerCase() || '';
                  return label.includes(input.toLowerCase());
                }}
              />
            </Form.Item>
          </div>

          <Form.Item
            name="password"
            label={editingUser ? "Mật khẩu mới (Để trống nếu không đổi)" : "Mật khẩu"}
            rules={[{ required: !editingUser, message: "Vui lòng nhập mật khẩu" }]}
          >
            <Input.Password placeholder={editingUser ? "Nhập mật khẩu mới..." : "Nhập mật khẩu"} />
          </Form.Item>

          {["TIMEKEEPER", "STAFF"].includes(selectedRole) && (
            <Form.Item
              name="departmentIds"
              label={selectedRole === "TIMEKEEPER" ? "Được phân quyền chấm công tại:" : "Được xem dữ liệu tại:"}
              rules={[{ required: true, message: "Vui lòng chọn ít nhất 1 phòng ban" }]}
              style={{ background: '#f5f5f5', padding: 10, borderRadius: 6 }}
            >
              <Select
                mode="multiple"
                placeholder="Chọn danh sách phòng..."
                allowClear
                showSearch
                style={{ width: "100%" }}
                options={departments.map((d) => ({
                  value: d.id,
                  label: `${d.name} (${d.factory?.name})`,
                }))}
                //@ts-ignore
                filterOption={(input, option) => {
                  const label = option?.label?.toString().toLowerCase() || '';
                  return label.includes(input.toLowerCase());
                }}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </AdminLayout>
  );
}
