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
import { text } from "stream/consumers";

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
  birthday?: string; // API trả về chuỗi ISO
  gender?: string;
  phone: string;
  email?: string;
  department?: Department; // Nhân viên thuộc phòng ban
}

export default function EmployeePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [department, setDepartments] = useState<Department[]>([]); // Để nạp vào dropdown

  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  // --- 1. TẢI DỮ LIỆU ---
  const fetchData = async () => {
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
      setDepartments(deptData);
    } catch (error) {
      message.error("Lỗi tải dữ liệu: " + error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- 2. XỬ LÝ LƯU DỮ LIỆU (QUAN TRỌNG) ---
  const handleOK = async () => {
    try {
      const values = await form.validateFields();

      // LOGIC xử lý ngày tháng
      // Giá trị 'birthday' từ DatePicker là một Object Dayjs
      // API của chúng ta cần một chuỗi (String)
      // -> Cần convert trước khi gửi
      const payload = {
        ...values,
        birthday: values.birthday ? values.birthday.toISOString() : null,
      };

      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        message.success("Thêm nhân viên thành công!");
        setIsModalOpen(false);
        form.resetFields();
        fetchData();
      } else {
        message.error("Có lỗi xảy ra, check lại mã nhân viên");
      }
    } catch (error) {
      console.log("Validate Failed: ", error);
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
      title: "Phòng ban",
      key: "department",
      // Hiển thị: Tên Phòng - Tên Nhà Máy
      render: (_, record) => (
        <div>
          <div>{record.department?.name}</div>
          <small style={{ color: "gray" }}>
            {record.department?.factory?.name || "Phòng ban chung"}
          </small>
        </div>
      ),
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
      render: () => (
        <>
          <Button
            type="text"
            icon={<EditOutlined />}
            style={{ color: "blue" }}
          />
          <Button type="text" icon={<DeleteOutlined />} danger />
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
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
        >
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
        title="Thêm Nhân viên mới"
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
                {department.map((dept) => (
                  <Select.Option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.factory?.name || "Chung"})
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
