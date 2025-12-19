// src/app/employees/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
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
  type TableProps,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  UserOutlined,
  PhoneOutlined,
} from "@ant-design/icons";
// Import thư viện ngày tháng
import dayjs from "dayjs";

// Định nghĩa kiểu dữ liệu (Interfaces)
interface Department {
  id: number;
  name: string;
  factory?: {
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
  email?: string;
  department?: Department;
  position?: string; // Bổ sung thêm trường này cho đủ Interface
  address?: string;
}

export default function EmployeePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]); // Để nạp vào dropdown
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<number | null>(null);

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

  // --- HÀM XỬ LÝ XÓA ---
  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        message.success("Đã xóa thành công!");
        fetchEmployees(); // Load lại bảng
      } else {
        const errorData = await res.json();
        message.error(errorData.error || "Lỗi khi xóa");
      }
    } catch (error) {
      message.error("Lỗi kết nối, " + error);
    }
  };

  // --- HÀM MỞ MODAL ĐỂ SỬA
  const handleEdit = (record: Employee) => {
    setEditingId(record.id); // Đánh dấu là đang sửa ID này

    // FIX: Chuẩn bị dữ liệu để nạp vào Form
    form.setFieldsValue({
      ...record,
      // 1. Convert chuỗi ISO sang Dayjs object cho DatePicker
      birthday: record.birthday ? dayjs(record.birthday) : null,
      // 2. Trích xuất ID phòng ban từ objject department để nạp vào Select
      departmentId: record.department?.id,
    }); // Điền dữ liệu cũ vào form
    setIsModalOpen(true); // Mở modal lên
  };

  // --- HÀM MỞ MODAL ĐỂ THÊM MỚI
  const openAddModal = () => {
    setEditingId(null); // Thêm mới chứ không phải sửa
    form.resetFields(); // Xóa trắng form
    setIsModalOpen(true);
  };

  // --- HÀM LƯU, XỬ LÝ CẢ THÊM VÀ SỬA ---
  const handleOK = async () => {
    try {
      const values = await form.validateFields();

      // FIX: Giữ nguyên logic xử lý ngày giờ để tránh lệch múi giờ
      // T00:00:00.000Z ép cứng giờ UTC
      const dobISO = values.birthday
        ? values.birthday.format("YYYY-MM-DD") + "T00:00:00.000Z"
        : null;

      const payload = {
        ...values,
        birthday: dobISO,
      };

      // LOGIC Phân luồng
      // Nếu editingId có giá trị -> Gọi API sửa (PATCH)
      // Nếu editingId = null -> Gọi API thêm mới (POST)

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
        setIsModalOpen(false); // Đóng modal
        form.resetFields(); // Xóa trắng form sau khi nhập
        setEditingId(null); // Reset giá trị
        fetchEmployees(); // Tải lại dữ liệu để thấy bản ghi mới
      } else {
        message.error("Có lỗi xảy ra");
      }
    } catch (error) {
      console.log("Validate Failed !!!", error);
    }
  };

  // --- 3. CẤU HÌNH CỘT ---
  const columns: TableProps<Employee>["columns"] = [
    {
      title: "Mã NV",
      dataIndex: "code",
      key: "code",
      render: (text) => <b>{text}</b>,
    },
    {
      title: "Họ tên",
      dataIndex: "fullName",
      key: "fullName",
    },
    {
      title: "Bộ phận",
      dataIndex: "department",
      key: "department",
      // FIX: Phải render tên phòng ban, không render object trực tiếp
      render: (record: Department) => record?.name,
    },
    {
      title: "Ngày sinh",
      dataIndex: "birthday",
      key: "birthday",
      // Format ngày tháng cho dễ đọc (DD/MM/YYYY)
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
      title: "Địa chỉ",
      dataIndex: "address",
      key: "address",
    },
    {
      title: "Số điện thoại",
      dataIndex: "phone",
      key: "phone",
    },
    {
      title: "Hành động",
      key: "action",
      render: (_, record) => (
        <>
          {/* Dùng Space để tạo khoảng cách giữa 2 nút cho đẹp */}
          <Button
            type="text"
            icon={<EditOutlined />}
            style={{ color: "blue" }}
            onClick={() => handleEdit(record)}
          />
          {/* Nút xóa có xác nhận */}
          <Popconfirm
            title="Xóa nhân viên này?"
            description="Hành động này không thể hoàn tác."
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button type="text" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <h2>Quản lý nhân sự</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
          Thêm nhân viên
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={employees}
        rowKey="id"
        loading={loading}
        bordered
        scroll={{ x: 800 }} // Cho phép cuộn ngang nếu bảng quá rộng
      />

      <Modal
        title={editingId ? "Sửa thông tin nhân viên" : "Thêm Nhân viên mới"}
        open={isModalOpen}
        onOk={handleOK}
        onCancel={() => setIsModalOpen(false)}
        width={700} // Modal to hơn chút vì nhiều trường
      >
        <Form form={form} layout="vertical">
          {/* Hàng 1: Mã NV + Họ tên */}
          <div style={{ display: "flex", gap: 16 }}>
            <Form.Item
              name="code"
              label="Mã NV"
              style={{ flex: 1 }}
              rules={[{ required: true }]}
            >
              <Input placeholder="NV..." />
            </Form.Item>
            <Form.Item
              name="fullName"
              label="Họ và tên"
              style={{ flex: 2 }}
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
          </div>

          {/* Hàng 2: Phòng ban + Chức vụ */}
          <div style={{ display: "flex", gap: 16 }}>
            <Form.Item
              name="departmentId"
              label="Thuộc Phòng ban"
              style={{ flex: 1 }}
              rules={[{ required: true }]}
            >
              <Select placeholder="Chọn phòng ban">
                {departments.map((dept) => (
                  <Select.Option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.factory?.name})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="position" label="Chức vụ" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </div>

          {/* Hàng 3: Ngày sinh + Giới tính */}
          <div style={{ display: "flex", gap: 16 }}>
            {/* Component DatePicker */}
            <Form.Item name="birthday" label="Ngày sinh" style={{ flex: 1 }}>
              <DatePicker
                style={{ width: "100%" }}
                format="DD/MM/YYYY"
                placeholder="Chọn ngày"
              />
            </Form.Item>

            <Form.Item name="gender" label="Giới tính" style={{ width: 150 }}>
              <Select>
                <Select.Option value="Nam">Nam</Select.Option>
                <Select.Option value="Nữ">Nữ</Select.Option>
              </Select>
            </Form.Item>
          </div>

          {/* Các thông tin khác */}
          <Form.Item name="phone" label="Phone">
            <Input prefix={<PhoneOutlined />} />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[{ type: "email", message: "Email không hợp lệ" }]}
          >
            <Input prefix={<UserOutlined />} />
          </Form.Item>

          <Form.Item name="address" label="Địa chỉ thường trú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </AdminLayout>
  );
}
