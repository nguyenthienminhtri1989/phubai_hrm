"use client";

import React, { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
// 1. [MỚI] Import useSession
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
    BarChartOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";

const { Title } = Typography;
const { Option } = Select;

// ... (Các Interface giữ nguyên) ...
interface EvaluationData {
    id: number;
    code: string;
    fullName: string;
    departmentName: string;
    kipName: string;
    grade: string | null;
    note: string;
}
interface Factory { id: number; name: string; }
interface Department { id: number; code: string; name: string; factory?: Factory; }
interface Kip { id: number; name: string; factoryId: number; }
interface DeptOption { value: string; label: string; type: "SECTION" | "DEPT"; code?: string; id?: number; }

export default function MonthlyEvaluationPage() {
    // 2. [MỚI] Lấy session để check quyền
    const { data: session } = useSession();
    const router = useRouter();

    // --- STATE ---
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<EvaluationData[]>([]);

    // Dữ liệu danh mục
    const [departments, setDepartments] = useState<Department[]>([]);
    const [kips, setKips] = useState<Kip[]>([]);

    // Filter State
    const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs());
    const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(null);
    const [mixedDeptValues, setMixedDeptValues] = useState<string[]>([]);
    const [selectedKipIds, setSelectedKipIds] = useState<number[]>([]);

    // State lưu thay đổi
    const [changes, setChanges] = useState<Record<number, { grade: string; note: string }>>({});

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

    // 3. [SỬA ĐỔI QUAN TRỌNG] Logic phân quyền người dùng
    // Chỉ trả về các phòng ban mà user ĐƯỢC PHÉP THẤY trong nhà máy đã chọn
    const availableDepartments = useMemo(() => {
        // Chưa chọn nhà máy hoặc chưa đăng nhập -> Rỗng
        if (!selectedFactoryId || !session || departments.length === 0) return [];

        const user = session.user;

        // Lọc theo Nhà máy trước
        const factoryDepts = departments.filter((d) => d.factory?.id === selectedFactoryId);

        // Nhóm 1: Xem tất cả (Admin, HR, Lãnh đạo)
        if (["ADMIN", "HR_MANAGER", "LEADER"].includes(user.role)) {
            return factoryDepts;
        }

        // Nhóm 2: Xem theo phân công (Chấm công VÀ Nhân viên)
        // STAFF cũng dùng managedDeptIds để biết mình thuộc phòng nào mà xem
        if (["TIMEKEEPER", "STAFF"].includes(user.role)) {
            const allowedIds = user.managedDeptIds || [];
            return factoryDepts.filter((d) => allowedIds.includes(d.id));
        }

        // Role lạ -> Không cho xem
        return [];
    }, [departments, selectedFactoryId, session]);
    // -----------------------------------------------------------

    const isMatrix = useMemo(
        () => (selectedFactoryId ? MATRIX_FACTORY_IDS.includes(selectedFactoryId) : false),
        [selectedFactoryId]
    );

    // Logic tạo option Gộp (Logic này tự động ăn theo availableDepartments ở trên)
    // Nên nếu availableDepartments đã lọc quyền, thì option gộp cũng tự động lọc theo
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
                        .trim()
                        .replace(/-+.*$/gi, "") // Clean thêm lần nữa cho chắc
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

    // Logic Resolve ID (Cũng dùng availableDepartments nên an toàn)
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
                // [AN TOÀN] Kiểm tra lại xem ID này có nằm trong list cho phép không (đề phòng hack client)
                const isAllowed = availableDepartments.some(d => d.id === id);
                if (!isNaN(id) && isAllowed) allRealIds.push(id);
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

    // ... (Phần còn lại của code: fetchData, handleSave, JSX render... giữ nguyên)
    // Chỉ cần thay đoạn Logic phân quyền availableDepartments ở trên là đủ.

    // Code dưới đây tôi rút gọn để bạn dễ copy, hãy giữ nguyên các hàm fetchData, render cũ
    const fetchData = async () => {
        if (mixedDeptValues.length === 0) { setData([]); return; }
        setLoading(true);
        setChanges({});
        try {
            const m = selectedMonth.month() + 1;
            const y = selectedMonth.year();
            let url = `/api/evaluations/monthly?month=${m}&year=${y}`;
            if (selectedFactoryId) url += `&factoryId=${selectedFactoryId}`;

            const deptIds = resolveRealDepartmentIds();
            // Nếu user cố tình chọn nhưng resolve ra rỗng (do không có quyền) thì không fetch
            if (deptIds.length === 0) {
                setData([]);
                setLoading(false);
                return;
            }

            if (deptIds.length > 0) url += `&departmentId=${deptIds.join(",")}`;
            if (selectedKipIds.length > 0) url += `&kipIds=${selectedKipIds.join(",")}`;

            const res = await fetch(url);
            const result = await res.json();
            if (result.error) { message.error(result.error); setData([]); } else { setData(result); }
        } catch (err) { message.error("Lỗi tải dữ liệu"); } finally { setLoading(false); }
    };

    // ... (Auto Fetch useEffect, handleReset, handleSave... giữ nguyên)
    useEffect(() => {
        if (mixedDeptValues.length > 0) {
            const timer = setTimeout(() => { fetchData(); }, 500);
            return () => clearTimeout(timer);
        } else { setData([]); }
    }, [selectedFactoryId, mixedDeptValues, selectedKipIds, selectedMonth]);

    const handleReset = () => {
        setSelectedFactoryId(null);
        setMixedDeptValues([]);
        setSelectedKipIds([]);
        setData([]);
        setChanges({});
    };

    // ... (Các hàm handleGradeChange, handleSave giữ nguyên) ...
    // ... (Phần return JSX giữ nguyên) ...
    // ... (Chỉ cần đảm bảo đã copy đoạn import useSession và sửa availableDepartments) ...

    // Để code chạy được ngay, tôi sẽ trả về JSX đầy đủ như cũ
    // Bạn chỉ cần thay thế file cũ bằng file này là xong.

    const handleGradeChange = (empId: number, val: string) => {
        setChanges((prev) => ({
            ...prev,
            [empId]: { ...prev[empId], grade: val, note: prev[empId]?.note || getDataNote(empId) },
        }));
    };
    const handleNoteChange = (empId: number, val: string) => {
        setChanges((prev) => ({
            ...prev,
            [empId]: { ...prev[empId], grade: prev[empId]?.grade || getDataGrade(empId) || "", note: val },
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
        const payload = data.map((emp) => {
            const changed = changes[emp.id];
            return {
                employeeId: emp.id,
                grade: changed ? changed.grade : emp.grade,
                note: changed ? changed.note : emp.note,
            };
        }).filter((item) => item.grade);
        if (payload.length === 0) { message.warning("Không có dữ liệu để lưu"); return; }
        setLoading(true);
        try {
            const res = await fetch("/api/evaluations/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ month: selectedMonth.month() + 1, year: selectedMonth.year(), evaluations: payload }),
            });
            if (res.ok) { message.success("Đã lưu thành công!"); fetchData(); } else { message.error("Lỗi khi lưu"); }
        } catch (e) { message.error("Lỗi kết nối"); } finally { setLoading(false); }
    };
    const handleQuickFill = (targetGrade: string) => {
        const newChanges = { ...changes };
        data.forEach((emp) => {
            newChanges[emp.id] = { grade: targetGrade, note: newChanges[emp.id]?.note || emp.note || "" };
        });
        setChanges(newChanges);
        message.success(`Đã xếp loại ${targetGrade} toàn bộ!`);
    };

    // Chỉ hiện nút LƯU và ĐIỀN NHANH nếu KHÔNG PHẢI là STAFF
    const canEdit = session?.user?.role !== "STAFF";

    const columns = [
        { title: "STT", key: "idx", width: 50, align: "center" as const, render: (_: any, __: any, i: number) => i + 1 },
        { title: "Mã NV", dataIndex: "code", key: "code", width: 80, render: (t: string) => <b>{t}</b> },
        { title: "Họ tên", dataIndex: "fullName", key: "fullName", width: 180, render: (t: string, r: EvaluationData) => (<div><div>{t}</div><div style={{ fontSize: 11, color: "#888" }}>{r.kipName}</div></div>) },
        {
            title: "Xếp loại", key: "grade", width: 100, align: "center" as const, render: (_: any, r: EvaluationData) => (
                <Select
                    style={{ width: 80 }}
                    value={getDataGrade(r.id)}
                    onChange={(val) => handleGradeChange(r.id, val)} placeholder="-"
                    disabled={!canEdit} // STAFF không chọn được, chỉ xem
                >
                    <Option value="A"><span style={{ color: "green", fontWeight: "bold" }}>A</span></Option>
                    <Option value="A-">A-</Option>
                    <Option value="B"><span style={{ color: "blue", fontWeight: "bold" }}>B</span></Option>
                    <Option value="B-">B-</Option>
                    <Option value="C"><span style={{ color: "red", fontWeight: "bold" }}>C</span></Option>
                </Select>
            )
        },
        { title: "Ghi chú / Lý do", key: "note", render: (_: any, r: EvaluationData) => (<Input value={getDataNote(r.id)} onChange={(e) => handleNoteChange(r.id, e.target.value)} placeholder="Ghi chú..." maxLength={100} />) },
    ];

    return (
        <AdminLayout>
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Title level={3} style={{ margin: 0 }}>Xếp loại nhân viên tháng</Title>
                <Button type="primary" icon={<BarChartOutlined />} onClick={() => router.push('/evaluations/yearly')}>Xem Tổng hợp Năm</Button>
            </div>
            <Card size="small" style={{ marginBottom: 16, background: "#f0f2f5" }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div><div style={{ fontWeight: 500 }}>Tháng:</div><DatePicker picker="month" value={selectedMonth} onChange={(val) => val && setSelectedMonth(val)} format="MM/YYYY" allowClear={false} style={{ width: 120 }} /></div>
                    <div><div style={{ fontWeight: 500 }}>Nhà máy:</div><Select style={{ width: 160 }} placeholder="Chọn NM" value={selectedFactoryId} onChange={(val) => { setSelectedFactoryId(val); setMixedDeptValues([]); setSelectedKipIds([]); setData([]); }}>{factories.map((f) => (<Option key={f.id} value={f.id}>{f.name}</Option>))}</Select></div>
                    <div><div style={{ fontWeight: 500 }}>{isMatrix ? "Chọn Tổ / Bộ phận:" : "Phòng ban:"}</div><Select mode="multiple" style={{ width: 250 }} placeholder="Chọn..." value={mixedDeptValues} onChange={setMixedDeptValues} disabled={!selectedFactoryId} maxTagCount="responsive" showSearch optionFilterProp="children">{mixedDeptOptions.map((o) => (<Option key={o.value} value={o.value}>{o.label}</Option>))}</Select></div>
                    <div><div style={{ fontWeight: 500 }}>{isMatrix ? "Lọc theo Kíp:" : "Chọn Kíp:"}</div><Select mode="multiple" style={{ width: 140 }} placeholder="Kíp..." value={selectedKipIds} onChange={setSelectedKipIds} disabled={!selectedFactoryId}>{kips.filter((k) => k.factoryId === selectedFactoryId).map((k) => (<Option key={k.id} value={k.id}>{k.name}</Option>))}</Select></div>
                    <div style={{ marginTop: 20 }}><Button danger icon={<FilterOutlined />} onClick={handleReset} disabled={!selectedFactoryId}>Xóa lọc</Button></div>
                </div>
            </Card>
            {data.length > 0 && canEdit && (<div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", padding: 12, borderRadius: 8, border: "1px solid #f0f0f0" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontWeight: 500, color: "#666" }}><ThunderboltOutlined style={{ color: "#faad14" }} /> Điền nhanh:</span><Popconfirm title="Xếp loại A tất cả?" onConfirm={() => handleQuickFill("A")}><Button>Tất cả A</Button></Popconfirm></div><Button type="primary" icon={<SaveOutlined />} size="large" onClick={handleSave} loading={loading} style={{ background: "#217346", borderColor: "#217346" }}>Lưu thay đổi ({Object.keys(changes).length})</Button></div>)}
            <Table dataSource={data} columns={columns} rowKey="id" bordered pagination={false} scroll={{ y: 600 }} loading={loading} size="small" />
        </AdminLayout>
    );
}