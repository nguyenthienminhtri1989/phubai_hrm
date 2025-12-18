// src/app/factories/page.tsx
"use client"; // Bắt buộc vì có tương tác (click, nhập liệu)

import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  message,
  Space,
  Popconfirm,
} from "antd";
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
  // State mới, lưu ID của dòng đang sửa (nếu null nghĩa là đang thêm mới)
  const [editingId, setEditingId] = useState<number | null>(null);

  // --- PHẦN 2: TƯƠNG TÁC VỚI API (BACKEND) ---
  // --- HÀM LẤY DANH SÁCH TỪ API GET ---
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

  // --- HÀM XỬ LÝ XÓA ---
  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/factories/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        message.success("Đã xóa thành công!");
        fetchFactories(); // Load lại bảng
      } else {
        const errorData = await res.json();
        message.error(errorData.error || "Lỗi khi xóa");
      }
    } catch (error) {
      message.error("Lỗi kết nối" + error);
    }
  };

  // --- HÀM MỞ MODAL ĐỂ SỬA
  const handleEdit = (record: Factory) => {
    setEditingId(record.id); // Đánh dấu là đang sửa ID này
    form.setFieldsValue(record); // Điền dữ liệu cũ vào form
    setIsModalOpen(true); // Mở Modal lên
  };

  // --- HÀM MỞ MODAL ĐỂ THÊM MỚI ---
  const openAddModal = () => {
    setEditingId(null); // Đánh dấu là thêm mới
    form.resetFields(); // Xóa trắng form
    setIsModalOpen(true); // Mở Modal
  };

  // --- HÀM KHI NHẤN NÚT LƯU TRÊN FORM (API POST) ---
  const handleOk = async () => {
    try {
      const values = await form.validateFields();

      // LOGIC PHÂN LUỒNG
      // Nếu editingId có giá trị thì gọi API sửa (PATCH)
      // Nếu editingID là null thì gọi API thêm mới (POST)

      const url = editingId ? `/api/factories/${editingId}` : "/api/factories";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (res.ok) {
        message.success(
          editingId ? "Cập nhật thành công!" : "Thêm mới thành công!"
        );
        setIsModalOpen(false); // Đóng Modal
        form.resetFields(); // Xóa trắng form
        setEditingId(null); // Reset trạng thái
        fetchFactories(); // Load lại dữ liệu
      } else {
        message.error("Có lỗi xảy ra...");
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
      render: (text: string) => <b>{text}</b>, // Tùy chỉnh CSS nếu muốn
    },
    {
      title: "Tên Nhà Máy",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Hành động",
      key: "action",
      render: (_, record: Factory) => (
        <Space size="middle">
          {/* NÚT SỬA */}
          <Button
            type="text"
            icon={<EditOutlined />}
            style={{ color: "blue" }}
            onClick={() => handleEdit(record)}
          />
          {/* NÚT XÓA CÓ XÁC NHẬN */}
          <Popconfirm
            title="Xóa nhà máy này?"
            description="Hành động này không thể hoàn tác"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button type="text" icon={<DeleteOutlined />} danger />
          </Popconfirm>
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
        {/* Gọi hàm openAddModal thay vì set trực tiếp */}
        <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
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
        title={editingId ? "Cập nhật nhà máy" : "Thêm nhà máy mới"}
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
