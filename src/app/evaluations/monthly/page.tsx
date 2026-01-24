"use client";

import React, { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    Table,
    Select,
    Button,
    message,
    Input,
    Typography,
    Popconfirm,
} from "antd";
import {
    SaveOutlined,
    ThunderboltOutlined,
    BarChartOutlined,
} from "@ant-design/icons";

// [QUAN TRỌNG] Import Component lọc dùng chung
import CommonFilter, { FilterResult } from "@/components/CommonFilter";

const { Title } = Typography;
const { Option } = Select;

// --- INTERFACES ---
interface EvaluationData {
    id: number;
    code: string;
    fullName: string;
    departmentName: string;
    kipName: string;
    grade: string | null;
    note: string;
}

export default function MonthlyEvaluationPage() {
    const { data: session } = useSession();
    const router = useRouter();

    // --- STATE ---
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<EvaluationData[]>([]);

    // State lưu các thay đổi chưa lưu
    const [changes, setChanges] = useState<Record<number, { grade: string; note: string }>>({});

    // State lưu bộ lọc hiện tại (để dùng cho hàm Save)
    const [currentFilter, setCurrentFilter] = useState<FilterResult | null>(null);

    // --- 1. FETCH DATA (Gọi khi CommonFilter thay đổi) ---
    const fetchData = async (filter: FilterResult) => {
        // Nếu chưa chọn phòng ban -> Xóa bảng & Xóa thay đổi
        if (!filter.realDepartmentIds || filter.realDepartmentIds.length === 0) {
            setData([]);
            setChanges({});
            return;
        }

        setLoading(true);
        // Reset thay đổi khi load dữ liệu mới
        setChanges({});

        try {
            const m = filter.date.month() + 1;
            const y = filter.date.year();

            let url = `/api/evaluations/monthly?month=${m}&year=${y}`;

            if (filter.factoryId) url += `&factoryId=${filter.factoryId}`;

            // Gửi danh sách ID phòng đã giải mã
            url += `&departmentId=${filter.realDepartmentIds.join(",")}`;

            // Gửi danh sách Kíp (nếu có) để backend lọc hiển thị nếu cần
            if (filter.selectedKipIds.length > 0) {
                url += `&kipIds=${filter.selectedKipIds.join(",")}`;
            }

            const res = await fetch(url);
            const result = await res.json();

            if (result.error) {
                message.error(result.error);
                setData([]);
            } else {
                setData(result);
            }
        } catch (err) {
            message.error("Lỗi tải dữ liệu");
        } finally {
            setLoading(false);
        }
    };

    // Callback từ Component con
    const handleFilterChange = (result: FilterResult) => {
        setCurrentFilter(result); // Lưu filter
        fetchData(result); // Load dữ liệu
    };

    // --- 2. LOGIC XỬ LÝ DỮ LIỆU (Giữ nguyên) ---
    const handleGradeChange = (empId: number, val: string) => {
        setChanges((prev) => ({
            ...prev,
            [empId]: {
                ...prev[empId],
                grade: val,
                note: prev[empId]?.note || getDataNote(empId)
            },
        }));
    };

    const handleNoteChange = (empId: number, val: string) => {
        setChanges((prev) => ({
            ...prev,
            [empId]: {
                ...prev[empId],
                grade: prev[empId]?.grade || getDataGrade(empId) || "",
                note: val
            },
        }));
    };

    const getDataGrade = (empId: number) => {
        if (changes[empId]?.grade !== undefined) return changes[empId].grade;
        const item = data.find((d) => d.id === empId);
        return item?.grade || undefined;
    };

    const getDataNote = (empId: number) => {
        if (changes[empId]?.note !== undefined) return changes[empId].note;
        const item = data.find((d) => d.id === empId);
        return item?.note || "";
    };

    const handleQuickFill = (targetGrade: string) => {
        const newChanges = { ...changes };
        data.forEach((emp) => {
            // Chỉ điền nếu chưa có giá trị
            newChanges[emp.id] = {
                grade: targetGrade,
                note: newChanges[emp.id]?.note || emp.note || ""
            };
        });
        setChanges(newChanges);
        message.success(`Đã xếp loại ${targetGrade} toàn bộ!`);
    };

    // --- 3. SAVE ---
    const handleSave = async () => {
        if (!currentFilter) return;

        const payload = data.map((emp) => {
            const changed = changes[emp.id];
            return {
                employeeId: emp.id,
                // Nếu có thay đổi thì lấy giá trị mới, không thì lấy giá trị cũ
                grade: changed ? changed.grade : emp.grade,
                note: changed ? changed.note : emp.note,
            };
        }).filter((item) => item.grade); // Chỉ lưu những người có xếp loại

        if (payload.length === 0) {
            message.warning("Không có dữ liệu để lưu");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/evaluations/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    month: currentFilter.date.month() + 1,
                    year: currentFilter.date.year(),
                    evaluations: payload,
                }),
            });

            if (res.ok) {
                message.success("Đã lưu thành công!");
                // Load lại data để clear state `changes` và cập nhật dữ liệu gốc
                fetchData(currentFilter);
            } else {
                message.error("Lỗi khi lưu");
            }
        } catch (e) {
            message.error("Lỗi kết nối");
        } finally {
            setLoading(false);
        }
    };

    // Quyền sửa: Không phải STAFF
    const canEdit = session?.user?.role !== "STAFF";

    const columns = [
        { title: "STT", key: "idx", width: 50, align: "center" as const, render: (_: any, __: any, i: number) => i + 1 },
        { title: "Mã NV", dataIndex: "code", key: "code", width: 80, render: (t: string) => <b>{t}</b> },
        { title: "Họ tên", dataIndex: "fullName", key: "fullName", width: 180, render: (t: string, r: EvaluationData) => (<div><div>{t}</div><div style={{ fontSize: 11, color: "#888" }}>{r.kipName}</div></div>) },
        {
            title: "Xếp loại", key: "grade", width: 100, align: "center" as const,
            render: (_: any, r: EvaluationData) => (
                <Select
                    style={{ width: 80 }}
                    value={getDataGrade(r.id)}
                    onChange={(val) => handleGradeChange(r.id, val)}
                    placeholder="-"
                    disabled={!canEdit}
                >
                    <Option value="A"><span style={{ color: "green", fontWeight: "bold" }}>A</span></Option>
                    <Option value="A-">A-</Option>
                    <Option value="B"><span style={{ color: "blue", fontWeight: "bold" }}>B</span></Option>
                    <Option value="B-">B-</Option>
                    <Option value="C"><span style={{ color: "red", fontWeight: "bold" }}>C</span></Option>
                </Select>
            )
        },
        { title: "Ghi chú / Lý do", key: "note", render: (_: any, r: EvaluationData) => (<Input disabled={!canEdit} value={getDataNote(r.id)} onChange={(e) => handleNoteChange(r.id, e.target.value)} placeholder="Ghi chú..." maxLength={100} />) },
    ];

    return (
        <AdminLayout>
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Title level={3} style={{ margin: 0 }}>Xếp loại nhân viên tháng</Title>
                <Button type="primary" icon={<BarChartOutlined />} onClick={() => router.push('/evaluations/yearly')}>
                    Xem Tổng hợp Năm
                </Button>
            </div>

            {/* --- SỬ DỤNG COMPONENT LỌC (Thay thế toàn bộ Card cũ) --- */}
            <CommonFilter
                dateMode="month" // Chế độ Tháng
                onFilterChange={handleFilterChange}
            />

            {/* Thanh công cụ (Điền nhanh & Lưu) */}
            {data.length > 0 && canEdit && (
                <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", padding: 12, borderRadius: 8, border: "1px solid #f0f0f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 500, color: "#666" }}>
                            <ThunderboltOutlined style={{ color: "#faad14" }} /> Điền nhanh:
                        </span>
                        <Popconfirm title="Xếp loại A tất cả?" onConfirm={() => handleQuickFill("A")}>
                            <Button>Tất cả A</Button>
                        </Popconfirm>
                    </div>

                    <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        size="large"
                        onClick={handleSave}
                        loading={loading}
                        style={{ background: "#217346", borderColor: "#217346" }}
                    >
                        Lưu thay đổi ({Object.keys(changes).length})
                    </Button>
                </div>
            )}

            {/* Bảng dữ liệu */}
            {data.length > 0 ? (
                <Table
                    dataSource={data}
                    columns={columns}
                    rowKey="id"
                    bordered
                    pagination={false}
                    scroll={{ y: 600 }}
                    loading={loading}
                    size="small"
                />
            ) : (
                <div style={{ textAlign: "center", padding: "50px", color: "#999", background: "#fff", border: "1px dashed #ddd" }}>
                    Vui lòng chọn điều kiện lọc để xem danh sách.
                </div>
            )}
        </AdminLayout>
    );
}