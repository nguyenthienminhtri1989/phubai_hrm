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
  Radio,
} from "antd";
import {
  DeleteOutlined,
  PlusOutlined,
  LockOutlined,
  EditOutlined,
  BankOutlined,
  ApartmentOutlined,
  GlobalOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function LockRulesPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [factories, setFactories] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // State quản lý Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);

  // Loại khóa đang chọn trong form
  const [lockType, setLockType] = useState<"ALL" | "FACTORY" | "DEPARTMENT">(
    "ALL",
  );

  const [form] = Form.useForm();

  // Load dữ liệu
  const fetchData = async () => {
    setLoading(true);
    try {
      const [rulesRes, factRes, deptRes] = await Promise.all([
        fetch("/api/admin/lock-rules"),
        fetch("/api/factories"),
        fetch("/api/departments"),
      ]);
      if (rulesRes.ok) setRules(await rulesRes.json());
      if (factRes.ok) setFactories(await factRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());
    } catch {
      message.error("Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Tính loại khóa từ record dữ liệu
  const getRuleType = (record: any): "ALL" | "FACTORY" | "DEPARTMENT" => {
    if (record.departments && record.departments.length > 0) return "DEPARTMENT";
    if (record.factoryId) return "FACTORY";
    return "ALL";
  };

  // Mở Modal để TẠO MỚI
  const openCreateModal = () => {
    setEditingRule(null);
    setLockType("ALL");
    form.resetFields();
    form.setFieldValue("lockType", "ALL");
    setIsModalOpen(true);
  };

  // Mở Modal để SỬA
  const openEditModal = (record: any) => {
    setEditingRule(record);
    const type = getRuleType(record);
    setLockType(type);

    form.setFieldsValue({
      lockType: type,
      factoryId: record.factoryId ?? undefined,
      departmentIds:
        type === "DEPARTMENT"
          ? record.departments.map((d: any) => d.departmentId)
          : undefined,
      dateRange: [dayjs(record.fromDate), dayjs(record.toDate)],
      reason: record.reason,
    });
    setIsModalOpen(true);
  };

  // Xử lý chung cho cả TẠO và SỬA
  const handleFinish = async (values: any) => {
    try {
      const payload: any = {
        lockType: values.lockType,
        fromDate: values.dateRange[0].format("YYYY-MM-DD"),
        toDate: values.dateRange[1].format("YYYY-MM-DD"),
        reason: values.reason,
      };

      if (values.lockType === "FACTORY") {
        payload.factoryId = values.factoryId;
      }
      if (values.lockType === "DEPARTMENT") {
        payload.departmentIds = values.departmentIds;
      }
      if (editingRule) {
        payload.id = editingRule.id;
      }

      const method = editingRule ? "PUT" : "POST";
      const res = await fetch("/api/admin/lock-rules", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        message.success(
          editingRule ? "Đã cập nhật thành công!" : "Đã tạo lệnh khóa mới!",
        );
        setIsModalOpen(false);
        form.resetFields();
        setEditingRule(null);
        fetchData();
      } else {
        message.error(data.error || "Lỗi khi lưu dữ liệu");
      }
    } catch {
      message.error("Lỗi kết nối");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bạn có chắc chắn muốn XÓA luật khóa này không?")) return;
    try {
      const res = await fetch(`/api/admin/lock-rules?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        message.success("Đã xóa thành công");
        fetchData();
      } else {
        const data = await res.json();
        message.error(data.error || "Không thể xóa");
      }
    } catch {
      message.error("Lỗi kết nối");
    }
  };

  // Nhóm phòng ban theo nhà máy để hiển thị trong Select
  const groupedDeptOptions = factories.map((factory) => ({
    label: factory.name,
    options: departments
      .filter((d) => d.factoryId === factory.id)
      .map((d) => ({
        label: d.name,
        value: d.id,
      })),
  }));

  const columns = [
    {
      title: "Loại khóa",
      key: "type",
      width: 150,
      render: (_: any, record: any) => {
        const type = getRuleType(record);
        if (type === "ALL")
          return <Tag color="red" icon={<GlobalOutlined />}>Toàn hệ thống</Tag>;
        if (type === "FACTORY")
          return <Tag color="orange" icon={<BankOutlined />}>Nhà máy</Tag>;
        return <Tag color="blue" icon={<ApartmentOutlined />}>Phòng ban</Tag>;
      },
    },
    {
      title: "Phạm vi áp dụng",
      key: "scope",
      render: (_: any, record: any) => {
        const type = getRuleType(record);
        if (type === "ALL") return <Text strong>Toàn bộ công ty</Text>;
        if (type === "FACTORY" && record.factory)
          return <Tag color="orange">{record.factory.name}</Tag>;
        if (type === "DEPARTMENT") {
          return (
            <Space size={[4, 4]} wrap>
              {record.departments.map((d: any) => (
                <Tag key={d.departmentId} color="blue">
                  {d.department?.name}
                </Tag>
              ))}
            </Space>
          );
        }
        return "-";
      },
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
          <Button
            type="primary"
            ghost
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            Sửa
          </Button>
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
        <Title level={3}>Quản lý Khóa sổ &amp; Kỳ lương</Title>
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
            Hệ thống hỗ trợ 3 cấp độ: Toàn công ty → Nhà máy → Phòng ban / Công đoạn cụ thể.
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
        onCancel={() => {
          setIsModalOpen(false);
          setEditingRule(null);
          form.resetFields();
        }}
        footer={null}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleFinish}>
          {/* CHỌN LOẠI KHÓA */}
          <Form.Item
            name="lockType"
            label="Loại khóa"
            initialValue="ALL"
            rules={[{ required: true }]}
          >
            <Radio.Group
              onChange={(e) => {
                setLockType(e.target.value);
                // Reset các field phụ khi đổi loại
                form.setFieldsValue({
                  factoryId: undefined,
                  departmentIds: undefined,
                });
              }}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="ALL">
                <GlobalOutlined /> Toàn hệ thống
              </Radio.Button>
              <Radio.Button value="FACTORY">
                <BankOutlined /> Theo nhà máy
              </Radio.Button>
              <Radio.Button value="DEPARTMENT">
                <ApartmentOutlined /> Theo phòng ban
              </Radio.Button>
            </Radio.Group>
          </Form.Item>

          {/* CHỌN NHÀ MÁY (chỉ hiện khi type = FACTORY) */}
          {lockType === "FACTORY" && (
            <Form.Item
              name="factoryId"
              label="Chọn nhà máy cần khóa"
              rules={[{ required: true, message: "Vui lòng chọn nhà máy" }]}
            >
              <Select placeholder="-- Chọn nhà máy --">
                {factories.map((f) => (
                  <Select.Option key={f.id} value={f.id}>
                    {f.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {/* CHỌN PHÒNG BAN (chỉ hiện khi type = DEPARTMENT) */}
          {lockType === "DEPARTMENT" && (
            <Form.Item
              name="departmentIds"
              label="Chọn phòng ban / công đoạn"
              rules={[
                {
                  required: true,
                  message: "Vui lòng chọn ít nhất một phòng ban",
                },
              ]}
            >
              <Select
                mode="multiple"
                allowClear
                placeholder="-- Chọn một hoặc nhiều phòng ban --"
                options={groupedDeptOptions}
                optionFilterProp="label"
                showSearch
              />
            </Form.Item>
          )}

          {/* KHOẢNG THỜI GIAN */}
          <Form.Item
            name="dateRange"
            label="Khoảng thời gian cấm sửa"
            rules={[{ required: true, message: "Vui lòng chọn ngày" }]}
          >
            <RangePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>

          {/* LÝ DO */}
          <Form.Item name="reason" label="Lý do / Ghi chú">
            <Input placeholder="Ví dụ: Chốt công tháng 1" />
          </Form.Item>

          <div style={{ textAlign: "right", marginTop: 20 }}>
            <Button
              onClick={() => {
                setIsModalOpen(false);
                setEditingRule(null);
                form.resetFields();
              }}
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
