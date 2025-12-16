// src/app/departments/pages.tsx
"use client";

import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
// Chú ý: Import thêm Select
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  message,
  Select,
  Tag,
  type TableProps,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ConsoleSqlOutlined,
} from "@ant-design/icons";
import { prisma } from "@/lib/prisma";
import { title } from "process";

// Định nghĩa kiểu dữ liệu
interface Factory {
  id: number;
  name: string;
  code: string;
}

interface Department {
  id: number;
  code: string;
  name: string;
  factoryId?: number;
  // Vì trong API ta đã dùng include: { factory: true } nên kết quả sẽ có object factory
  factory?: {
    name: string;
  };
}

export default function DepartmentPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  // THÊM: State để chứa danh sách nhà máy (dùng cho Dropdown)
  const [factories, setFactories] = useState<Factory[]>([]);

  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  // --- TẢI DỮ LIỆU ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // Gọi song song cả 2 API cùng lúc cho nhanh
      const [deptRes, facRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/factories"),
      ]);

      const deptData = await deptRes.json();
      const factData = await facRes.json();

      setDepartments(deptData);
      setFactories(factData); // Lưu danh sách nhà máy để lát dùng
    } catch (error) {
      message.error("Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Hàm thêm dữ liệu cho nút lưu
  const handleOK = async () => {
    try {
      const values = await form.validateFields();

      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (res.ok) {
        message.success("Thêm phòng ban thành công!");
        setIsModalOpen(false); // Đóng modal
        form.resetFields(); // Xóa trắng form sau khi nhập
        fetchData(); // Tải lại dữ liệu để thấy bản ghi mới cập nhật
      } else {
        message.error("Có lỗi xảy ra");
      }
    } catch (error) {
      console.log("Validate Failed !!!", error);
    }
  };

  // --- CẤU HÌNH CỘT CHO BẢNG ---
  // --- CẤU HÌNH CỘT CHO BẢNG (Đã sửa lỗi TypeScript) ---
  const columns: TableProps<Department>["columns"] = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id", // Thêm key rõ ràng
      width: 50,
    },
    {
      title: "Mã Phòng",
      dataIndex: "code",
      key: "code", // Thêm key
      // SỬA LỖI: Thay vì dùng thuộc tính fontWeight (sai chuẩn), ta dùng render để bọc thẻ <b>
      render: (text) => <b>{text}</b>,
    },
    {
      title: "Tên Phòng Ban",
      dataIndex: "name",
      key: "name", // Thêm key
    },
    {
      title: "Thuộc Nhà Máy",
      key: "factory",
      render: (_, record) => {
        // TypeScript bây giờ đã hiểu 'record' chính là 'Department'
        if (record.factory) {
          return <Tag color="blue">{record.factory.name}</Tag>;
        }
        return <Tag color="green">Phòng ban chung</Tag>;
      },
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
        <h2>Quản lý Phòng Ban - Bộ phận</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
        >
          Thêm Bộ Phận
        </Button>
      </div>
      <Table
        dataSource={departments}
        columns={columns}
        rowKey="id"
        loading={loading}
        bordered
      />

      <Modal
        title="Thêm Phòng Ban"
        open={isModalOpen}
        onOk={handleOK}
        onCancel={() => setIsModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="Mã Phòng" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="name" label="Tên Phòng" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          {/* COMPONENT MỚI: SELECT */}
          <Form.Item name="factoryId" label="Thuộc Nhà Máy">
            <Select
              placeholder="Chọn nhà máy (Để trống nếu là phòng ban chung)"
              allowClear // Cho phép bấm dấu X để xóa chọn (về null)
            >
              {/* Dùng vòng lặp để tạo ra các mục chọn từ dữ liệu API */}
              {factories.map((factory) => (
                <Select.Option key={factory.id} value={factory.id}>
                  {factory.name} ({factory.code})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </AdminLayout>
  );
}
