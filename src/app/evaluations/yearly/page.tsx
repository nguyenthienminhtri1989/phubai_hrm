"use client";

import React, { useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Table, Button, message, Typography, Tabs } from "antd";
import { ArrowLeftOutlined, BarChartOutlined, CalendarOutlined, CheckSquareOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";

// Import Component lọc dùng chung
import CommonFilter, { FilterResult } from "@/components/CommonFilter";

const { Title } = Typography;

// --- INTERFACES ---
interface YearlyData {
    id: number;
    code: string;
    fullName: string;
    departmentName: string;
    kipName: string;
    data: (string | number | null)[]; // Mảng 12 phần tử (Chuỗi A/B/C hoặc Số công)
    summary: { col1: number; col2?: number; col3?: number };
}

export default function YearlyEvaluationPage() {
    const router = useRouter();

    // --- STATE ---
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<YearlyData[]>([]);
    const [displayYear, setDisplayYear] = useState<number>(dayjs().year());

    // State quản lý loại báo cáo
    const [reportType, setReportType] = useState<"evaluation" | "workday" | "leave">("evaluation");

    // State lưu filter hiện tại để gọi lại API khi đổi Tab
    const [activeFilter, setActiveFilter] = useState<FilterResult | null>(null);

    // --- FETCH DATA ---
    const fetchData = async (filter: FilterResult, type: string) => {
        setDisplayYear(filter.date.year());

        if (!filter.realDepartmentIds || filter.realDepartmentIds.length === 0) {
            setReportData([]);
            return;
        }

        setLoading(true);
        try {
            const year = filter.date.year();
            let url = `/api/reports/yearly?year=${year}&type=${type}`; // Gọi API mới

            if (filter.factoryId) url += `&factoryId=${filter.factoryId}`;
            url += `&departmentId=${filter.realDepartmentIds.join(",")}`;
            if (filter.selectedKipIds.length > 0) {
                url += `&kipIds=${filter.selectedKipIds.join(",")}`;
            }

            const res = await fetch(url);
            const result = await res.json();

            if (result.error) {
                message.error(result.error);
                setReportData([]);
            } else {
                setReportData(result);
            }
        } catch (err) {
            message.error("Lỗi tải dữ liệu");
            setReportData([]);
        } finally {
            setLoading(false);
        }
    };

    // --- HANDLERS ---
    const handleFilterChange = (result: FilterResult) => {
        setActiveFilter(result);
        fetchData(result, reportType);
    };

    const handleTabChange = (key: string) => {
        const newType = key as "evaluation" | "workday" | "leave";
        setReportType(newType);
        // Nếu đã có bộ lọc thì reload data theo type mới
        if (activeFilter) {
            fetchData(activeFilter, newType);
        }
    };

    // --- COLUMNS DEFINITION (Dynamic theo Report Type) ---
    const columns = useMemo(() => {
        const baseCols: any[] = [
            {
                title: "STT", width: 50, align: "center", fixed: "left",
                render: (_: any, __: any, i: number) => i + 1,
            },
            {
                title: "Họ và Tên", dataIndex: "fullName", width: 180, fixed: "left",
                render: (t: string, r: YearlyData) => (
                    <div>
                        <div style={{ fontWeight: 500 }}>{t}</div>
                        <div style={{ fontSize: 11, color: "#888" }}>
                            {r.kipName ? `Kíp: ${r.kipName}` : r.departmentName}
                        </div>
                    </div>
                ),
            },
        ];

        // Cột 12 tháng
        const monthCols = [];
        for (let i = 1; i <= 12; i++) {
            monthCols.push({
                title: `T${i}`,
                width: 50,
                align: "center",
                render: (_: any, r: YearlyData) => {
                    const val = r.data[i - 1]; // Giá trị tháng

                    if (reportType === "evaluation") {
                        // Logic màu sắc cho Xếp loại
                        let color = "#000";
                        const sVal = String(val || "");
                        if (sVal.startsWith("A")) color = "green";
                        if (sVal.startsWith("B")) color = "blue";
                        if (sVal.startsWith("C")) color = "red";
                        return <b style={{ color }}>{val || "-"}</b>;
                    } else {
                        // Logic hiển thị số (Công / Phép)
                        // Nếu là 0 thì hiển thị nhạt hoặc gạch
                        return <span style={{ color: val === 0 ? "#ccc" : "#000" }}>{val}</span>;
                    }
                },
            });
        }

        // Cột Tổng hợp (Khác nhau theo từng loại)
        let summaryCols: any[] = [];

        if (reportType === "evaluation") {
            summaryCols = [
                { title: "Tổng A", width: 60, align: "center", fixed: "right", render: (_: any, r: YearlyData) => <b style={{ color: "green" }}>{r.summary.col1}</b> },
                { title: "Tổng B", width: 60, align: "center", fixed: "right", render: (_: any, r: YearlyData) => <b style={{ color: "blue" }}>{r.summary.col2}</b> },
                { title: "Tổng C", width: 60, align: "center", fixed: "right", render: (_: any, r: YearlyData) => <b style={{ color: "red" }}>{r.summary.col3}</b> },
            ];
        } else if (reportType === "workday") {
            summaryCols = [
                {
                    title: "Tổng Công", width: 80, align: "center", fixed: "right",
                    render: (_: any, r: YearlyData) => <b style={{ color: "#1677ff", fontSize: 15 }}>{r.summary.col1}</b>
                },
            ];
        } else if (reportType === "leave") {
            summaryCols = [
                {
                    title: "Đã nghỉ", width: 70, align: "center", fixed: "right",
                    render: (_: any, r: YearlyData) => <b style={{ color: "#faad14" }}>{r.summary.col1}</b>
                },
                {
                    title: "Còn lại", width: 70, align: "center", fixed: "right",
                    render: (_: any, r: YearlyData) => {
                        const val = r.summary.col2 || 0;
                        // Nếu âm thì báo đỏ
                        return <b style={{ color: val < 0 ? "red" : "green" }}>{val}</b>
                    }
                },
            ];
        }

        return [...baseCols, ...monthCols, ...summaryCols];
    }, [reportType]); // Render lại cột khi đổi loại báo cáo

    // Cấu hình Tabs
    const items = [
        { key: 'evaluation', label: <span><CheckSquareOutlined /> Tổng hợp Xếp loại</span> },
        { key: 'workday', label: <span><BarChartOutlined /> Tổng công đi làm (+, XD)</span> },
        { key: 'leave', label: <span><CalendarOutlined /> Tổng hợp Phép (F)</span> },
    ];

    return (
        <AdminLayout>
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: 'center' }}>
                <Title level={3} style={{ margin: 0 }}>Báo cáo Tổng hợp Năm {displayYear}</Title>
                <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => router.push("/evaluations/monthly")}
                >
                    Về xếp loại tháng
                </Button>
            </div>

            <CommonFilter
                dateMode="year"
                onFilterChange={handleFilterChange}
            />

            {/* Tabs chuyển đổi báo cáo */}
            <Tabs
                defaultActiveKey="evaluation"
                items={items}
                onChange={handleTabChange}
                type="card"
                style={{ marginTop: 16 }}
            />

            <Table
                dataSource={reportData}
                columns={columns}
                rowKey="id"
                bordered
                pagination={false}
                scroll={{ x: "max-content", y: 600 }}
                loading={loading}
                size="small"
            />
        </AdminLayout>
    );
}