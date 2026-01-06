"use client";

import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  DatePicker,
  Input,
  Tag,
  message,
  Card,
  Typography,
  Space,
} from "antd";
import {
  DeleteOutlined,
  PlusOutlined,
  LockOutlined,
  EditOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function LockRulesPage() {
  const [rules, setRules] = useState([]);
  const [factories, setFactories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // State quản lý Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null); // Lưu bản ghi đang sửa

  const [form] = Form.useForm();

  // Load dữ liệu
  const fetchData = async () => {
    setLoading(true);
    try {
      const [rulesRes, factRes] = await Promise.all([
        fetch("/api/admin/lock-rules"),
        fetch("/api/factories"),
      ]);
      if (rulesRes.ok) setRules(await rulesRes.json());
      if (factRes.ok) setFactories(await factRes.json());
    } catch (error) {
      message.error("Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Mở Modal để TẠO MỚI
  const openCreateModal = () => {
    setEditingRule(null); // Xóa trạng thái sửa
    form.resetFields(); // Xóa form
    setIsModalOpen(true);
  };

  // Mở Modal để SỬA
  const openEditModal = (record: any) => {
    setEditingRule(record); // Lưu bản ghi đang sửa
    // Điền dữ liệu cũ vào form
    form.setFieldsValue({
      factoryId: record.factoryId ? record.factoryId : "ALL",
      dateRange: [dayjs(record.fromDate), dayjs(record.toDate)],
      reason: record.reason,
    });
    setIsModalOpen(true);
  };

  // Xử lý chung cho cả TẠO và SỬA
  const handleFinish = async (values: any) => {
    try {
      const payload = {
        factoryId: values.factoryId === "ALL" ? null : values.factoryId,
        fromDate: values.dateRange[0].format("YYYY-MM-DD"),
        toDate: values.dateRange[1].format("YYYY-MM-DD"),
        reason: values.reason,
        id: editingRule ? editingRule.id : undefined, // Nếu đang sửa thì gửi kèm ID
      };

      // Quyết định gọi API nào (POST hay PUT)
      const method = editingRule ? "PUT" : "POST";
      const url = "/api/admin/lock-rules";

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        message.success(
          editingRule ? "Đã cập nhật thành công!" : "Đã tạo lệnh khóa mới!"
        );
        setIsModalOpen(false);
        form.resetFields();
        setEditingRule(null);
        fetchData(); // Load lại bảng
      } else {
        message.error("Lỗi khi lưu dữ liệu");
      }
    } catch (e) {
      message.error("Lỗi kết nối");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bạn có chắc chắn muốn XÓA luật này không?")) return;
    try {
      const res = await fetch(`/api/admin/lock-rules?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        message.success("Đã xóa thành công");
        fetchData();
      } else {
        message.error("Không thể xóa");
      }
    } catch (e) {
      message.error("Lỗi kết nối");
    }
  };

  const columns = [
    {
      title: "Phạm vi áp dụng",
      dataIndex: "factory",
      render: (factory: any) =>
        factory ? (
          <Tag color="blue">{factory.name}</Tag>
        ) : (
          <Tag color="red">TOÀN CÔNG TY</Tag>
        ),
    },
    {
      title: "Từ ngày",
      dataIndex: "fromDate",
      render: (d: string) => dayjs(d).format("DD/MM/YYYY"),
    },
    {
      title: "Đến ngày",
      dataIndex: "toDate",
      render: (d: string) => dayjs(d).format("DD/MM/YYYY"),
    },
    {
      title: "Lý do / Ghi chú",
      dataIndex: "reason",
    },
    {
      title: "Hành động",
      key: "action",
      render: (_: any, record: any) => (
        <Space>
          {/* Nút Sửa */}
          <Button
            type="primary"
            ghost
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            Sửa
          </Button>

          {/* Nút Xóa */}
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            Xóa
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <Title level={3}>Quản lý Khóa sổ & Kỳ lương</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreateModal}
        >
          Tạo lệnh khóa mới
        </Button>
      </div>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            <LockOutlined /> Quản lý các quy tắc chặn sửa dữ liệu chấm công.
          </Text>
        </div>
        <Table
          rowKey="id"
          dataSource={rules}
          columns={columns}
          loading={loading}
          pagination={false}
        />
      </Card>

      {/* MODAL (Dùng chung cho Tạo và Sửa) */}
      <Modal
        title={editingRule ? "Cập nhật Lệnh khóa" : "Thiết lập Khóa sổ mới"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleFinish}>
          {/* Chỉ cho phép sửa Nhà máy khi tạo mới (để tránh lỗi logic khi sửa). 
              Nếu bạn muốn cho sửa cả nhà máy thì bỏ prop disabled đi */}
          <Form.Item
            name="factoryId"
            label="Phạm vi khóa"
            initialValue="ALL"
            rules={[{ required: true }]}
          >
            <Select disabled={!!editingRule}>
              <Select.Option value="ALL">
                🚫 KHÓA TOÀN BỘ HỆ THỐNG
              </Select.Option>
              {factories.map((f) => (
                <Select.Option key={f.id} value={f.id}>
                  {f.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="dateRange"
            label="Khoảng thời gian cấm sửa"
            rules={[{ required: true, message: "Vui lòng chọn ngày" }]}
          >
            <RangePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item name="reason" label="Lý do / Ghi chú">
            <Input placeholder="Ví dụ: Chốt công tháng 1" />
          </Form.Item>

          <div style={{ textAlign: "right", marginTop: 20 }}>
            <Button
              onClick={() => setIsModalOpen(false)}
              style={{ marginRight: 8 }}
            >
              Hủy
            </Button>
            <Button type="primary" htmlType="submit">
              {editingRule ? "Lưu thay đổi" : "Xác nhận Khóa"}
            </Button>
          </div>
        </Form>
      </Modal>
    </AdminLayout>
  );
}
