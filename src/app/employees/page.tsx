"use client";

import React, { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useSession } from "next-auth/react";
import {
  Table, Button, Modal, Form, Input, message, Select, DatePicker, Tag,
  Card, Space, type TableProps, Divider, Radio
} from "antd";
import {
  PlusOutlined, EditOutlined, FilterOutlined, PhoneOutlined, SearchOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";

// --- 1. DEFINITIONS (INTERFACES) ---
interface Factory {
  id: number; code: string; name: string;
}
interface Department {
  id: number; name: string; factory?: Factory;
}
interface Kip {
  id: number; name: string; factoryId: number; factory?: Factory;
}

interface Employee {
  id: number;
  code: string;
  fullName: string;
  birthday?: string;
  gender?: string;
  phone: string;
  department?: Department;
  kip?: Kip;
  position?: string;
  address?: string;
  startDate?: string;
  idCardNumber?: string;
  idCardDate?: string;
  idCardPlace?: string;
  bankAccount?: string;
  taxCode?: string;
  isActive?: boolean; // [MỚI] Trạng thái làm việc
}

export default function EmployeePage() {
  const { data: session } = useSession();
  const isViewOnly = !["ADMIN", "HR_MANAGER"].includes(session?.user?.role || "");

  // --- STATE ---
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [kips, setKips] = useState<Kip[]>([]);
  const [loading, setLoading] = useState(false);

  // State Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<number | null>(null);

  // State Bộ lọc
  const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<boolean | null>(null); // Lọc theo trạng thái

  // --- FETCH DATA ---
  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const [empRes, deptRes, kipRes] = await Promise.all([
        fetch("/api/employees"), fetch("/api/departments"), fetch("/api/kips"),
      ]);
      setEmployees(await empRes.json());
      setDepartments(await deptRes.json());
      setKips(await kipRes.json());
    } catch (error) {
      message.error("Lỗi tải dữ liệu: " + error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEmployees(); }, []);

  // --- MEMOIZED DATA ---
  const factories = useMemo(() => {
    const map = new Map();
    departments.forEach((d) => { if (d.factory) map.set(d.factory.id, d.factory); });
    return Array.from(map.values()) as Factory[];
  }, [departments]);

  const availableDepartments = useMemo(() => {
    if (!selectedFactoryId) return departments;
    return departments.filter((d) => d.factory?.id === selectedFactoryId);
  }, [departments, selectedFactoryId]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchFactory = selectedFactoryId ? emp.department?.factory?.id === selectedFactoryId : true;
      const matchDept = selectedDeptId ? emp.department?.id === selectedDeptId : true;
      const matchStatus = selectedStatus !== null ? emp.isActive === selectedStatus : true;
      const matchName = searchText
        ? emp.fullName.toLowerCase().includes(searchText.toLowerCase()) ||
        emp.code.toLowerCase().includes(searchText.toLowerCase())
        : true;
      return matchFactory && matchDept && matchName && matchStatus;
    });
  }, [employees, selectedFactoryId, selectedDeptId, searchText, selectedStatus]);

  // --- ACTIONS ---
  const handleEdit = (record: Employee) => {
    setEditingId(record.id);
    form.setFieldsValue({
      ...record,
      birthday: record.birthday ? dayjs(record.birthday) : null,
      departmentId: record.department?.id,
      kipId: record.kip?.id,
      startDate: record.startDate ? dayjs(record.startDate) : null,
      idCardDate: record.idCardDate ? dayjs(record.idCardDate) : null,
      isActive: record.isActive !== undefined ? record.isActive : true, // Set trạng thái vào form
    });
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true }); // Mặc định là Đang làm việc khi thêm mới
    setIsModalOpen(true);
  };

  const handleOK = async () => {
    try {
      const values = await form.validateFields();

      // Helper format ngày
      const fmtDate = (d: any) => d ? d.format("YYYY-MM-DD") + "T00:00:00.000Z" : null;

      const payload = {
        ...values,
        birthday: fmtDate(values.birthday),
        startDate: fmtDate(values.startDate),
        idCardDate: fmtDate(values.idCardDate),
      };

      const url = editingId ? `/api/employees/${editingId}` : "/api/employees";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        message.success(editingId ? "Cập nhật xong!" : "Thêm mới xong!");
        setIsModalOpen(false);
        form.resetFields();
        setEditingId(null);
        fetchEmployees();
      } else {
        message.error("Có lỗi xảy ra");
      }
    } catch (error) {
      console.log("Validate Failed", error);
    }
  };

  // --- COLUMNS ---
  // --- COLUMNS ---
  const columns: TableProps<Employee>["columns"] = [
    {
      title: "Mã NV", dataIndex: "code", key: "code", width: 90,
      render: (text: string) => <b>{text}</b>,
    },
    { title: "Họ tên", dataIndex: "fullName", key: "fullName", width: 180 },
    {
      title: "Kíp / Tổ", dataIndex: "kip", key: "kip", width: 130,
      render: (kip: Kip | null) => <Tag color={kip ? "geekblue" : "default"}>{kip ? kip.name : "HC/Khác"}</Tag>,
    },
    {
      title: "Bộ phận", dataIndex: "department", key: "department", width: 200,
      render: (dept: Department) => (
        <div>
          <div>{dept?.name}</div>
          {dept?.factory && <small style={{ color: "#888" }}>({dept.factory.name})</small>}
        </div>
      ),
    },
    { title: "Chức vụ", dataIndex: "position", key: "position", width: 120 },
    {
      title: "Trạng thái", dataIndex: "isActive", key: "isActive", width: 130,
      align: "center" as const, // <-- [SỬA Ở ĐÂY] Thêm as const
      render: (isActive: boolean) => (
        <Tag color={isActive ? "success" : "error"}>
          {isActive ? "Đang làm việc" : "Đã nghỉ việc"}
        </Tag>
      ),
    },
    {
      title: "Hành động", key: "action", width: 90,
      align: "center" as const, // <-- [SỬA Ở ĐÂY] Thêm as const
      render: (_: any, record: any) => (
        <Button type="text" icon={<EditOutlined />} style={{ color: "blue" }} onClick={() => handleEdit(record)} />
      ),
    },
  ].filter((col) => !isViewOnly || col.key !== "action");

  // --- RENDER UI ---
  return (
    <AdminLayout>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="text-2xl font-bold">Quản lý nhân sự ({filteredEmployees.length})</h2>
        {!isViewOnly && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>Thêm nhân viên</Button>
        )}
      </div>

      <Card size="small" style={{ marginBottom: 16, background: "#f5f5f5" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600 }}><FilterOutlined /> Bộ lọc:</span>
          <Input placeholder="Tìm tên hoặc mã NV..." prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />} style={{ width: 200 }} value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear />
          <Select style={{ width: 180 }} placeholder="Tất cả Nhà máy" allowClear value={selectedFactoryId} onChange={(val) => { setSelectedFactoryId(val); setSelectedDeptId(null); }}>
            {factories.map((f) => <Select.Option key={f.id} value={f.id}>{f.name}</Select.Option>)}
          </Select>
          <Select style={{ width: 180 }} placeholder="Tất cả Phòng ban" allowClear value={selectedDeptId} onChange={(val) => setSelectedDeptId(val)} disabled={!selectedFactoryId && departments.length > 50}>
            {availableDepartments.map((d) => <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>)}
          </Select>
          <Select style={{ width: 160 }} placeholder="Trạng thái làm việc" allowClear value={selectedStatus} onChange={(val) => setSelectedStatus(val)}>
            <Select.Option value={true}>Đang làm việc</Select.Option>
            <Select.Option value={false}>Đã nghỉ việc</Select.Option>
          </Select>
          {(selectedFactoryId || selectedDeptId || searchText || selectedStatus !== null) && (
            <Button type="link" onClick={() => { setSelectedFactoryId(null); setSelectedDeptId(null); setSearchText(""); setSelectedStatus(null); }}>Xóa lọc</Button>
          )}
        </div>
      </Card>

      <Table columns={columns} dataSource={filteredEmployees} rowKey="id" loading={loading} bordered scroll={{ x: 1000 }} pagination={{ pageSize: 20, showSizeChanger: true }} />

      {/* --- MODAL FORM --- */}
      <Modal
        title={editingId ? "Cập nhật thông tin" : "Thêm mới nhân viên"}
        open={isModalOpen}
        onOk={handleOK}
        onCancel={() => setIsModalOpen(false)}
        width={800}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical">
          <Divider style={{ marginTop: 0 }}>Thông tin cơ bản</Divider>

          {/* Dòng trạng thái nổi bật lên trên cùng */}
          <div style={{ display: "flex", gap: 16 }}>
            <Form.Item name="isActive" label="Trạng thái làm việc" rules={[{ required: true }]}>
              <Radio.Group buttonStyle="solid">
                <Radio.Button value={true}>Đang làm việc</Radio.Button>
                <Radio.Button value={false}>Đã nghỉ việc</Radio.Button>
              </Radio.Group>
            </Form.Item>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            <Form.Item name="code" label="Mã NV" style={{ flex: 1 }} rules={[{ required: true, message: "Bắt buộc" }]}>
              <Input placeholder="NV..." />
            </Form.Item>
            <Form.Item name="fullName" label="Họ và tên" style={{ flex: 2 }} rules={[{ required: true, message: "Bắt buộc" }]}>
              <Input placeholder="Nhập tên..." />
            </Form.Item>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            <Form.Item name="departmentId" label="Phòng ban / Công đoạn" style={{ flex: 1 }} rules={[{ required: true }]}>
              <Select placeholder="Chọn phòng ban" showSearch optionFilterProp="children">
                {departments.map((dept) => (
                  <Select.Option key={dept.id} value={dept.id}>{dept.name} - {dept.factory?.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="kipId" label="Kíp / Tổ (Tùy chọn)" style={{ flex: 1 }}>
              <Select placeholder="Chọn Kíp" allowClear>
                {kips.map((k) => (
                  <Select.Option key={k.id} value={k.id}>{k.name} - {k.factory?.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            <Form.Item name="position" label="Chức vụ" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="startDate" label="Ngày vào làm" style={{ flex: 1 }}>
              <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" placeholder="Chọn ngày" />
            </Form.Item>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            <Form.Item name="phone" label="Số điện thoại" style={{ flex: 1 }}>
              <Input prefix={<PhoneOutlined />} />
            </Form.Item>
            <Form.Item name="gender" label="Giới tính" style={{ width: 120 }}>
              <Select>
                <Select.Option value="Nam">Nam</Select.Option>
                <Select.Option value="Nữ">Nữ</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="birthday" label="Ngày sinh" style={{ flex: 1 }}>
              <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" placeholder="Chọn ngày" />
            </Form.Item>
          </div>

          <Form.Item name="address" label="Địa chỉ thường trú">
            <Input.TextArea rows={1} />
          </Form.Item>

          <Divider>Thông tin định danh & Ngân hàng</Divider>

          <div style={{ display: "flex", gap: 16 }}>
            <Form.Item name="idCardNumber" label="Số CCCD" style={{ flex: 1 }}>
              <Input placeholder="Số căn cước..." />
            </Form.Item>
            <Form.Item name="idCardDate" label="Ngày cấp" style={{ flex: 1 }}>
              <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" placeholder="Chọn ngày cấp" />
            </Form.Item>
            <Form.Item name="idCardPlace" label="Nơi cấp" style={{ flex: 1 }}>
              <Input placeholder="Cục CS..." />
            </Form.Item>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            <Form.Item name="bankAccount" label="Số tài khoản" style={{ flex: 1 }}>
              <Input placeholder="STK ngân hàng..." />
            </Form.Item>
            <Form.Item name="taxCode" label="Mã số thuế" style={{ flex: 1 }}>
              <Input placeholder="MST cá nhân..." />
            </Form.Item>
          </div>

        </Form>
      </Modal>
    </AdminLayout>
  );
}