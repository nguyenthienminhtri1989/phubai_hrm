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
} from "antd";
import { DeleteOutlined, PlusOutlined, LockOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function LockRulesPage() {
  const [rules, setRules] = useState([]);
  const [factories, setFactories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  // Load dữ liệu
  const fetchData = async () => {
    setLoading(true);
    try {
      const [rulesRes, factRes] = await Promise.all([
        fetch("/api/admin/lock-rules"),
        fetch("/api/factories"), // API lấy danh sách nhà máy có sẵn của bạn
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

  // Xử lý tạo mới
  const handleCreate = async (values: any) => {
    try {
      const payload = {
        factoryId: values.factoryId === "ALL" ? null : values.factoryId,
        fromDate: values.dateRange[0].format("YYYY-MM-DD"),
        toDate: values.dateRange[1].format("YYYY-MM-DD"),
        reason: values.reason,
      };

      const res = await fetch("/api/admin/lock-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        message.success("Đã khóa sổ thành công!");
        setIsModalOpen(false);
        form.resetFields();
        fetchData(); // Load lại bảng
      } else {
        message.error("Lỗi khi tạo khóa");
      }
    } catch (e) {
      message.error("Lỗi kết nối");
    }
  };

  // Xử lý xóa (Mở khóa)
  const handleDelete = async (id: number) => {
    if (!confirm("Bạn có chắc chắn muốn MỞ KHÓA (xóa luật này) không?")) return;
    try {
      const res = await fetch(`/api/admin/lock-rules?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        message.success("Đã mở khóa thành công");
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
        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(record.id)}
        >
          Mở khóa
        </Button>
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
          onClick={() => setIsModalOpen(true)}
        >
          Tạo lệnh khóa mới
        </Button>
      </div>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            <LockOutlined /> Các khoảng thời gian dưới đây sẽ bị cấm chỉnh sửa
            dữ liệu chấm công. Xóa dòng để mở khóa.
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

      {/* MODAL TẠO KHÓA */}
      <Modal
        title="Thiết lập Khóa sổ mới"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="factoryId"
            label="Phạm vi khóa"
            initialValue="ALL"
            rules={[{ required: true }]}
          >
            <Select>
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
              Xác nhận Khóa
            </Button>
          </div>
        </Form>
      </Modal>
    </AdminLayout>
  );
}
