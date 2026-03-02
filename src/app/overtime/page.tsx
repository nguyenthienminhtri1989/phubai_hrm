"use client";

import React, { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useSession } from "next-auth/react";
import ExcelJS from "exceljs"; // [MỚI] Import ExcelJS
import { saveAs } from "file-saver"; // [MỚI] Import File Saver
import {
    Card,
    Form,
    Select,
    DatePicker,
    Button,
    Table,
    Row,
    Col,
    Typography,
    message,
    Tag,
    Modal,
    Popconfirm,
    Tooltip,
    Input,
    Divider,
} from "antd";
import {
    PlusOutlined,
    ClockCircleOutlined,
    EditOutlined,
    DeleteOutlined,
    UserOutlined,
    FilterOutlined,
    FileExcelOutlined, // [MỚI] Icon Excel
} from "@ant-design/icons";
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
    createdBy?: string;
    employeeId: number;
    employee: {
        fullName: string;
        code: string;
        departmentId: number;
        department: { id: number; name: string; factory: { name: string } };
    };
}

export default function OvertimePage() {
    const { data: session } = useSession();
    const [form] = Form.useForm();
    const [editForm] = Form.useForm();

    // --- STATE DỮ LIỆU ---
    const [departments, setDepartments] = useState<Department[]>([]);

    // State cho Form Nhập liệu (Cột trái)
    const [formEmployees, setFormEmployees] = useState<Employee[]>([]);
    const [selectedFormFactoryId, setSelectedFormFactoryId] = useState<number | null>(null);
    const [selectedFormDeptId, setSelectedFormDeptId] = useState<number | null>(null);

    // State cho Danh sách Xem (Cột phải)
    const [records, setRecords] = useState<OvertimeRecord[]>([]);
    const [filterFactoryId, setFilterFactoryId] = useState<number | null>(null);
    const [filterDeptId, setFilterDeptId] = useState<number | null>(null);
    const [viewMonth, setViewMonth] = useState<Dayjs>(dayjs());

    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false); // [MỚI] State loading riêng cho Excel
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingRecord, setEditingRecord] = useState<OvertimeRecord | null>(null);

    // --- 1. LOAD DANH MỤC PHÒNG BAN ---
    useEffect(() => {
        fetch("/api/departments")
            .then((res) => res.json())
            .then(setDepartments)
            .catch(() => message.error("Lỗi tải danh mục"));
    }, []);

    // --- 2. LOGIC PHÂN QUYỀN (QUAN TRỌNG) ---
    const userRole = session?.user?.role;
    const isStaff = userRole === "STAFF";
    const isManager = userRole === "TIMEKEEPER";
    const isAdmin = userRole === "ADMIN";

    const authorizedDepartments = useMemo(() => {
        if (!session || departments.length === 0) return [];
        if (["ADMIN", "HR_MANAGER", "LEADER"].includes(userRole as string)) {
            return departments;
        }
        if (isStaff || isManager) {
            const allowedIds = session.user.managedDeptIds || [];
            return departments.filter((d) => allowedIds.includes(d.id));
        }
        return [];
    }, [departments, session, userRole]);

    const officeDepartments = useMemo(() => {
        return authorizedDepartments.filter(d => !/^\d/.test(d.code));
    }, [authorizedDepartments]);

    const availableFactories = useMemo(() => {
        const map = new Map();
        officeDepartments.forEach((d) => {
            if (d.factory) map.set(d.factory.id, d.factory);
        });
        return Array.from(map.values()) as Factory[];
    }, [officeDepartments]);

    // --- 3. LOGIC TỰ ĐỘNG NHẬN DIỆN STAFF ---
    useEffect(() => {
        const autoSelectForStaff = async () => {
            if (isStaff && session?.user && officeDepartments.length > 0) {
                try {
                    const promises = officeDepartments.map(d =>
                        fetch(`/api/employees?departmentId=${d.id}`).then(r => r.json())
                    );
                    const results = await Promise.all(promises);
                    const allEmps: Employee[] = results.flat();

                    const me = allEmps.find(e => e.code.toLowerCase() === session.user.username.toLowerCase());

                    if (me) {
                        setFormEmployees([me]);
                        form.setFieldsValue({ employeeId: me.id });
                    }
                } catch (e) { console.error(e); }
            }
        };
        autoSelectForStaff();
    }, [isStaff, officeDepartments, session]);

    // --- 4. HANDLERS FORM NHẬP (CỘT TRÁI) ---
    const handleFormFactoryChange = (val: number) => {
        setSelectedFormFactoryId(val);
        setSelectedFormDeptId(null);
        setFormEmployees([]);
        form.setFieldsValue({ departmentId: null, employeeId: null });
    };

    const handleFormDeptChange = async (deptId: number) => {
        setSelectedFormDeptId(deptId);
        form.setFieldsValue({ employeeId: null });
        try {
            const res = await fetch(`/api/employees?departmentId=${deptId}`);
            setFormEmployees(await res.json());
        } catch (e) { message.error("Lỗi tải nhân viên"); }
    };

    const handleCreate = async (values: any) => {
        if (!session?.user?.name) return;
        setLoading(true);
        try {
            const res = await fetch("/api/overtime", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employeeId: values.employeeId,
                    content: values.content,
                    startTime: values.timeRange[0],
                    endTime: values.timeRange[1],
                    createdBy: session.user.username,
                }),
            });

            if (res.ok) {
                message.success("Đã lưu thành công!");
                form.resetFields(["content", "timeRange"]);
                if (!isStaff) form.resetFields(["employeeId"]);
                if (filterDeptId) loadRecords(filterDeptId);
            } else {
                message.error("Lỗi khi lưu");
            }
        } catch (e) { message.error("Lỗi kết nối"); } finally { setLoading(false); }
    };

    // --- 5. HANDLERS DANH SÁCH (CỘT PHẢI) ---
    const loadRecords = async (deptId: number | null) => {
        if (!deptId) { setRecords([]); return; }
        try {
            const m = viewMonth.month() + 1;
            const y = viewMonth.year();
            const res = await fetch(`/api/overtime?departmentId=${deptId}&month=${m}&year=${y}`);
            setRecords(await res.json());
        } catch (e) { message.error("Lỗi tải dữ liệu"); }
    };

    useEffect(() => {
        if (filterDeptId) loadRecords(filterDeptId);
    }, [viewMonth]);

    // --- 6. XỬ LÝ SỬA / XÓA ---
    const handleDelete = async (id: number) => {
        const res = await fetch(`/api/overtime?id=${id}`, { method: "DELETE" });
        if (res.ok) {
            message.success("Đã xóa");
            setRecords((prev) => prev.filter((r) => r.id !== id));
        } else message.error("Lỗi xóa");
    };

    const handleUpdate = async () => {
        const values = await editForm.validateFields();
        const res = await fetch("/api/overtime", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: editingRecord?.id,
                content: values.content,
                startTime: values.timeRange[0],
                endTime: values.timeRange[1],
            }),
        });
        if (res.ok) {
            message.success("Cập nhật xong");
            setIsModalVisible(false);
            if (filterDeptId) loadRecords(filterDeptId);
        } else message.error("Lỗi cập nhật");
    };

    // --- 7. [MỚI] HÀM XUẤT EXCEL ---
    const handleExportExcel = async () => {
        if (records.length === 0) {
            message.warning("Không có dữ liệu để xuất Excel");
            return;
        }

        setExporting(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("LamThemGio");

            worksheet.pageSetup = {
                paperSize: 9,
                orientation: "portrait",
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,
                margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 }
            };

            // Định nghĩa độ rộng cột
            worksheet.columns = [
                { width: 12 }, // Cột 1: Ngày
                { width: 25 }, // Cột 2: Tên nhân viên
                { width: 35 }, // Cột 3: Nội dung làm thêm
                { width: 15 }, // Cột 4: Giờ
                { width: 12 }, // Cột 5: Tổng giờ
            ];

            const totalCols = 5;

            // Dòng 1: Tên Công Ty
            const r1 = worksheet.getCell("A1");
            r1.value = "CÔNG TY CỔ PHẦN SỢI PHÚ BÀI";
            r1.font = { name: "Times New Roman", size: 12, bold: true };
            worksheet.mergeCells(1, 1, 1, totalCols);

            // Dòng 2: Tiêu đề Bảng
            const r2 = worksheet.getCell("A2");
            r2.value = `BẢNG TỔNG HỢP GIỜ LÀM THÊM THÁNG ${viewMonth.format("MM/YYYY")}`;
            r2.font = { name: "Times New Roman", size: 14, bold: true };
            r2.alignment = { horizontal: "center", vertical: "middle" };
            worksheet.mergeCells(2, 1, 2, totalCols);

            // Dòng 3: Tên Phòng Ban
            const dept = filterDepts.find(d => d.id === filterDeptId);
            const deptName = dept ? dept.name : "Chưa xác định";
            const r3 = worksheet.getCell("A3");
            r3.value = `Phòng / CĐ: ${deptName}`;
            r3.font = { name: "Times New Roman", size: 12, bold: true, italic: true };
            r3.alignment = { horizontal: "center", vertical: "middle" };
            worksheet.mergeCells(3, 1, 3, totalCols);

            // Dòng 4: Dòng trống tạo khoảng cách
            worksheet.addRow([]);

            // Dòng 5: Tiêu đề các cột
            const headerRow = worksheet.addRow([
                "Ngày",
                "Tên nhân viên làm thêm",
                "Nội dung làm thêm",
                "Giờ",
                "Tổng giờ"
            ]);
            headerRow.eachCell(cell => {
                cell.font = { name: "Times New Roman", bold: true };
                cell.alignment = { horizontal: "center", vertical: "middle" };
                cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
            });

            // Duyệt data điền vào bảng
            records.forEach(r => {
                // Đổi phút ra dạng Giờ và Phút (vd: 2h30 hoặc 2h)
                const h = Math.floor(r.totalMinutes / 60);
                const m = r.totalMinutes % 60;
                const timeStr = m > 0 ? `${h}h${m}` : `${h}h`;

                const row = worksheet.addRow([
                    dayjs(r.startTime).format("DD/MM/YYYY"),
                    r.employee.fullName,
                    r.content,
                    `${dayjs(r.startTime).format("HH:mm")} - ${dayjs(r.endTime).format("HH:mm")}`,
                    timeStr
                ]);

                // Định dạng viền và căn lề cho dòng data
                row.eachCell((cell, colNum) => {
                    cell.font = { name: "Times New Roman" };
                    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
                    if (colNum === 2 || colNum === 3) {
                        cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
                    } else {
                        cell.alignment = { horizontal: "center", vertical: "middle" };
                    }
                });
            });

            // Footer: Chữ ký xác nhận
            worksheet.addRow([]); // Thêm 1 dòng trống
            const signRowIndex = worksheet.lastRow!.number + 1;
            worksheet.mergeCells(signRowIndex, 3, signRowIndex, 5); // Gộp 3 cột bên phải lại để căn giữa
            const signCell = worksheet.getCell(signRowIndex, 3);
            signCell.value = "Xác nhận của trưởng Phòng / Công đoạn";
            signCell.font = { name: "Times New Roman", bold: true, italic: true };
            signCell.alignment = { horizontal: "center" };

            // Render và Tải File
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            saveAs(blob, `LamThemGio_${deptName}_${viewMonth.format("MM-YYYY")}.xlsx`);

        } catch (e) {
            message.error("Lỗi xuất file Excel");
        } finally {
            setExporting(false);
        }
    };

    // --- COLUMNS CHO BẢNG TRÊN WEB ---
    const columns = [
        { title: "Ngày", dataIndex: "startTime", width: 90, render: (d: string) => dayjs(d).format("DD/MM") },
        { title: "Nhân viên", dataIndex: ["employee", "fullName"], render: (t: string) => <b>{t}</b> },
        { title: "Nội dung", dataIndex: "content" },
        {
            title: "Giờ", width: 110, render: (_: any, r: OvertimeRecord) => (
                <div style={{ fontSize: 11 }}>
                    <span style={{ color: "green" }}>{dayjs(r.startTime).format("HH:mm")}</span> - <span style={{ color: "red" }}>{dayjs(r.endTime).format("HH:mm")}</span>
                </div>
            )
        },
        {
            title: "Tổng", dataIndex: "totalMinutes", align: "center" as const, width: 70, render: (m: number) => {
                const h = Math.floor(m / 60); const min = m % 60; return <Tag color="blue">{h}h{min > 0 ? min : ''}</Tag>;
            }
        },
        {
            title: <UserOutlined />, dataIndex: "createdBy", width: 70, align: 'center' as const,
            render: (u: string) => <span style={{ fontSize: 10, color: '#999' }}>{u}</span>
        },
        {
            title: "", width: 80, align: "center" as const,
            render: (_: any, r: OvertimeRecord) => {
                const checkAdmin = isAdmin;
                const checkOwner = session?.user?.username === r.createdBy;
                const managedIds = session?.user?.managedDeptIds || [];
                const checkManager = isManager && managedIds.includes(r.employee.departmentId);

                if (checkAdmin || checkOwner || checkManager) {
                    return (
                        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                            <Tooltip title="Sửa"><Button type="text" icon={<EditOutlined style={{ color: "orange" }} />} size="small" onClick={() => { setEditingRecord(r); editForm.setFieldsValue({ content: r.content, timeRange: [dayjs(r.startTime), dayjs(r.endTime)] }); setIsModalVisible(true); }} /></Tooltip>
                            <Popconfirm title="Xóa?" onConfirm={() => handleDelete(r.id)}><Button type="text" danger icon={<DeleteOutlined />} size="small" /></Popconfirm>
                        </div>
                    );
                }
                return null;
            },
        },
    ];

    const formDepts = useMemo(() => {
        if (!selectedFormFactoryId) return [];
        return officeDepartments.filter(d => d.factory?.id === selectedFormFactoryId);
    }, [officeDepartments, selectedFormFactoryId]);

    const filterDepts = useMemo(() => {
        if (!filterFactoryId) return [];
        return officeDepartments.filter(d => d.factory?.id === filterFactoryId);
    }, [officeDepartments, filterFactoryId]);

    return (
        <AdminLayout>
            <Title level={3}>Ghi nhận làm thêm giờ (OT)</Title>

            <Row gutter={16}>
                {/* === CỘT TRÁI: FORM NHẬP LIỆU === */}
                <Col xs={24} md={8}>
                    <Card title={<span><PlusOutlined /> Nhập liệu mới</span>} bordered={false}>
                        <Form layout="vertical" form={form} onFinish={handleCreate}>
                            {isStaff ? (
                                <>
                                    <Form.Item label="Nhân viên" tooltip="Hệ thống tự động nhận diện bạn">
                                        <Select disabled value={form.getFieldValue("employeeId")}>
                                            {formEmployees.map(e => <Select.Option key={e.id} value={e.id}>{e.fullName}</Select.Option>)}
                                        </Select>
                                    </Form.Item>
                                    <Form.Item name="employeeId" hidden rules={[{ required: true, message: "Không tìm thấy thông tin nhân viên của bạn" }]}><Input /></Form.Item>
                                </>
                            ) : (
                                <>
                                    <Form.Item label="Nhà máy">
                                        <Select placeholder="Chọn Nhà máy..." onChange={handleFormFactoryChange}>
                                            {availableFactories.map(f => <Select.Option key={f.id} value={f.id}>{f.name}</Select.Option>)}
                                        </Select>
                                    </Form.Item>
                                    <Form.Item label="Phòng ban" name="departmentId" rules={[{ required: true }]}>
                                        <Select placeholder="Chọn phòng..." onChange={handleFormDeptChange} disabled={!selectedFormFactoryId} showSearch optionFilterProp="children">
                                            {formDepts.map(d => <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>)}
                                        </Select>
                                    </Form.Item>
                                    <Form.Item label="Nhân viên" name="employeeId" rules={[{ required: true }]}>
                                        <Select placeholder="Chọn nhân viên..." disabled={!selectedFormDeptId} showSearch optionFilterProp="children">
                                            {formEmployees.map(e => <Select.Option key={e.id} value={e.id}>{e.fullName} ({e.code})</Select.Option>)}
                                        </Select>
                                    </Form.Item>
                                </>
                            )}

                            <Form.Item label="Thời gian" name="timeRange" rules={[{ required: true }]}>
                                <RangePicker showTime={{ format: "HH:mm" }} format="DD/MM/YYYY HH:mm" style={{ width: "100%" }} />
                            </Form.Item>
                            <Form.Item label="Nội dung" name="content" rules={[{ required: true }]}>
                                <TextArea rows={2} placeholder="Nội dung công việc..." />
                            </Form.Item>
                            <Button type="primary" htmlType="submit" block loading={loading} icon={<ClockCircleOutlined />}>Lưu bản ghi</Button>
                        </Form>
                    </Card>
                </Col>

                {/* === CỘT PHẢI: DANH SÁCH XEM & LỌC === */}
                <Col xs={24} md={16}>
                    <Card bordered={false}>
                        <div style={{ marginBottom: 16, padding: 12, background: "#f9f9f9", borderRadius: 8, border: "1px solid #eee", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                            <div>
                                <div style={{ fontWeight: 600, marginBottom: 8, color: '#1890ff' }}><FilterOutlined /> Bộ lọc danh sách:</div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <Select
                                        placeholder="Chọn Nhà máy" style={{ width: 150 }}
                                        onChange={(val) => { setFilterFactoryId(val); setFilterDeptId(null); setRecords([]); }}
                                    >
                                        {availableFactories.map(f => <Select.Option key={f.id} value={f.id}>{f.name}</Select.Option>)}
                                    </Select>
                                    <Select
                                        placeholder="Chọn Phòng ban để xem" style={{ flex: 1, minWidth: 200 }}
                                        disabled={!filterFactoryId}
                                        onChange={(val) => { setFilterDeptId(val); loadRecords(val); }}
                                    >
                                        {filterDepts.map(d => <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>)}
                                    </Select>
                                    <DatePicker picker="month" value={viewMonth} onChange={(val) => val && setViewMonth(val)} format="MM/YYYY" allowClear={false} style={{ width: 110 }} />
                                </div>
                            </div>

                            {/* [MỚI] NÚT XUẤT EXCEL */}
                            <div style={{ display: "flex", alignItems: "flex-end" }}>
                                <Button
                                    type="primary"
                                    style={{ background: "#217346", borderColor: "#217346" }}
                                    icon={<FileExcelOutlined />}
                                    onClick={handleExportExcel}
                                    disabled={records.length === 0}
                                    loading={exporting}
                                >
                                    Xuất Excel
                                </Button>
                            </div>
                        </div>

                        {!filterDeptId ? (
                            <div style={{ textAlign: "center", color: "#999", padding: 40, border: '1px dashed #ddd', borderRadius: 8 }}>
                                Vui lòng chọn Phòng ban bên trên để xem dữ liệu
                            </div>
                        ) : (
                            <Table dataSource={records} columns={columns} rowKey="id" pagination={{ pageSize: 8 }} size="small" />
                        )}
                    </Card>
                </Col>
            </Row>

            <Modal title="Sửa thông tin" open={isModalVisible} onOk={handleUpdate} onCancel={() => setIsModalVisible(false)} okText="Cập nhật" cancelText="Hủy">
                <Form form={editForm} layout="vertical">
                    <div style={{ marginBottom: 16 }}><b>Nhân viên:</b> {editingRecord?.employee.fullName}</div>
                    <Form.Item label="Thời gian mới" name="timeRange" rules={[{ required: true }]}><RangePicker showTime={{ format: "HH:mm" }} format="DD/MM/YYYY HH:mm" style={{ width: "100%" }} /></Form.Item>
                    <Form.Item label="Nội dung" name="content" rules={[{ required: true }]}><TextArea rows={3} /></Form.Item>
                </Form>
            </Modal>
        </AdminLayout>
    );
}