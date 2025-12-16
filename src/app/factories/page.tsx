// src/app/factories/page.tsx
"use client"; // Bắt buộc vì có tương tác (click, nhập liệu)

import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Table, Button, Modal, Form, Input, message, Space } from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";

// 1. Định nghĩa kiểu dữ liệu cho Nhà máy (giúp code gợi ý thông minh)
interface Factory {
  id: number;
  code: string;
  name: string;
}

export default function FactoryPage() {
  // --- PHẦN 1: QUẢN LÝ TRẠNG THÁI (STATE) ---
  const [factories, setFactories] = useState<Factory[]>([]); // Chứa danh sách nhà máy
  const [loading, setLoading] = useState(false); // Trạng thái đang tải xoay vòng vòng
  const [isModalOpen, setIsModalOpen] = useState(false); // Trạng thái mở/đóng Modal
  const [form] = Form.useForm(); // Hook để quản lý Form của AntD

  // --- PHẦN 2: TƯƠNG TÁC VỚI API (BACKEND) ---
  // Hàm lấy danh sách nhà máy từ API GET
  const fetchFactories = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/factories");
      const data = await res.json();
      setFactories(data);
    } catch (error) {
      message.error("Không thể tải dữ liệu: " + error);
    } finally {
      setLoading(false);
    }
  };

  // Gọi hàm lấy dữ liệu ngay khi trang vừa mở lên
  useEffect(() => {
    fetchFactories();
  }, []);

  // Hàm xử lý khi nhấn nút "Lưu" trên Form (API POST)
  const handleOk = async () => {
    try {
      // 1. Validation form (bắt buộc nhập)
      const values = await form.validateFields();

      // 2. Gọi API để thêm mới
      const res = await fetch("api/factories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (res.ok) {
        message.success("Thêm nhà máy thành công!");
        setIsModalOpen(false); // Đóng modal
        form.resetFields(); // Xóa trắng ô nhập
        fetchFactories(); // Tải lại danh sách mới
      } else {
        message.error("Có lỗi xảy ra (có thể trùng mã)");
      }
    } catch (error) {
      console.log("Validation Failed: ", error);
    }
  };

  // --- PHẦN 3: CẤU HÌNH BẢNG (TABLE COLUMNS) ---
  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 80,
    },
    {
      title: "Mã Nhà Máy",
      dataIndex: "code",
      key: "code",
      fontWeight: "bold", // Tùy chỉnh CSS nếu muốn
    },
    {
      title: "Tên Nhà Máy",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Hành động",
      key: "action",
      render: (_, record) => (
        <Space size="middle">
          {/* Nút sửa/xóa để hờ đó, sau này làm chức năng sau */}
          <Button
            type="text"
            icon={<EditOutlined />}
            style={{ color: "blue" }}
          />
          <Button type="text" icon={<DeleteOutlined />} danger />
        </Space>
      ),
    },
  ];

  // --- PHẦN 4: GIAO DIỆN NGƯỜI DÙNG (UI) ---
  return (
    <AdminLayout>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <h2>Quản lý Nhà máy</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
        >
          Thêm Nhà máy
        </Button>
      </div>

      {/* Bảng dữ liệu */}
      <Table
        columns={columns}
        dataSource={factories}
        rowKey="id"
        loading={loading}
        bordered
      />

      {/* Modal nhập liệu */}
      <Modal
        title="Thêm Nhà máy mới"
        open={isModalOpen}
        onOk={handleOk}
        onCancel={() => setIsModalOpen(false)}
      >
        <Form form={form} layout="vertical" name="form_factory">
          <Form.Item
            name="code"
            label="Mã Nhà Máy"
            rules={[{ required: true, message: "Vui lòng nhập mã nhà máy!" }]}
          >
            <Input placeholder="Ví dụ: NM1" />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên Nhà Máy"
            rules={[{ required: true, message: "Vui lòng nhập tên nhà máy!" }]}
          >
            <Input placeholder="Ví dụ: Nhà máy Sợi" />
          </Form.Item>
        </Form>
      </Modal>
    </AdminLayout>
  );
}
