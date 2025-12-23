// src/app/departments/pages.tsx
"use client";

import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useSession } from "next-auth/react";
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
  Popconfirm,
  type TableProps,
} from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
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
  const { data: session } = useSession();
  // 1. Biến thần thánh kiểm tra quyền
  // LOGIC MỚI: Cả LEADER và TIMEKEEPER đều không được sửa danh mục
  // (Chỉ ADMIN và HR_MANAGER mới được sửa)
  const isViewOnly = !["ADMIN", "HR_MANAGER"].includes(
    session?.user?.role || ""
  );

  const [departments, setDepartments] = useState<Department[]>([]);
  // THÊM: State để chứa danh sách nhà máy (dùng cho Dropdown)
  const [factories, setFactories] = useState<Factory[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  // State mới, lưu ID của dòng đang sửa (nếu null nghĩa là đang thêm mới)
  const [editingId, setEditingId] = useState<number | null>(null);

  // --- TẢI DỮ LIỆU ---
  const fetchDepartment = async () => {
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
    fetchDepartment();
  }, []);

  // --- HÀM XỬ LÝ XÓA ---
  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/departments/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        message.success("Đã xóa thành công!");
        fetchDepartment(); // Load lại bảng
      } else {
        const errorData = await res.json();
        message.error(errorData.error || "Lỗi khi xóa");
      }
    } catch (error) {
      message.error("Lỗi kết nối, " + error);
    }
  };

  // --- HÀM MỞ MODAL ĐỂ SỬA
  const handleEdit = (record: Department) => {
    setEditingId(record.id); // Đánh dấu là đang sửa ID này
    form.setFieldsValue(record); // Điền dữ liệu cũ vào form
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

      // LOGIC Phân luồng
      // Nếu editingId có giá trị -> Gọi API sửa (PATCH)
      // Nếu editingId = null -> Gọi API thêm mới (POST)

      const url = editingId
        ? `/api/departments/${editingId}`
        : "/api/departments";
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
        setIsModalOpen(false); // Đóng modal
        form.resetFields(); // Xóa trắng form sau khi nhập
        setEditingId(null); // Reset giá trị
        fetchDepartment(); // Tải lại dữ liệu để thấy bản ghi mới
      } else {
        message.error("Có lỗi xảy ra");
      }
    } catch (error) {
      console.log("Validate Failed !!!", error);
    }
  };

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
      dataIndex: "factory", // Dữ liệu trả về từ API phải include factory
      key: "factory",
      render: (factory: Factory) => {
        if (!factory) return null;

        // Mapping màu cho Tag (blue, red, green, gold, cyan...)
        let color = "default";
        if (factory.code === "HC") color = "red";
        else if (factory.code === "NM1") color = "blue";
        else if (factory.code === "NM2") color = "green";
        else if (factory.code === "NM3") color = "#faad14";

        return <Tag color={color}>{factory.name}</Tag>;
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
            onClick={() => handleEdit(record)}
          />
          {/* Nút xóa có xác nhận */}
          <Popconfirm
            title="Xóa bộ phận này?"
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
  ].filter((col) => {
    // Nếu là Leader VÀ cột là 'action' -> Loại bỏ (return false)
    if (isViewOnly && col.key === "action") return false;
    return true;
  });

  // --- GIAO DIỆN NGƯỜI DÙNG ---
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
        {/* Gọi hàm openAddModal thay vì set trực tiếp */}

        {/* 3. Chỉ hiện nút Thêm mới nếu được phép sửa */}
        {!isViewOnly && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
            Thêm Bộ Phận
          </Button>
        )}
      </div>
      <Table
        dataSource={departments}
        columns={columns}
        rowKey="id"
        loading={loading}
        bordered
      />

      <Modal
        title={editingId ? "Cập nhật bộ phận" : "Thêm mới bộ phận"}
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
