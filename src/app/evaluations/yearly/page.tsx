// src/app/evaluations/yearly/page.tsx

"use client";

import React, { useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Table, Button, message, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";

// [QUAN TRỌNG] Import Component lọc dùng chung
import CommonFilter, { FilterResult } from "@/components/CommonFilter";

const { Title } = Typography;

// --- INTERFACES ---
interface YearlyData {
    id: number;
    code: string;
    fullName: string;
    departmentName: string;
    kipName: string;
    monthlyGrades: (string | null)[]; // Mảng 12 phần tử cho 12 tháng
    summary: { A: number; B: number; C: number };
}

export default function YearlyEvaluationPage() {
    const router = useRouter();

    // --- STATE ---
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<YearlyData[]>([]);

    // State để hiển thị năm trên tiêu đề (mặc định năm nay)
    const [displayYear, setDisplayYear] = useState<number>(dayjs().year());

    // --- FETCH DATA (Gọi khi bộ lọc thay đổi) ---
    const fetchData = async (filter: FilterResult) => {
        // Cập nhật năm hiển thị trên tiêu đề
        setDisplayYear(filter.date.year());

        // Nếu chưa chọn phòng ban -> Xóa bảng
        if (!filter.realDepartmentIds || filter.realDepartmentIds.length === 0) {
            setData([]);
            return;
        }

        setLoading(true);
        try {
            const year = filter.date.year();
            let url = `/api/evaluations/yearly?year=${year}`;

            if (filter.factoryId) {
                url += `&factoryId=${filter.factoryId}`;
            }

            // Gửi danh sách ID phòng ban đã giải mã
            url += `&departmentId=${filter.realDepartmentIds.join(",")}`;

            // Gửi danh sách Kíp (nếu có)
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
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    // Callback từ Component con
    const handleFilterChange = (result: FilterResult) => {
        fetchData(result);
    };

    // --- COLUMNS ---
    const columns = useMemo(() => {
        const baseCols: any[] = [
            {
                title: "STT",
                width: 50,
                align: "center",
                fixed: "left",
                render: (_: any, __: any, i: number) => i + 1,
            },
            {
                title: "Họ và Tên",
                dataIndex: "fullName",
                width: 180,
                fixed: "left",
                render: (t: string, r: YearlyData) => (
                    <div>
                        <div style={{ fontWeight: 500 }}>{t}</div>
                        <div style={{ fontSize: 11, color: "#888" }}>{r.kipName}</div>
                    </div>
                ),
            },
        ];

        // Tạo cột cho 12 tháng
        const monthCols = [];
        for (let i = 1; i <= 12; i++) {
            monthCols.push({
                title: `T${i}`,
                width: 50,
                align: "center",
                render: (_: any, r: YearlyData) => {
                    const grade = r.monthlyGrades[i - 1]; // Index 0 là T1
                    let color = "#000";
                    if (grade?.startsWith("A")) color = "green";
                    if (grade?.startsWith("B")) color = "blue";
                    if (grade?.startsWith("C")) color = "red";
                    return <b style={{ color }}>{grade || "-"}</b>;
                },
            });
        }

        // Cột Tổng hợp cuối cùng
        const summaryCols = [
            {
                title: "Tổng A",
                width: 60,
                align: "center",
                fixed: "right",
                render: (_: any, r: YearlyData) => (
                    <b style={{ color: "green" }}>{r.summary.A || "-"}</b>
                ),
            },
            {
                title: "Tổng B",
                width: 60,
                align: "center",
                fixed: "right",
                render: (_: any, r: YearlyData) => (
                    <b style={{ color: "blue" }}>{r.summary.B || "-"}</b>
                ),
            },
            {
                title: "Tổng C",
                width: 60,
                align: "center",
                fixed: "right",
                render: (_: any, r: YearlyData) => (
                    <b style={{ color: "red" }}>{r.summary.C || "-"}</b>
                ),
            },
        ];

        return [...baseCols, ...monthCols, ...summaryCols];
    }, []);

    return (
        <AdminLayout>
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: 'center' }}>
                <Title level={3} style={{ margin: 0 }}>Tổng hợp xếp loại năm {displayYear}</Title>
                <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => router.push("/evaluations/monthly")}
                >
                    Về xếp loại tháng
                </Button>
            </div>

            {/* --- SỬ DỤNG COMPONENT LỌC DÙNG CHUNG --- */}
            <CommonFilter
                dateMode="year" // Chế độ chọn Năm
                onFilterChange={handleFilterChange}
            />

            <Table
                dataSource={data}
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