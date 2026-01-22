"use client";

import React, { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import {
    Table,
    Select,
    Button,
    DatePicker,
    message,
    Card,
    Typography,
} from "antd";
import { FilterOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useRouter } from "next/navigation"; // Để làm nút quay lại

const { Title } = Typography;
const { Option } = Select;

// --- INTERFACES ---
interface YearlyData {
    id: number;
    code: string;
    fullName: string;
    departmentName: string;
    kipName: string;
    monthlyGrades: (string | null)[]; // Mảng 12 phần tử
    summary: { A: number; B: number; C: number };
}
interface Factory { id: number; name: string; }
interface Department { id: number; code: string; name: string; factory?: Factory; }
interface Kip { id: number; name: string; factoryId: number; }
interface DeptOption { value: string; label: string; type: "SECTION" | "DEPT"; }

export default function YearlyEvaluationPage() {
    const router = useRouter();

    // --- STATE ---
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<YearlyData[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [kips, setKips] = useState<Kip[]>([]);

    // Filter State
    const [selectedYear, setSelectedYear] = useState<Dayjs>(dayjs());
    const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(null);
    const [mixedDeptValues, setMixedDeptValues] = useState<string[]>([]);
    const [selectedKipIds, setSelectedKipIds] = useState<number[]>([]);

    const MATRIX_FACTORY_IDS = [1, 2, 3];

    // --- LOAD DANH MỤC ---
    useEffect(() => {
        Promise.all([
            fetch("/api/departments").then((res) => res.json()),
            fetch("/api/kips").then((res) => res.json()),
        ]).then(([d, k]) => {
            setDepartments(d);
            setKips(k);
        });
    }, []);

    // --- LOGIC FILTER (Ma trận) ---
    const factories = useMemo(() => {
        const map = new Map();
        departments.forEach((d) => { if (d.factory) map.set(d.factory.id, d.factory); });
        return Array.from(map.values()) as Factory[];
    }, [departments]);

    const availableDepartments = useMemo(() => {
        if (!selectedFactoryId) return [];
        return departments.filter((d) => d.factory?.id === selectedFactoryId);
    }, [departments, selectedFactoryId]);

    const isMatrix = useMemo(() => (selectedFactoryId ? MATRIX_FACTORY_IDS.includes(selectedFactoryId) : false), [selectedFactoryId]);

    const mixedDeptOptions = useMemo<DeptOption[]>(() => {
        if (!selectedFactoryId) return [];
        const options: DeptOption[] = [];
        const processedSections = new Set<string>();

        availableDepartments.forEach((d) => {
            const matrixRegex = new RegExp(`^${selectedFactoryId}([a-zA-Z]+)(\\d+)$`);
            const match = d.code?.match(matrixRegex);

            if (isMatrix && match) {
                const sectionCode = match[1];
                if (!processedSections.has(sectionCode)) {
                    const displayName = d.name.replace(/(kíp|ca)\s*\d+.*$/gi, "").replace(/-+.*$/gi, "").trim();
                    options.push({ value: `SECTION:${sectionCode}`, label: displayName, type: "SECTION" });
                    processedSections.add(sectionCode);
                }
            } else {
                options.push({ value: `DEPT:${d.id}`, label: d.name, type: "DEPT" });
            }
        });
        return options.sort((a, b) => a.label.localeCompare(b.label));
    }, [availableDepartments, selectedFactoryId, isMatrix]);

    const resolveRealDepartmentIds = (): number[] => {
        if (!selectedFactoryId || mixedDeptValues.length === 0) return [];
        let targetKipNumbers: string[] = [];
        if (selectedKipIds.length > 0) {
            targetKipNumbers = kips.filter((k) => selectedKipIds.includes(k.id)).map((k) => k.name.match(/\d+/)?.[0] || "").filter(Boolean);
        }
        const allRealIds: number[] = [];
        mixedDeptValues.forEach((val) => {
            if (val.startsWith("DEPT")) {
                const id = parseInt(val.split(":")[1]);
                if (!isNaN(id)) allRealIds.push(id);
            } else if (val.startsWith("SECTION")) {
                const sectionCode = val.split(":")[1];
                availableDepartments.forEach((d) => {
                    const regex = new RegExp(`^${selectedFactoryId}${sectionCode}(\\d+)$`);
                    const match = d.code?.match(regex);
                    if (match && (targetKipNumbers.length === 0 || targetKipNumbers.includes(match[1]))) {
                        allRealIds.push(d.id);
                    }
                });
            }
        });
        return Array.from(new Set(allRealIds));
    };

    // --- FETCH DATA ---
    const fetchData = async () => {
        if (mixedDeptValues.length === 0) {
            setData([]);
            return;
        }
        setLoading(true);
        try {
            const year = selectedYear.year();
            let url = `/api/evaluations/yearly?year=${year}`;
            if (selectedFactoryId) url += `&factoryId=${selectedFactoryId}`;
            const deptIds = resolveRealDepartmentIds();
            if (deptIds.length > 0) url += `&departmentId=${deptIds.join(",")}`;
            if (selectedKipIds.length > 0) url += `&kipIds=${selectedKipIds.join(",")}`;

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

    // AUTO FETCH
    useEffect(() => {
        if (mixedDeptValues.length > 0) {
            const timer = setTimeout(() => fetchData(), 500);
            return () => clearTimeout(timer);
        } else {
            setData([]);
        }
    }, [selectedFactoryId, mixedDeptValues, selectedKipIds, selectedYear]);

    const handleReset = () => {
        setSelectedFactoryId(null);
        setMixedDeptValues([]);
        setSelectedKipIds([]);
        setData([]);
    };

    // --- COLUMNS ---
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
                        <div style={{ fontSize: 11, color: '#888' }}>{r.kipName}</div>
                    </div>
                )
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
                    const grade = r.monthlyGrades[i - 1]; // Index 0 -> T1
                    let color = "#000";
                    if (grade?.startsWith("A")) color = "green";
                    if (grade?.startsWith("B")) color = "blue";
                    if (grade?.startsWith("C")) color = "red";
                    return <b style={{ color }}>{grade || "-"}</b>;
                }
            });
        }

        // Cột Tổng hợp
        const summaryCols = [
            {
                title: "Tổng A", width: 60, align: "center", fixed: "right",
                render: (_: any, r: YearlyData) => <b style={{ color: 'green' }}>{r.summary.A || '-'}</b>
            },
            {
                title: "Tổng B", width: 60, align: "center", fixed: "right",
                render: (_: any, r: YearlyData) => <b style={{ color: 'blue' }}>{r.summary.B || '-'}</b>
            },
            {
                title: "Tổng C", width: 60, align: "center", fixed: "right",
                render: (_: any, r: YearlyData) => <b style={{ color: 'red' }}>{r.summary.C || '-'}</b>
            },
        ];

        return [...baseCols, ...monthCols, ...summaryCols];
    }, []);

    return (
        <AdminLayout>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                <Title level={3}>Tổng hợp xếp loại năm {selectedYear.year()}</Title>
                <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/evaluations/monthly')}>
                    Về xếp loại tháng
                </Button>
            </div>

            <Card size="small" style={{ marginBottom: 16, background: "#f0f2f5" }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>

                    {/* CHỌN NĂM */}
                    <div>
                        <div style={{ fontWeight: 500 }}>Năm:</div>
                        <DatePicker
                            picker="year"
                            value={selectedYear}
                            onChange={(val) => val && setSelectedYear(val)}
                            allowClear={false}
                            style={{ width: 100 }}
                        />
                    </div>

                    <div>
                        <div style={{ fontWeight: 500 }}>Nhà máy:</div>
                        <Select
                            style={{ width: 160 }}
                            placeholder="Chọn NM"
                            value={selectedFactoryId}
                            onChange={(val) => {
                                setSelectedFactoryId(val);
                                setMixedDeptValues([]);
                                setSelectedKipIds([]);
                                setData([]);
                            }}
                        >
                            {factories.map((f) => <Option key={f.id} value={f.id}>{f.name}</Option>)}
                        </Select>
                    </div>

                    <div>
                        <div style={{ fontWeight: 500 }}>{isMatrix ? "Tổ / Bộ phận:" : "Phòng ban:"}</div>
                        <Select
                            mode="multiple"
                            style={{ width: 250 }}
                            placeholder="Chọn..."
                            value={mixedDeptValues}
                            onChange={setMixedDeptValues}
                            disabled={!selectedFactoryId}
                            maxTagCount="responsive"
                        >
                            {mixedDeptOptions.map((o) => <Option key={o.value} value={o.value}>{o.label}</Option>)}
                        </Select>
                    </div>

                    <div>
                        <div style={{ fontWeight: 500 }}>Kíp:</div>
                        <Select
                            mode="multiple"
                            style={{ width: 140 }}
                            placeholder="Kíp..."
                            value={selectedKipIds}
                            onChange={setSelectedKipIds}
                            disabled={!selectedFactoryId}
                        >
                            {kips.filter((k) => k.factoryId === selectedFactoryId).map((k) => <Option key={k.id} value={k.id}>{k.name}</Option>)}
                        </Select>
                    </div>

                    <div style={{ marginTop: 20 }}>
                        <Button danger icon={<FilterOutlined />} onClick={handleReset} disabled={!selectedFactoryId}>
                            Xóa lọc
                        </Button>
                    </div>
                </div>
            </Card>

            <Table
                dataSource={data}
                columns={columns}
                rowKey="id"
                bordered
                pagination={false}
                scroll={{ x: 'max-content', y: 600 }}
                loading={loading}
                size="small"
            />
        </AdminLayout>
    );
}