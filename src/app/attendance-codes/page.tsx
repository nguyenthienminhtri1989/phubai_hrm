"use client";

import React, { useEffect, useState } from "react";
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
  ColorPicker, // Chọn màu
  InputNumber,
  Popconfirm,
  Tag,
  Space,
} from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";

// 1. ĐỊNH NGHĨA INTERFACE (KHUÔN MẪU DỮ LIỆU)
interface AttendanceCode {
  id: number;
  code: string;
  name: string;
  category: string;
  factor?: number; // Dấu ? vì có thể null
  color: string;
  description?: string;
}

// Định nghĩa các nhóm chế độ để hiển thị cho đẹp
const CATEGORY_OPTIONS = [
  { value: "TIME_WORK", label: "Lương thời gian" },
  { value: "PAID_LEAVE", label: "Nghỉ hưởng 100% lương" },
  { value: "SICK", label: "Chế độ Ốm / Tai nạn" },
  { value: "MATERNITY", label: "Chế độ Thai sản" },
  { value: "UNPAID", label: "Nghỉ không lương" },
  { value: "AWOL", label: "Nghỉ vô lý do" },
];

export default function AttendanceCodePage() {
  const { data: session } = useSession();
  // 1. Biến thần thánh kiểm tra quyền
  // LOGIC MỚI: Cả LEADER và TIMEKEEPER đều không được sửa danh mục
  // (Chỉ ADMIN và HR_MANAGER mới được sửa)
  const isViewOnly = !["ADMIN", "HR_MANAGER"].includes(
    session?.user?.role || ""
  );

  const [codes, setCodes] = useState<AttendanceCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<number | null>(null);

  // 1. Tải dữ liệu
  const fetchCodes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/attendance-codes");
      const data = await res.json();
      setCodes(data);
    } catch (error) {
      message.error("Lỗi tải danh mục: " + error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  // 2. Xử lý lưu (Thêm / Sửa)
  const handleOK = async () => {
    try {
      const values = await form.validateFields();

      // Xử lý màu sắc: ColorPicker trả về object, cần chuyển sang string hex (#ffffff)
      let colorHex = values.color;
      if (typeof values.color === "object") {
        colorHex = values.color.toHexString();
      }

      const payload = { ...values, color: colorHex };
      const url = editingId
        ? `/api/attendance-codes/${editingId}`
        : "/api/attendance-codes";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        message.success("Lưu thành công!");
        setIsModalOpen(false);
        fetchCodes();
      } else {
        const err = await res.json();
        message.error(err.error || "Có lỗi xảy ra");
      }
    } catch (error) {
      console.log("Validate Failed: ", error);
    }
  };

  // 3. Xử lý Xóa
  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/attendance-codes/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      message.success("Đã xóa!");
      fetchCodes();
    } else {
      const err = await res.json();
      message.error(err.error);
    }
  };

  // 4. Mở Modal Sửa
  const handleEdit = (record: AttendanceCode) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
    setIsModalOpen(true);
  };

  const columns = [
    {
      title: "Mã",
      dataIndex: "code",
      width: 80,
      render: (text: string, record: AttendanceCode) => (
        <Tag
          color={record.color}
          style={{ fontWeight: "bold", minWidth: 40, textAlign: "center" }}
        >
          {text}
        </Tag>
      ),
    },
    {
      title: "Tên diễn giải",
      dataIndex: "name",
      width: 200,
    },
    {
      title: "Nhóm chế độ",
      dataIndex: "category",
      width: 200,
      render: (cat: string) => {
        const option = CATEGORY_OPTIONS.find((o) => o.value === cat);
        return option ? option.label : cat;
      },
    },
    {
      title: "Hệ số",
      dataIndex: "factor",
      width: 80,
    },
    {
      title: "Màu sắc",
      dataIndex: "color",
      width: 100,
      render: (color: string) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 20,
              height: 20,
              background: color,
              borderRadius: 4,
              border: "1px solid #ddd",
            }}
          ></div>
          <small>{color}</small>
        </div>
      ),
    },
    {
      title: "Hành động",
      key: "action",
      render: (_: AttendanceCode, record: AttendanceCode) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            type="text"
            style={{ color: "blue" }}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Xóa ký hiệu này?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button icon={<DeleteOutlined />} type="text" danger />
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
        }}
      >
        <h2>Danh mục Ký hiệu chấm công</h2>

        {/* 3. Chỉ hiện nút Thêm mới nếu được phép sửa */}
        {!isViewOnly && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingId(null);
              form.resetFields();
              // Mặc định chọn màu xanh lá cho đẹp
              form.setFieldValue("color", "#1677ff");
              setIsModalOpen(true);
            }}
          >
            Thêm ký hiệu mới
          </Button>
        )}
      </div>

      <Table
        dataSource={codes}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false} // Ít dữ liệu nên không cần phân trang
        bordered
      />

      <Modal
        title={editingId ? "Sửa ký hiệu" : "Thêm ký hiệu mới"}
        open={isModalOpen}
        onOk={handleOK}
        onCancel={() => setIsModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <div style={{ display: "flex", gap: 16 }}>
            <Form.Item
              name="code"
              label="Mã ký hiệu"
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="VD: WFH" />
            </Form.Item>
            <Form.Item name="factor" label="Hệ số công" style={{ width: 120 }}>
              <InputNumber min={0} step={0.5} style={{ width: "100%" }} />
            </Form.Item>
          </div>

          <Form.Item
            name="name"
            label="Tên diễn giải"
            rules={[{ required: true }]}
          >
            <Input placeholder="VD: Làm việc tại nhà" />
          </Form.Item>

          <Form.Item
            name="category"
            label="Thuộc nhóm chế độ"
            rules={[{ required: true }]}
          >
            <Select options={CATEGORY_OPTIONS} />
          </Form.Item>

          <Form.Item
            name="color"
            label="Màu hiển thị"
            rules={[{ required: true }]}
            initialValue="#1677ff"
          >
            <ColorPicker showText />
          </Form.Item>

          <Form.Item name="description" label="Mô tả thêm">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </AdminLayout>
  );
}
