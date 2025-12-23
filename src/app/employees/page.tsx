// src/app/employees/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useSession } from "next-auth/react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  message,
  Select,
  DatePicker,
  Tag,
  Popconfirm,
  Card, // Dùng card để bọc bộ lọc cho đẹp
  Space,
  type TableProps,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  UserOutlined,
  PhoneOutlined,
  FilterOutlined,
} from "@ant-design/icons";
// Import thư viện ngày tháng
import dayjs from "dayjs";

// Định nghĩa kiểu dữ liệu (Interfaces)
interface Department {
  id: number;
  name: string;
  factory?: {
    id: number; // Cần ID để lọc chính xác
    code: string;
    name: string;
  };
}

interface Employee {
  id: number;
  code: string;
  fullName: string;
  birthday?: string;
  gender?: string;
  phone: string;
  department?: Department;
  position?: string; // Bổ sung thêm trường này cho đủ Interface
  address?: string;
}

export default function EmployeePage() {
  const { data: session } = useSession();
  // 1. Biến thần thánh kiểm tra quyền
  // LOGIC MỚI: Cả LEADER và TIMEKEEPER đều không được sửa danh mục
  // (Chỉ ADMIN và HR_MANAGER mới được sửa)
  const isViewOnly = !["ADMIN", "HR_MANAGER"].includes(
    session?.user?.role || ""
  );

  // --- STATE DỮ LIỆU ---
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);

  // --- STATE MODAL & FORM ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<number | null>(null);

  // --- STATE BỘ LỌC (FILTER) ---
  const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(
    null
  );
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);

  // --- 1. TẢI DỮ LIỆU ---
  const fetchEmployees = async () => {
    setLoading(true);
    try {
      // Lấy danh sách nhân viên và phòng ban (để chọn khi thêm mới)
      const [empRes, deptRes] = await Promise.all([
        fetch("/api/employees"),
        fetch("/api/departments"),
      ]);

      const empData = await empRes.json();
      const deptData = await deptRes.json();

      setEmployees(empData);
      setDepartments(deptData); // Lưu danh sách bộ phận để dùng cho dropdown
    } catch (error) {
      message.error("Lỗi tải dữ liệu: " + error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  // --- 2. LOGIC TÍNH TOÁN DỮ LIỆU (Memoization) ---

  // A. Lấy danh sách Nhà máy duy nhất từ list phòng ban
  const factories = useMemo(() => {
    const map = new Map();
    departments.forEach((d) => {
      if (d.factory) map.set(d.factory.id, d.factory);
    });
    return Array.from(map.values());
  }, [departments]);

  // B. Danh sách Phòng ban trong Dropdown (phụ thuộc vào Nhà máy đã chọn)
  const availableDepartments = useMemo(() => {
    if (!selectedFactoryId) return departments; // Chưa chọn NM thì hiện hết
    return departments.filter((d) => d.factory?.id === selectedFactoryId);
  }, [departments, selectedFactoryId]);

  // C. Danh sách Nhân viên hiển thị ra bảng (Kết quả lọc)
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Check Nhà máy
      const matchFactory = selectedFactoryId
        ? emp.department?.factory?.id === selectedFactoryId
        : true;
      // Check Phòng ban
      const matchDept = selectedDeptId
        ? emp.department?.id === selectedDeptId
        : true;

      return matchFactory && matchDept;
    });
  }, [employees, selectedFactoryId, selectedDeptId]);

  // --- 3. CÁC HÀM XỬ LÝ (CRUD) ---
  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (res.ok) {
        message.success("Đã xóa thành công!");
        fetchEmployees();
      } else {
        const errorData = await res.json();
        message.error(errorData.error || "Lỗi khi xóa");
      }
    } catch (error) {
      message.error("Lỗi kết nối: " + error);
    }
  };

  const handleEdit = (record: Employee) => {
    setEditingId(record.id);
    form.setFieldsValue({
      ...record,
      birthday: record.birthday ? dayjs(record.birthday) : null,
      departmentId: record.department?.id,
    });
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingId(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleOK = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        birthday: values.birthday
          ? values.birthday.format("YYYY-MM-DD") + "T00:00:00.000Z"
          : null,
      };

      const url = editingId ? `/api/employees/${editingId}` : "/api/employees";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        message.success(
          editingId ? "Cập nhật thành công!" : "Thêm mới thành công!"
        );
        setIsModalOpen(false);
        form.resetFields();
        setEditingId(null);
        fetchEmployees();
      } else {
        message.error("Có lỗi xảy ra");
      }
    } catch (error) {
      console.log("Validate Failed", error);
    }
  };

  // --- 4. CẤU HÌNH CỘT BẢNG ---
  const columns: TableProps<Employee>["columns"] = [
    {
      title: "Mã NV",
      dataIndex: "code",
      key: "code",
      width: 100,
      render: (text) => <b>{text}</b>,
    },
    {
      title: "Họ tên",
      dataIndex: "fullName",
      key: "fullName",
      width: 200,
    },
    {
      title: "Chức vụ",
      dataIndex: "position",
      key: "position",
    },
    {
      title: "Bộ phận",
      dataIndex: "department",
      key: "department",
      width: 200,
      render: (dept: Department) => (
        <div>
          <div>{dept?.name}</div>
          {/* Hiển thị thêm tên nhà máy nhỏ ở dưới cho dễ nhìn */}
          {dept?.factory && (
            <small style={{ color: "#888" }}>({dept.factory.name})</small>
          )}
        </div>
      ),
    },
    {
      title: "Ngày sinh",
      dataIndex: "birthday",
      key: "birthday",
      render: (dateString) =>
        dateString ? dayjs(dateString).format("DD/MM/YYYY") : "",
    },
    {
      title: "Giới tính",
      dataIndex: "gender",
      key: "gender",
      render: (gender) =>
        gender === "Nam" ? (
          <Tag color="blue">Nam</Tag>
        ) : (
          <Tag color="magenta">Nữ</Tag>
        ),
    },
    {
      title: "SĐT",
      dataIndex: "phone",
      key: "phone",
    },
    {
      title: "Hành động",
      key: "action",
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            style={{ color: "blue" }}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Xóa?"
            onConfirm={() => handleDelete(record.id)}
            okText="Có"
            cancelText="Không"
          >
            <Button type="text" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ].filter((col) => {
    // Nếu là Leader VÀ cột là 'action' -> Loại bỏ (return false)
    if (isViewOnly && col.key === "action") return false;
    return true;
  });

  return (
    <AdminLayout>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 className="text-2xl font-bold">
          Quản lý nhân sự ({filteredEmployees.length} nhân viên)
        </h2>

        {/* 3. Chỉ hiện nút Thêm mới nếu được phép sửa */}
        {!isViewOnly && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
            Thêm nhân viên
          </Button>
        )}
      </div>

      {/* --- KHU VỰC BỘ LỌC --- */}
      <Card size="small" style={{ marginBottom: 16, background: "#f5f5f5" }}>
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontWeight: 600 }}>
            <FilterOutlined /> Bộ lọc:
          </span>

          {/* 1. Chọn Nhà Máy */}
          <Select
            style={{ width: 250 }}
            placeholder="Chọn Nhà máy / Khối"
            allowClear
            value={selectedFactoryId}
            onChange={(val) => {
              setSelectedFactoryId(val);
              setSelectedDeptId(null); // Reset phòng ban khi đổi nhà máy
            }}
          >
            {factories.map((f) => (
              <Select.Option key={f.id} value={f.id}>
                {f.name}
              </Select.Option>
            ))}
          </Select>

          {/* 2. Chọn Phòng Ban (Dropdown phụ thuộc) */}
          <Select
            style={{ width: 250 }}
            placeholder="Chọn Phòng ban"
            allowClear
            value={selectedDeptId}
            onChange={(val) => setSelectedDeptId(val)}
            disabled={!selectedFactoryId && departments.length > 50} // Có thể disable nếu muốn bắt buộc chọn NM trước
          >
            {availableDepartments.map((d) => (
              <Select.Option key={d.id} value={d.id}>
                {d.name}
              </Select.Option>
            ))}
          </Select>

          {/* Nút Reset bộ lọc */}
          {(selectedFactoryId || selectedDeptId) && (
            <Button
              type="link"
              onClick={() => {
                setSelectedFactoryId(null);
                setSelectedDeptId(null);
              }}
            >
              Xóa lọc
            </Button>
          )}
        </div>
      </Card>

      {/* --- BẢNG DỮ LIỆU --- */}
      {/* Lưu ý: dataSource truyền vào là filteredEmployees chứ không phải employees gốc */}
      <Table
        columns={columns}
        dataSource={filteredEmployees}
        rowKey="id"
        loading={loading}
        bordered
        scroll={{ x: 800 }}
        pagination={{ pageSize: 10 }} // Vẫn giữ phân trang ở client cho gọn bảng
      />

      {/* --- MODAL GIỮ NGUYÊN NHƯ CŨ --- */}
      <Modal
        title={editingId ? "Sửa thông tin" : "Thêm Nhân viên"}
        open={isModalOpen}
        onOk={handleOK}
        onCancel={() => setIsModalOpen(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <div style={{ display: "flex", gap: 16 }}>
            <Form.Item
              name="code"
              label="Mã NV"
              style={{ flex: 1 }}
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="fullName"
              label="Họ tên"
              style={{ flex: 2 }}
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            {/* Dropdown phòng ban trong Modal thì vẫn hiện Full nhé */}
            <Form.Item
              name="departmentId"
              label="Phòng ban"
              style={{ flex: 1 }}
              rules={[{ required: true }]}
            >
              <Select
                placeholder="Chọn phòng ban"
                showSearch // Cho phép gõ tìm kiếm
                optionFilterProp="children"
              >
                {departments.map((dept) => (
                  <Select.Option key={dept.id} value={dept.id}>
                    {dept.name} - {dept.factory?.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="position" label="Chức vụ" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            <Form.Item name="birthday" label="Ngày sinh" style={{ flex: 1 }}>
              <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="gender" label="Giới tính" style={{ width: 150 }}>
              <Select>
                <Select.Option value="Nam">Nam</Select.Option>
                <Select.Option value="Nữ">Nữ</Select.Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item name="phone" label="SĐT">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </AdminLayout>
  );
}
