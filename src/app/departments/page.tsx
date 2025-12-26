// src/app/departments/pages.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react"; // Thêm useMemo
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
  Tag,
  Popconfirm,
  Space, // Import thêm Space để căn chỉnh nút và ô lọc
  type TableProps,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  FilterOutlined,
} from "@ant-design/icons";

// ... (Giữ nguyên các Interface Factory và Department như cũ)
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
  factory?: {
    name: string;
  };
}

export default function DepartmentPage() {
  const { data: session } = useSession();
  const isViewOnly = !["ADMIN", "HR_MANAGER"].includes(
    session?.user?.role || ""
  );

  const [departments, setDepartments] = useState<Department[]>([]);
  const [factories, setFactories] = useState<Factory[]>([]);

  // --- 1. STATE MỚI CHO BỘ LỌC ---
  const [filterFactoryId, setFilterFactoryId] = useState<number | null>(null);
  // ------------------------------

  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<number | null>(null);

  // ... (Giữ nguyên hàm fetchDepartment và useEffect như cũ)
  const fetchDepartment = async () => {
    setLoading(true);
    try {
      const [deptRes, facRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/factories"),
      ]);
      const deptData = await deptRes.json();
      const factData = await facRes.json();
      setDepartments(deptData);
      setFactories(factData);
    } catch (error) {
      message.error("Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartment();
  }, []);

  // ... (Giữ nguyên hàm handleDelete, handleEdit, openAddModal, handleOK)
  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/departments/${id}`, { method: "DELETE" });
      if (res.ok) {
        message.success("Đã xóa thành công!");
        fetchDepartment();
      } else {
        const errorData = await res.json();
        message.error(errorData.error || "Lỗi khi xóa");
      }
    } catch (error) {
      message.error("Lỗi kết nối, " + error);
    }
  };

  const handleEdit = (record: Department) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
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
        setIsModalOpen(false);
        form.resetFields();
        setEditingId(null);
        fetchDepartment();
      } else {
        message.error("Có lỗi xảy ra");
      }
    } catch (error) {
      console.log("Validate Failed !!!", error);
    }
  };

  // --- 2. LOGIC LỌC DỮ LIỆU ---
  // Tạo danh sách mới dựa trên filterFactoryId
  const filteredDepartments = useMemo(() => {
    if (!filterFactoryId) return departments; // Nếu không chọn gì thì trả về hết
    return departments.filter((dept) => dept.factoryId === filterFactoryId);
  }, [departments, filterFactoryId]);
  // ---------------------------

  // ... (Giữ nguyên columns)
  const columns: TableProps<Department>["columns"] = [
    { title: "ID", dataIndex: "id", key: "id", width: 50 },
    {
      title: "Mã Phòng",
      dataIndex: "code",
      key: "code",
      render: (text: string) => <b>{text}</b>,
    },
    { title: "Tên Phòng Ban", dataIndex: "name", key: "name" },
    {
      title: "Thuộc Nhà Máy",
      dataIndex: "factory",
      key: "factory",
      render: (factory: Factory) => {
        if (!factory) return null;
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
      render: (_: any, record: any) => (
        <>
          <Button
            type="text"
            icon={<EditOutlined />}
            style={{ color: "blue" }}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Xóa bộ phận này?"
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
          alignItems: "center", // Căn giữa theo chiều dọc
        }}
      >
        <h2>Quản lý Phòng Ban</h2>

        {/* --- 3. CẬP NHẬT THANH CÔNG CỤ (LỌC + NÚT THÊM) --- */}
        <Space>
          {/* Ô dropdown Lọc */}
          <Select
            placeholder="Lọc theo nhà máy"
            style={{ width: 200 }}
            allowClear // Cho phép xóa chọn
            value={filterFactoryId}
            onChange={(val) => setFilterFactoryId(val)}
            suffixIcon={<FilterOutlined />} // Icon cái phễu cho đẹp
          >
            {/* Thêm option hiển thị Tất cả nếu cần, hoặc dùng allowClear là đủ */}
            {factories.map((f) => (
              <Select.Option key={f.id} value={f.id}>
                {f.name}
              </Select.Option>
            ))}
          </Select>

          {!isViewOnly && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openAddModal}
            >
              Thêm Bộ Phận
            </Button>
          )}
        </Space>
        {/* ----------------------------------------------- */}
      </div>

      <Table
        // SỬA: Thay departments bằng filteredDepartments
        dataSource={filteredDepartments}
        columns={columns}
        rowKey="id"
        loading={loading}
        bordered
      />

      {/* Modal giữ nguyên */}
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
          <Form.Item name="factoryId" label="Thuộc Nhà Máy">
            <Select placeholder="Chọn nhà máy" allowClear>
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
