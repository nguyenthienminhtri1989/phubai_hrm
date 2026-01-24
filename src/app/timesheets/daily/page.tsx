"use client";

import React, { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useSession } from "next-auth/react";
import {
    Table,
    Select,
    Button,
    message,
    Input,
    Tag,
    Space,
    Typography,
    Alert,
} from "antd";
import { SaveOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

// [QUAN TRỌNG] Import Component lọc dùng chung
import CommonFilter, { FilterResult } from "@/components/CommonFilter";

const { Title } = Typography;

// --- INTERFACES ---
interface AttendanceCode {
    id: number;
    code: string;
    name: string;
    color: string;
}

interface TimesheetRow {
    employeeId: number;
    employeeCode: string;
    fullName: string;
    attendanceCodeId: number | null;
    note: string;
    updatedAt?: string;
    departmentName?: string;
    kipName?: string;
}

export default function DailyTimesheetPage() {
    const { data: session } = useSession();
    const isViewOnly = session?.user?.role === "LEADER";

    // --- STATE ---
    const [employees, setEmployees] = useState<TimesheetRow[]>([]);
    const [attendanceCodes, setAttendanceCodes] = useState<AttendanceCode[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Lưu trữ kết quả lọc hiện tại để dùng cho hàm Save và Reload
    const [currentFilter, setCurrentFilter] = useState<FilterResult | null>(null);

    // 1. Chỉ cần tải danh sách Mã công (Danh mục Phòng/Kíp đã do CommonFilter lo)
    useEffect(() => {
        const fetchCodes = async () => {
            try {
                const res = await fetch("/api/attendance-codes");
                const codes: AttendanceCode[] = await res.json();

                // Sắp xếp mã công theo ưu tiên
                const PRIORITY = ["+", "XD", "ĐC", "X/2", "F", "NB", "Ô", "XL", "L", "TS"];
                codes.sort((a, b) => {
                    const iA = PRIORITY.indexOf(a.code), iB = PRIORITY.indexOf(b.code);
                    if (iA !== -1 && iB !== -1) return iA - iB;
                    if (iA !== -1) return -1;
                    if (iB !== -1) return 1;
                    return a.code.localeCompare(b.code);
                });
                setAttendanceCodes(codes);
            } catch (error) {
                message.error("Lỗi tải mã chấm công");
            }
        };
        fetchCodes();
    }, []);

    // --- HÀM TẢI DỮ LIỆU (Gọi mỗi khi bộ lọc thay đổi) ---
    const fetchTimesheetData = async (filter: FilterResult) => {
        // Nếu chưa chọn phòng ban nào -> Xóa bảng
        if (!filter.realDepartmentIds || filter.realDepartmentIds.length === 0) {
            setEmployees([]);
            return;
        }

        setLoading(true);
        try {
            const dateStr = filter.date.format("YYYY-MM-DD");
            // Gửi danh sách ID phòng ban đã được CommonFilter giải mã (VD: 15,16,17)
            const deptParam = filter.realDepartmentIds.join(",");

            const url = `/api/timesheets/daily?date=${dateStr}&departmentId=${deptParam}`;

            const res = await fetch(url);
            if (!res.ok) throw new Error("Lỗi tải");
            const data = await res.json();
            setEmployees(data);
        } catch (error) {
            message.error("Lỗi tải dữ liệu");
            setEmployees([]);
        } finally {
            setLoading(false);
        }
    };

    // --- CALLBACK TỪ COMPONENT LỌC ---
    const handleFilterChange = (result: FilterResult) => {
        setCurrentFilter(result); // Lưu state để dùng khi Save
        fetchTimesheetData(result); // Gọi API
    };

    // --- HÀM LƯU DỮ LIỆU ---
    const handleSave = async () => {
        if (!currentFilter || employees.length === 0) return;

        const validRecords = employees.filter(
            (e) => e.attendanceCodeId !== null && e.attendanceCodeId !== undefined
        );

        if (validRecords.length === 0) {
            message.warning("Chưa có dữ liệu chấm công để lưu!");
            return;
        }

        setSaving(true);
        try {
            // Logic xác định ID phòng ban để check khóa sổ:
            // Nếu lọc ra đúng 1 phòng -> Gửi ID đó.
            // Nếu lọc ra nhiều phòng (VD: Tổ ghép gồm 3 phòng) -> Gửi null (Backend tự xử lý check từng NV)
            const payloadDeptId = currentFilter.realDepartmentIds.length === 1
                ? currentFilter.realDepartmentIds[0]
                : null;

            const payload = {
                date: currentFilter.date.format("YYYY-MM-DD"),
                departmentId: payloadDeptId,
                records: validRecords.map((e) => ({
                    employeeId: e.employeeId,
                    attendanceCodeId: e.attendanceCodeId,
                    note: e.note,
                })),
            };

            const res = await fetch("/api/timesheets/daily", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                message.success(`Lưu thành công ${validRecords.length} nhân viên!`);
                fetchTimesheetData(currentFilter); // Tải lại để cập nhật updatedAt
            } else {
                const err = await res.json();
                message.error(res.status === 403 ? `KHÓA SỔ: ${err.error}` : err.error || "Lỗi lưu");
            }
        } catch (error) {
            message.error("Lỗi kết nối");
        } finally {
            setSaving(false);
        }
    };

    // --- HELPERS (Logic UI nội bộ) ---
    const handleRowChange = (empId: number, field: string, value: any) => {
        const newData = [...employees];
        const index = newData.findIndex((i) => i.employeeId === empId);
        if (index > -1) {
            newData[index] = { ...newData[index], [field]: value };
            setEmployees(newData);
        }
    };

    const setAllStatus = (codeStr: string) => {
        const targetCode = attendanceCodes.find((c) => c.code === codeStr);
        if (!targetCode) return;
        setEmployees(employees.map((e) => ({ ...e, attendanceCodeId: targetCode.id })));
    };

    const timesheetStatus = useMemo(() => {
        if (employees.length === 0) return null;
        const hasData = employees.some((e) => e.attendanceCodeId !== null);
        const lastUpdate = employees.find((e) => e.updatedAt)?.updatedAt;
        return {
            isSubmitted: hasData,
            lastUpdate: lastUpdate ? dayjs(lastUpdate).format("HH:mm - DD/MM/YYYY") : null,
        };
    }, [employees]);

    // --- COLUMNS ---
    const columns = [
        {
            title: "STT",
            key: "index",
            width: 50,
            align: "center" as const,
            render: (_: any, __: any, index: number) => <span style={{ color: "#888" }}>{index + 1}</span>,
        },
        { title: "Họ và tên", dataIndex: "fullName", width: 220 },
        {
            title: "Bộ phận",
            key: "deptInfo",
            width: 150,
            render: (_: any, record: TimesheetRow) => (
                <div style={{ fontSize: 12 }}>
                    {record.kipName ? (
                        <Tag color="blue">{record.kipName}</Tag>
                    ) : (
                        <Tag>{record.departmentName}</Tag>
                    )}
                </div>
            ),
        },
        {
            title: "Trạng thái",
            dataIndex: "attendanceCodeId",
            width: 200,
            render: (value: number, record: TimesheetRow) => (
                <Select
                    value={value}
                    allowClear
                    style={{ width: "100%" }}
                    placeholder="Chọn"
                    disabled={isViewOnly}
                    onChange={(val) => handleRowChange(record.employeeId, "attendanceCodeId", val)}
                    options={attendanceCodes.map((c) => ({
                        value: c.id,
                        label: `${c.code} - ${c.name}`,
                        item: c,
                    }))}
                    optionRender={(opt) => (
                        <Space>
                            <Tag color={opt.data.item.color} style={{ fontWeight: "bold", minWidth: 40, textAlign: "center" }}>
                                {opt.data.item.code}
                            </Tag>
                            {opt.data.item.name}
                        </Space>
                    )}
                    labelRender={(props) => {
                        const c = attendanceCodes.find((x) => x.id === props.value);
                        return c ? (
                            <Tag color={c.color} style={{ fontWeight: "bold", width: "100%", textAlign: "center" }}>
                                {c.code} - {c.name}
                            </Tag>
                        ) : (props.label);
                    }}
                />
            ),
        },
        {
            title: "Ghi chú",
            dataIndex: "note",
            render: (txt: string, rec: TimesheetRow) => (
                <Input
                    value={txt}
                    disabled={isViewOnly}
                    onChange={(e) => handleRowChange(rec.employeeId, "note", e.target.value)}
                    placeholder="..."
                />
            ),
        },
    ];

    return (
        <AdminLayout>
            <Title level={3} style={{ marginBottom: 24 }}>Chấm công hàng ngày</Title>

            {/* --- SỬ DỤNG COMPONENT LỌC DÙNG CHUNG --- */}
            <CommonFilter
                dateMode="date" // Chế độ chọn Ngày
                onFilterChange={handleFilterChange}
            />

            {/* --- PHẦN HIỂN THỊ TRẠNG THÁI & BẢNG --- */}
            {employees.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                    {timesheetStatus?.isSubmitted ? (
                        <Alert
                            message={`Đã chấm công (Cập nhật: ${timesheetStatus.lastUpdate})`}
                            type="success"
                            showIcon
                        />
                    ) : (
                        <Alert message="Chưa có dữ liệu." type="info" showIcon />
                    )}
                </div>
            )}

            {employees.length > 0 ? (
                <>
                    <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
                        <Space>
                            <span style={{ fontWeight: 600 }}>Thao tác nhanh:</span>
                            <Button size="small" onClick={() => setAllStatus("+")}>Đi làm (+)</Button>
                            <Button size="small" onClick={() => setAllStatus("XD")}>Làm ca đêm (XD)</Button>
                            <Button size="small" onClick={() => setAllStatus("ĐC")}>Đảo ca (ĐC)</Button>
                        </Space>
                        {!isViewOnly && (
                            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
                                LƯU DỮ LIỆU
                            </Button>
                        )}
                    </div>
                    <Table
                        bordered
                        dataSource={employees}
                        columns={columns}
                        rowKey="employeeId"
                        loading={loading}
                        pagination={false}
                        scroll={{ y: 600 }}
                        size="middle"
                    />
                </>
            ) : (
                <div style={{ textAlign: "center", padding: "50px", color: "#999", background: "#fff", border: "1px dashed #ddd" }}>
                    Vui lòng chọn điều kiện lọc bên trên để hiển thị dữ liệu.
                </div>
            )}
        </AdminLayout>
    );
}