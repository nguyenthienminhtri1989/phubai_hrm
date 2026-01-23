"use client";

import React, { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import {
    Card, Form, Select, Input, DatePicker, Button, Table, Row, Col, Typography, message, Tag, Modal, Popconfirm, Tooltip
} from "antd";
import { PlusOutlined, ClockCircleOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

// --- INTERFACES ---
interface Factory { id: number; name: string; }
interface Department { id: number; code: string; name: string; factory?: Factory; }
interface Employee { id: number; code: string; fullName: string; }
interface OvertimeRecord {
    id: number;
    content: string;
    startTime: string;
    endTime: string;
    totalMinutes: number;
    employeeId: number; // Để fill vào form edit
    employee: {
        fullName: string;
        code: string;
        department: { name: string; factory: { name: string } };
    };
}

export default function OvertimePage() {
    const [form] = Form.useForm();
    const [editForm] = Form.useForm(); // Form riêng cho Modal sửa

    // State Data
    const [departments, setDepartments] = useState<Department[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [records, setRecords] = useState<OvertimeRecord[]>([]);

    // State Filter & UI
    const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(null);
    const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
    const [viewMonth, setViewMonth] = useState<Dayjs>(dayjs()); // Tháng xem danh sách
    const [loading, setLoading] = useState(false);

    // State Edit Modal
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingRecord, setEditingRecord] = useState<OvertimeRecord | null>(null);

    // 1. Load Departments
    useEffect(() => {
        fetch("/api/departments").then(res => res.json()).then(setDepartments).catch(() => { });
    }, []);

    // 2. Logic Filter Departments
    const factories = useMemo(() => {
        const map = new Map();
        departments.forEach((d) => { if (d.factory) map.set(d.factory.id, d.factory); });
        return Array.from(map.values()) as Factory[];
    }, [departments]);

    const filteredDepartments = useMemo(() => {
        if (!selectedFactoryId) return [];
        return departments.filter(d => d.factory?.id === selectedFactoryId && !/^\d/.test(d.code));
    }, [departments, selectedFactoryId]);

    // 3. Load Employees & Records
    const loadEmployees = async (deptId: number) => {
        try {
            const res = await fetch(`/api/employees?departmentId=${deptId}`);
            setEmployees(await res.json());
        } catch (e) { message.error("Lỗi tải NV"); }
    };

    const loadRecords = async (deptId: number | null) => {
        // Nếu chưa chọn phòng thì có thể không load hoặc load rỗng
        if (!deptId) { setRecords([]); return; }

        try {
            const m = viewMonth.month() + 1;
            const y = viewMonth.year();
            const res = await fetch(`/api/overtime?departmentId=${deptId}&month=${m}&year=${y}`);
            setRecords(await res.json());
        } catch (e) { message.error("Lỗi tải lịch sử"); }
    };

    // Trigger khi đổi View Month
    useEffect(() => {
        if (selectedDeptId) loadRecords(selectedDeptId);
    }, [viewMonth]);

    // 4. Handlers UI
    const handleFactoryChange = (val: number) => {
        setSelectedFactoryId(val);
        setSelectedDeptId(null);
        setEmployees([]);
        setRecords([]);
        form.resetFields(["departmentId", "employeeId"]);
    };

    const handleDeptChange = (deptId: number) => {
        setSelectedDeptId(deptId);
        form.setFieldsValue({ employeeId: null });
        loadEmployees(deptId);
        loadRecords(deptId); // Load danh sách ngay khi chọn phòng
    };

    // 5. CRUD Operations
    const handleCreate = async (values: any) => {
        setLoading(true);
        try {
            const { employeeId, content, timeRange } = values;
            const res = await fetch("/api/overtime", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId, content, startTime: timeRange[0], endTime: timeRange[1] }),
            });
            if (res.ok) {
                message.success("Thêm thành công");
                form.resetFields(["employeeId", "content", "timeRange"]);
                loadRecords(selectedDeptId); // Reload table
            } else {
                message.error("Lỗi thêm mới");
            }
        } catch (e) { message.error("Lỗi kết nối"); } finally { setLoading(false); }
    };

    const handleDelete = async (id: number) => {
        try {
            const res = await fetch(`/api/overtime?id=${id}`, { method: "DELETE" });
            if (res.ok) {
                message.success("Đã xóa");
                // Cập nhật UI ngay lập tức
                setRecords(prev => prev.filter(r => r.id !== id));
            } else message.error("Lỗi xóa");
        } catch (e) { message.error("Lỗi kết nối"); }
    };

    const openEditModal = (record: OvertimeRecord) => {
        setEditingRecord(record);
        // Fill data vào form edit
        editForm.setFieldsValue({
            content: record.content,
            timeRange: [dayjs(record.startTime), dayjs(record.endTime)]
        });
        setIsModalVisible(true);
    };

    const handleUpdate = async () => {
        try {
            const values = await editForm.validateFields();
            const res = await fetch("/api/overtime", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: editingRecord?.id,
                    content: values.content,
                    startTime: values.timeRange[0],
                    endTime: values.timeRange[1]
                }),
            });
            if (res.ok) {
                message.success("Cập nhật thành công");
                setIsModalVisible(false);
                loadRecords(selectedDeptId);
            } else message.error("Lỗi cập nhật");
        } catch (e) { /* Validate fail */ }
    };

    // Helper
    const formatDuration = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return h > 0 ? `${h}h ${m}p` : `${m}p`;
    };

    // Columns
    const columns = [
        { title: "Ngày", dataIndex: "startTime", width: 90, render: (d: string) => dayjs(d).format("DD/MM") },
        { title: "Tên NV", dataIndex: ["employee", "fullName"], render: (t: string) => <b>{t}</b> },
        { title: "Nội dung", dataIndex: "content" },
        {
            title: "Giờ", width: 110, render: (_: any, r: OvertimeRecord) => (
                <div style={{ fontSize: 11 }}>
                    <span style={{ color: "green" }}>{dayjs(r.startTime).format("HH:mm")}</span> - <span style={{ color: "red" }}>{dayjs(r.endTime).format("HH:mm")}</span>
                </div>
            )
        },
        { title: "Tổng", dataIndex: "totalMinutes", align: "center" as const, width: 80, render: (m: number) => <Tag color="blue">{formatDuration(m)}</Tag> },
        {
            title: "", width: 80, align: "center" as const,
            render: (_: any, r: OvertimeRecord) => (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <Tooltip title="Sửa"><Button type="text" icon={<EditOutlined style={{ color: 'orange' }} />} size="small" onClick={() => openEditModal(r)} /></Tooltip>
                    <Popconfirm title="Xóa dòng này?" onConfirm={() => handleDelete(r.id)}>
                        <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                    </Popconfirm>
                </div>
            )
        }
    ];

    return (
        <AdminLayout>
            <Title level={3}>Ghi nhận làm thêm giờ</Title>

            <Row gutter={16}>
                {/* --- CỘT TRÁI: FORM NHẬP --- */}
                <Col xs={24} md={8}>
                    <Card title={<span><PlusOutlined /> Nhập liệu mới</span>} bordered={false}>
                        <Form layout="vertical" form={form} onFinish={handleCreate}>
                            <Form.Item label="Nhà máy">
                                <Select placeholder="Chọn Nhà máy..." onChange={handleFactoryChange}>
                                    {factories.map(f => <Select.Option key={f.id} value={f.id}>{f.name}</Select.Option>)}
                                </Select>
                            </Form.Item>
                            <Form.Item label="Phòng ban" name="departmentId" rules={[{ required: true }]}>
                                <Select placeholder="Chọn phòng..." onChange={handleDeptChange} disabled={!selectedFactoryId} showSearch optionFilterProp="children">
                                    {filteredDepartments.map(d => <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>)}
                                </Select>
                            </Form.Item>
                            <Form.Item label="Nhân viên" name="employeeId" rules={[{ required: true }]}>
                                <Select placeholder="Chọn NV..." disabled={!selectedDeptId} showSearch optionFilterProp="children">
                                    {employees.map(e => <Select.Option key={e.id} value={e.id}>{e.fullName}</Select.Option>)}
                                </Select>
                            </Form.Item>
                            <Form.Item label="Thời gian" name="timeRange" rules={[{ required: true }]}>
                                <RangePicker showTime={{ format: 'HH:mm' }} format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
                            </Form.Item>
                            <Form.Item label="Nội dung" name="content" rules={[{ required: true }]}>
                                <TextArea rows={2} />
                            </Form.Item>
                            <Button type="primary" htmlType="submit" block loading={loading} icon={<ClockCircleOutlined />}>Lưu</Button>
                        </Form>
                    </Card>
                </Col>

                {/* --- CỘT PHẢI: DANH SÁCH --- */}
                <Col xs={24} md={16}>
                    <Card
                        title={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span>Danh sách làm thêm</span>
                                <DatePicker picker="month" value={viewMonth} onChange={(val) => val && setViewMonth(val)} allowClear={false} format="MM/YYYY" style={{ width: 110 }} size="small" />
                            </div>
                        }
                        extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => loadRecords(selectedDeptId)} />}
                        bordered={false}
                    >
                        {!selectedDeptId ? (
                            <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>Vui lòng chọn Phòng ban để xem danh sách</div>
                        ) : (
                            <Table dataSource={records} columns={columns} rowKey="id" pagination={{ pageSize: 8 }} size="small" />
                        )}
                    </Card>
                </Col>
            </Row>

            {/* --- MODAL SỬA --- */}
            <Modal
                title="Sửa thông tin làm thêm"
                open={isModalVisible}
                onOk={handleUpdate}
                onCancel={() => setIsModalVisible(false)}
                okText="Cập nhật"
                cancelText="Hủy"
            >
                <Form form={editForm} layout="vertical">
                    <div style={{ marginBottom: 16 }}>
                        <b>Nhân viên:</b> {editingRecord?.employee.fullName}
                    </div>
                    <Form.Item label="Thời gian mới" name="timeRange" rules={[{ required: true }]}>
                        <RangePicker showTime={{ format: 'HH:mm' }} format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item label="Nội dung" name="content" rules={[{ required: true }]}>
                        <TextArea rows={3} />
                    </Form.Item>
                </Form>
            </Modal>
        </AdminLayout>
    );
}