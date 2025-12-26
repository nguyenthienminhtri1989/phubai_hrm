"use client";

import React, { useEffect, useState, useMemo } from "react";
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
  DatePicker,
  Tag,
  Popconfirm,
  Card,
  Space,
  type TableProps,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  FilterOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PhoneOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

// --- 1. DEFINITIONS (INTERFACES) ---
interface Factory {
  id: number;
  code: string;
  name: string;
}

interface Department {
  id: number;
  name: string;
  factory?: Factory;
}

interface Kip {
  id: number;
  name: string;
  factoryId: number;
  factory?: Factory; // API trả về thêm cái này, ta khai báo để dùng luôn
}

interface Employee {
  id: number;
  code: string;
  fullName: string;
  birthday?: string;
  gender?: string;
  phone: string;
  department?: Department;
  kip?: Kip; // Thêm thông tin Kíp
  position?: string;
  address?: string;
}

export default function EmployeePage() {
  const { data: session } = useSession();

  // Kiểm tra quyền (Chỉ Admin/HR được sửa)
  const isViewOnly = !["ADMIN", "HR_MANAGER"].includes(
    session?.user?.role || ""
  );

  // --- STATE ---
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [kips, setKips] = useState<Kip[]>([]);
  const [loading, setLoading] = useState(false);

  // State cho Modal (Thêm/Sửa)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<number | null>(null);

  // State cho Bộ lọc (Filter)
  const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(
    null
  );
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);

  // State cho Bulk Update (Cập nhật hàng loạt)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkKipId, setBulkKipId] = useState<number | null>(null);

  // --- 2. FETCH DATA ---
  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const [empRes, deptRes, kipRes] = await Promise.all([
        fetch("/api/employees"),
        fetch("/api/departments"),
        fetch("/api/kips"),
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

  useEffect(() => {
    fetchEmployees();
  }, []);

  // --- 3. MEMOIZED DATA (TỐI ƯU HIỆU NĂNG) ---

  // Lấy danh sách Nhà máy từ danh sách Phòng ban (để lọc)
  const factories = useMemo(() => {
    const map = new Map();
    departments.forEach((d) => {
      if (d.factory) map.set(d.factory.id, d.factory);
    });
    return Array.from(map.values()) as Factory[];
  }, [departments]);

  // Dropdown Phòng ban phụ thuộc vào Nhà máy đang chọn
  const availableDepartments = useMemo(() => {
    if (!selectedFactoryId) return departments;
    return departments.filter((d) => d.factory?.id === selectedFactoryId);
  }, [departments, selectedFactoryId]);

  // Dropdown Kíp phụ thuộc vào Nhà máy đang chọn (trong bộ lọc)
  const availableKips = useMemo(() => {
    if (!selectedFactoryId) return kips;
    return kips.filter((k) => k.factoryId === selectedFactoryId);
  }, [kips, selectedFactoryId]);

  // Dữ liệu bảng (Sau khi lọc)
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchFactory = selectedFactoryId
        ? emp.department?.factory?.id === selectedFactoryId
        : true;
      const matchDept = selectedDeptId
        ? emp.department?.id === selectedDeptId
        : true;
      return matchFactory && matchDept;
    });
  }, [employees, selectedFactoryId, selectedDeptId]);

  // --- 4. ACTIONS (XỬ LÝ) ---

  // Xử lý Cập nhật hàng loạt (Kíp)
  const handleBulkUpdate = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning("Chưa chọn nhân viên nào!");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/employees/bulk-update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIds: selectedRowKeys,
          kipId: bulkKipId, // Nếu null thì hiểu là set về NULL (HC/Khác)
        }),
      });

      if (res.ok) {
        message.success("Cập nhật thành công!");
        setSelectedRowKeys([]);
        setBulkKipId(null);
        const empRes = await fetch("/api/employees");
        setEmployees(await empRes.json());
      } else {
        // --- SỬA ĐOẠN NÀY ---
        const errorData = await res.json(); // Đọc lỗi từ server
        console.error("Chi tiết lỗi:", errorData); // In ra console F12
        message.error("Lỗi: " + (errorData.error || "Không xác định")); // Hiển thị lên màn hình
        // --------------------
      }
    } catch (error) {
      message.error("Lỗi kết nối server");
    } finally {
      setLoading(false);
    }
  };

  // Xóa nhân viên
  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (res.ok) {
        message.success("Đã xóa!");
        fetchEmployees();
      } else {
        message.error("Lỗi khi xóa");
      }
    } catch (error) {
      message.error("Lỗi kết nối");
    }
  };

  // Mở modal sửa
  const handleEdit = (record: Employee) => {
    setEditingId(record.id);
    form.setFieldsValue({
      ...record,
      birthday: record.birthday ? dayjs(record.birthday) : null,
      departmentId: record.department?.id,
      kipId: record.kip?.id, // Load Kíp hiện tại lên form
    });
    setIsModalOpen(true);
  };

  // Mở modal thêm mới
  const openAddModal = () => {
    setEditingId(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  // Lưu form (Thêm/Sửa)
  const handleOK = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        birthday: values.birthday
          ? values.birthday.format("YYYY-MM-DD") + "T00:00:00.000Z"
          : null,
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

  // Cấu hình chọn dòng (Checkbox)
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
  };

  // --- 5. COLUMNS DEFINITION ---
  const columns: TableProps<Employee>["columns"] = [
    {
      title: "Mã NV",
      dataIndex: "code",
      key: "code",
      width: 90,
      render: (text: string) => <b>{text}</b>,
    },
    {
      title: "Họ tên",
      dataIndex: "fullName",
      key: "fullName",
      width: 180,
    },
    {
      title: "Kíp / Tổ", // CỘT QUAN TRỌNG VỪA THÊM
      dataIndex: "kip",
      key: "kip",
      width: 130,
      render: (kip: Kip | null) => (
        <Tag color={kip ? "geekblue" : "default"}>
          {kip ? kip.name : "HC/Khác"}
        </Tag>
      ),
    },
    {
      title: "Bộ phận",
      dataIndex: "department",
      key: "department",
      width: 200,
      render: (dept: Department) => (
        <div>
          <div>{dept?.name}</div>
          {dept?.factory && (
            <small style={{ color: "#888" }}>({dept.factory.name})</small>
          )}
        </div>
      ),
    },
    {
      title: "Chức vụ",
      dataIndex: "position",
      key: "position",
    },
    {
      title: "Hành động",
      key: "action",
      width: 100,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            style={{ color: "blue" }}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Xóa nhân viên này?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button type="text" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ].filter((col) => {
    if (isViewOnly && col.key === "action") return false;
    return true;
  });

  // --- 6. RENDER UI ---
  return (
    <AdminLayout>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 className="text-2xl font-bold">
          Quản lý nhân sự ({filteredEmployees.length})
        </h2>
        {!isViewOnly && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
            Thêm nhân viên
          </Button>
        )}
      </div>

      {/* --- CARD BỘ LỌC --- */}
      <Card size="small" style={{ marginBottom: 16, background: "#f5f5f5" }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontWeight: 600 }}>
            <FilterOutlined /> Lọc nhanh:
          </span>

          <Select
            style={{ width: 220 }}
            placeholder="Tất cả Nhà máy"
            allowClear
            value={selectedFactoryId}
            onChange={(val) => {
              setSelectedFactoryId(val);
              setSelectedDeptId(null);
            }}
          >
            {factories.map((f) => (
              <Select.Option key={f.id} value={f.id}>
                {f.name}
              </Select.Option>
            ))}
          </Select>

          <Select
            style={{ width: 220 }}
            placeholder="Tất cả Phòng ban"
            allowClear
            value={selectedDeptId}
            onChange={(val) => setSelectedDeptId(val)}
            disabled={!selectedFactoryId && departments.length > 50}
          >
            {availableDepartments.map((d) => (
              <Select.Option key={d.id} value={d.id}>
                {d.name}
              </Select.Option>
            ))}
          </Select>

          {(selectedFactoryId || selectedDeptId) && (
            <Button
              type="link"
              onClick={() => {
                setSelectedFactoryId(null);
                setSelectedDeptId(null);
              }}
            >
              Xóa lọc
            </Button>
          )}
        </div>
      </Card>

      {/* --- THANH CÔNG CỤ CẬP NHẬT HÀNG LOẠT (Chỉ hiện khi tick chọn) --- */}
      {selectedRowKeys.length > 0 && !isViewOnly && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 24px",
            background: "#e6f7ff",
            border: "1px solid #91d5ff",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <Space>
            <CheckCircleOutlined style={{ color: "#1890ff", fontSize: 20 }} />
            <span style={{ fontWeight: 600, fontSize: 16 }}>
              Đang chọn {selectedRowKeys.length} nhân viên
            </span>
          </Space>

          <Space>
            <span>Gán vào:</span>
            <Select
              style={{ width: 250 }}
              placeholder="Chọn Kíp / Tổ..."
              value={bulkKipId}
              onChange={setBulkKipId}
              allowClear
            >
              {/* HIỂN THỊ DANH SÁCH KÍP RÕ RÀNG */}
              {kips.map((k) => (
                <Select.Option key={k.id} value={k.id}>
                  {k.name} - {k.factory?.name}
                </Select.Option>
              ))}
            </Select>

            <Button
              type="primary"
              onClick={handleBulkUpdate}
              loading={loading}
              disabled={bulkKipId === undefined} // Cho phép null để xóa kíp, nhưng không được undefined
            >
              Cập nhật ngay
            </Button>
            <Button
              icon={<CloseCircleOutlined />}
              onClick={() => setSelectedRowKeys([])}
            >
              Hủy
            </Button>
          </Space>
        </div>
      )}

      {/* --- BẢNG DỮ LIỆU --- */}
      <Table
        rowSelection={!isViewOnly ? rowSelection : undefined} // Ẩn checkbox nếu chỉ xem
        columns={columns}
        dataSource={filteredEmployees}
        rowKey="id"
        loading={loading}
        bordered
        scroll={{ x: 900 }}
        pagination={{ pageSize: 20, showSizeChanger: true }} // Tăng pageSize để dễ tick chọn nhiều
      />

      {/* --- MODAL FORM --- */}
      <Modal
        title={editingId ? "Cập nhật thông tin" : "Thêm mới nhân viên"}
        open={isModalOpen}
        onOk={handleOK}
        onCancel={() => setIsModalOpen(false)}
        width={700}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical">
          <div style={{ display: "flex", gap: 16 }}>
            <Form.Item
              name="code"
              label="Mã NV"
              style={{ flex: 1 }}
              rules={[{ required: true, message: "Bắt buộc" }]}
            >
              <Input placeholder="NV..." />
            </Form.Item>
            <Form.Item
              name="fullName"
              label="Họ và tên"
              style={{ flex: 2 }}
              rules={[{ required: true, message: "Bắt buộc" }]}
            >
              <Input placeholder="Nhập tên..." />
            </Form.Item>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            <Form.Item
              name="departmentId"
              label="Phòng ban / Công đoạn"
              style={{ flex: 1 }}
              rules={[{ required: true }]}
            >
              <Select
                placeholder="Chọn phòng ban"
                showSearch
                optionFilterProp="children"
              >
                {departments.map((dept) => (
                  <Select.Option key={dept.id} value={dept.id}>
                    {dept.name} - {dept.factory?.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            {/* Ô CHỌN KÍP TRONG FORM */}
            <Form.Item
              name="kipId"
              label="Kíp / Tổ (Tùy chọn)"
              style={{ flex: 1 }}
            >
              <Select placeholder="Chọn Kíp (hoặc để trống)" allowClear>
                {kips.map((k) => (
                  <Select.Option key={k.id} value={k.id}>
                    {k.name} - {k.factory?.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            <Form.Item name="position" label="Chức vụ" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="phone" label="Số điện thoại" style={{ flex: 1 }}>
              <Input prefix={<PhoneOutlined />} />
            </Form.Item>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            <Form.Item name="birthday" label="Ngày sinh" style={{ flex: 1 }}>
              <DatePicker
                style={{ width: "100%" }}
                format="DD/MM/YYYY"
                placeholder="Chọn ngày"
              />
            </Form.Item>
            <Form.Item name="gender" label="Giới tính" style={{ width: 120 }}>
              <Select>
                <Select.Option value="Nam">Nam</Select.Option>
                <Select.Option value="Nữ">Nữ</Select.Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item name="address" label="Địa chỉ thường trú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </AdminLayout>
  );
}
