//src/app/evaluations/monthly/page.tsx

"use client";

import { useRouter } from "next/navigation";
import { BarChartOutlined } from "@ant-design/icons";
import React, { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import {
    Table,
    Select,
    Button,
    DatePicker,
    message,
    Card,
    Input,
    Typography,
    Popconfirm,
} from "antd";
import {
    SaveOutlined,
    ReloadOutlined,
    ThunderboltOutlined,
    FilterOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";

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

interface Factory {
    id: number;
    name: string;
}
interface Department {
    id: number;
    code: string;
    name: string;
    factory?: Factory;
}
interface Kip {
    id: number;
    name: string;
    factoryId: number;
}
interface DeptOption {
    value: string;
    label: string;
    type: "SECTION" | "DEPT";
    code?: string;
    id?: number;
}

export default function MonthlyEvaluationPage() {
    const router = useRouter();

    // --- STATE ---
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<EvaluationData[]>([]);

    // Dữ liệu danh mục
    const [departments, setDepartments] = useState<Department[]>([]);
    const [kips, setKips] = useState<Kip[]>([]);

    // State Bộ lọc
    const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs());
    const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(null);
    const [mixedDeptValues, setMixedDeptValues] = useState<string[]>([]);
    const [selectedKipIds, setSelectedKipIds] = useState<number[]>([]);

    // State lưu thay đổi tạm thời
    const [changes, setChanges] = useState<Record<number, { grade: string; note: string }>>({});

    // [CẤU HÌNH] Danh sách ID nhà máy áp dụng logic gộp tổ (Matrix)
    const MATRIX_FACTORY_IDS = [1, 2, 3];

    // --- 1. LOAD DANH MỤC ---
    useEffect(() => {
        Promise.all([
            fetch("/api/departments").then((res) => res.json()),
            fetch("/api/kips").then((res) => res.json()),
        ]).then(([d, k]) => {
            setDepartments(d);
            setKips(k);
        });
    }, []);

    // --- 2. LOGIC FILTER ---
    const factories = useMemo(() => {
        const map = new Map();
        departments.forEach((d) => {
            if (d.factory) map.set(d.factory.id, d.factory);
        });
        return Array.from(map.values()) as Factory[];
    }, [departments]);

    const availableDepartments = useMemo(() => {
        if (!selectedFactoryId) return [];
        return departments.filter((d) => d.factory?.id === selectedFactoryId);
    }, [departments, selectedFactoryId]);

    const isMatrix = useMemo(
        () => (selectedFactoryId ? MATRIX_FACTORY_IDS.includes(selectedFactoryId) : false),
        [selectedFactoryId]
    );

    // Logic tạo option Gộp
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
                    const displayName = d.name
                        .replace(/(kíp|ca)\s*\d+.*$/gi, "")
                        .replace(/-+.*$/gi, "")
                        .trim();

                    options.push({
                        value: `SECTION:${sectionCode}`,
                        label: displayName,
                        type: "SECTION",
                        code: sectionCode,
                    });
                    processedSections.add(sectionCode);
                }
            } else {
                options.push({
                    value: `DEPT:${d.id}`,
                    label: d.name,
                    type: "DEPT",
                    id: d.id,
                });
            }
        });
        return options.sort((a, b) => a.label.localeCompare(b.label));
    }, [availableDepartments, selectedFactoryId, isMatrix]);

    // Logic Resolve ID
    const resolveRealDepartmentIds = (): number[] => {
        if (!selectedFactoryId || mixedDeptValues.length === 0) return [];

        let targetKipNumbers: string[] = [];
        if (selectedKipIds.length > 0) {
            const names = kips
                .filter((k) => selectedKipIds.includes(k.id))
                .map((k) => k.name);
            targetKipNumbers = names
                .map((name) => name.match(/\d+/)?.[0] || "")
                .filter((n) => n);
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
                    if (match) {
                        const deptKipNum = match[1];
                        if (
                            targetKipNumbers.length === 0 ||
                            targetKipNumbers.includes(deptKipNum)
                        ) {
                            allRealIds.push(d.id);
                        }
                    }
                });
            }
        });

        return Array.from(new Set(allRealIds));
    };

    // --- 3. LOAD DATA (Hàm gọi API) ---
    const fetchData = async () => {
        // BẮT BUỘC phải chọn Phòng ban mới tải (vì đã bỏ tìm theo tên)
        if (mixedDeptValues.length === 0) {
            setData([]);
            return;
        }

        setLoading(true);
        setChanges({}); // Reset changes cũ

        try {
            const m = selectedMonth.month() + 1;
            const y = selectedMonth.year();
            let url = `/api/evaluations/monthly?month=${m}&year=${y}`;

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

    // --- [MỚI] TỰ ĐỘNG TẢI DỮ LIỆU (AUTO FETCH) ---
    useEffect(() => {
        if (mixedDeptValues.length > 0) {
            const timer = setTimeout(() => {
                fetchData();
            }, 500); // Debounce 0.5s
            return () => clearTimeout(timer);
        } else {
            setData([]); // Nếu bỏ chọn phòng -> Xóa bảng
        }
    }, [
        selectedFactoryId,
        mixedDeptValues, // Thay đổi phòng -> Tự gọi lại
        selectedKipIds,  // Thay đổi Kíp -> Tự gọi lại
        selectedMonth,   // Thay đổi Tháng -> Tự gọi lại
    ]);

    // --- [MỚI] NÚT RESET BỘ LỌC ---
    const handleReset = () => {
        setSelectedFactoryId(null);
        setMixedDeptValues([]);
        setSelectedKipIds([]);
        setData([]);
        setChanges({});
    };

    // --- 4. LOGIC NHẬP LIỆU & LƯU ---
    const handleGradeChange = (empId: number, val: string) => {
        setChanges((prev) => ({
            ...prev,
            [empId]: {
                ...prev[empId],
                grade: val,
                note: prev[empId]?.note || getDataNote(empId),
            },
        }));
    };

    const handleNoteChange = (empId: number, val: string) => {
        setChanges((prev) => ({
            ...prev,
            [empId]: {
                ...prev[empId],
                grade: prev[empId]?.grade || getDataGrade(empId) || "",
                note: val,
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

    const handleSave = async () => {
        const payload = data
            .map((emp) => {
                const changed = changes[emp.id];
                return {
                    employeeId: emp.id,
                    grade: changed ? changed.grade : emp.grade,
                    note: changed ? changed.note : emp.note,
                };
            })
            .filter((item) => item.grade);

        if (payload.length === 0) {
            message.warning("Không có dữ liệu xếp loại để lưu");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/evaluations/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    month: selectedMonth.month() + 1,
                    year: selectedMonth.year(),
                    evaluations: payload,
                }),
            });

            if (res.ok) {
                message.success("Đã lưu xếp loại thành công!");
                fetchData(); // Load lại để đồng bộ
            } else {
                message.error("Lỗi khi lưu");
            }
        } catch (e) {
            message.error("Lỗi kết nối");
        } finally {
            setLoading(false);
        }
    };

    const handleQuickFill = (targetGrade: string) => {
        const newChanges = { ...changes };
        data.forEach((emp) => {
            newChanges[emp.id] = {
                grade: targetGrade,
                note: newChanges[emp.id]?.note || emp.note || "",
            };
        });
        setChanges(newChanges);
        message.success(`Đã xếp loại ${targetGrade} cho toàn bộ danh sách!`);
    };

    // --- COLUMNS ---
    const columns = [
        {
            title: "STT",
            key: "idx",
            width: 50,
            align: "center" as const,
            render: (_: any, __: any, i: number) => i + 1,
        },
        {
            title: "Mã NV",
            dataIndex: "code",
            key: "code",
            width: 80,
            render: (t: string) => <b>{t}</b>,
        },
        {
            title: "Họ tên",
            dataIndex: "fullName",
            key: "fullName",
            width: 180,
            render: (t: string, r: EvaluationData) => (
                <div>
                    <div>{t}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{r.kipName}</div>
                </div>
            ),
        },
        {
            title: "Xếp loại",
            key: "grade",
            width: 100,
            align: "center" as const,
            render: (_: any, r: EvaluationData) => (
                <Select
                    style={{ width: 80 }}
                    value={getDataGrade(r.id)}
                    onChange={(val) => handleGradeChange(r.id, val)}
                    placeholder="-"
                >
                    <Option value="A"><span style={{ color: "green", fontWeight: "bold" }}>A</span></Option>
                    <Option value="A-">A-</Option>
                    <Option value="B"><span style={{ color: "blue", fontWeight: "bold" }}>B</span></Option>
                    <Option value="B-">B-</Option>
                    <Option value="C"><span style={{ color: "red", fontWeight: "bold" }}>C</span></Option>
                </Select>
            ),
        },
        {
            title: "Ghi chú / Lý do",
            key: "note",
            render: (_: any, r: EvaluationData) => (
                <Input
                    value={getDataNote(r.id)}
                    onChange={(e) => handleNoteChange(r.id, e.target.value)}
                    placeholder="Nhập lý do nếu loại C..."
                    maxLength={100}
                />
            ),
        },
    ];

    return (
        <AdminLayout>
            <div style={{ marginBottom: 16 }}>
                <Title level={3}>Xếp loại nhân viên tháng</Title>

                {/* [MỚI] Nút chuyển sang trang Tổng hợp năm */}
                <Button
                    type="primary"
                    icon={<BarChartOutlined />}
                    onClick={() => router.push('/evaluations/yearly')}
                >
                    Xem Tổng hợp Năm
                </Button>
            </div>

            <Card size="small" style={{ marginBottom: 16, background: "#f0f2f5" }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>

                    {/* Chọn Tháng */}
                    <div>
                        <div style={{ fontWeight: 500 }}>Tháng:</div>
                        <DatePicker
                            picker="month"
                            value={selectedMonth}
                            onChange={(val) => val && setSelectedMonth(val)}
                            format="MM/YYYY"
                            allowClear={false}
                            style={{ width: 120 }}
                        />
                    </div>

                    {/* Chọn Nhà máy */}
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
                            {factories.map((f) => (
                                <Option key={f.id} value={f.id}>{f.name}</Option>
                            ))}
                        </Select>
                    </div>

                    {/* Chọn Phòng/Tổ */}
                    <div>
                        <div style={{ fontWeight: 500 }}>
                            {isMatrix ? "Chọn Tổ / Bộ phận:" : "Phòng ban:"}
                        </div>
                        <Select
                            mode="multiple"
                            style={{ width: 250 }}
                            placeholder="Chọn..."
                            value={mixedDeptValues}
                            onChange={setMixedDeptValues}
                            disabled={!selectedFactoryId}
                            maxTagCount="responsive"
                            showSearch
                            optionFilterProp="children"
                        >
                            {mixedDeptOptions.map((o) => (
                                <Option key={o.value} value={o.value}>{o.label}</Option>
                            ))}
                        </Select>
                    </div>

                    {/* Chọn Kíp */}
                    <div>
                        <div style={{ fontWeight: 500 }}>
                            {isMatrix ? "Lọc theo Kíp:" : "Chọn Kíp:"}
                        </div>
                        <Select
                            mode="multiple"
                            style={{ width: 140 }}
                            placeholder="Kíp..."
                            value={selectedKipIds}
                            onChange={setSelectedKipIds}
                            disabled={!selectedFactoryId}
                        >
                            {kips
                                .filter((k) => k.factoryId === selectedFactoryId)
                                .map((k) => (
                                    <Option key={k.id} value={k.id}>{k.name}</Option>
                                ))}
                        </Select>
                    </div>

                    {/* Nút Reset Bộ Lọc */}
                    <div style={{ marginTop: 20 }}>
                        <Button
                            danger
                            icon={<FilterOutlined />}
                            onClick={handleReset}
                            disabled={!selectedFactoryId}
                        >
                            Xóa lọc
                        </Button>
                    </div>
                </div>
            </Card>

            {/* --- CÔNG CỤ THAO TÁC NHANH --- */}
            {data.length > 0 && (
                <div
                    style={{
                        marginBottom: 16,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "#fff",
                        padding: 12,
                        borderRadius: 8,
                        border: "1px solid #f0f0f0",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 500, color: "#666" }}>
                            <ThunderboltOutlined style={{ color: "#faad14" }} /> Điền nhanh:
                        </span>
                        <Popconfirm
                            title="Bạn muốn xếp loại A cho tất cả nhân viên này?"
                            onConfirm={() => handleQuickFill("A")}
                        >
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
        </AdminLayout>
    );
}