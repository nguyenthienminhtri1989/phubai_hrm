"use client";

import React, { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useSession, signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
    Select, Button, message, Input, Tag, Spin, Drawer,
    Avatar, Badge, Modal, Form, DatePicker, Popconfirm, Alert,
} from "antd";
import {
    SaveOutlined, FilterOutlined, LogoutOutlined, UserOutlined,
    KeyOutlined, ThunderboltOutlined, CheckCircleOutlined, CloseCircleOutlined,
    HomeOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import dayjs, { Dayjs } from "dayjs";

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

const GRADE_COLORS: Record<string, string> = {
    "A": "#52c41a", "A-": "#95de64", "B": "#1677ff", "B-": "#69b1ff", "C": "#ff4d4f",
};

function MobileEvaluationInner() {
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const canEdit = session?.user?.role !== "STAFF";

    const [data, setData] = useState<EvaluationData[]>([]);
    const [changes, setChanges] = useState<Record<number, { grade: string; note: string }>>({});
    const [departments, setDepartments] = useState<Department[]>([]);
    const [kips, setKips] = useState<Kip[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [catalogReady, setCatalogReady] = useState(false);
    const [paramsApplied, setParamsApplied] = useState(false);

    const [date, setDate] = useState<Dayjs>(dayjs());
    const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(null);
    const [mixedDeptValues, setMixedDeptValues] = useState<string[]>([]);
    const [selectedKipIds, setSelectedKipIds] = useState<number[]>([]);
    const [searchText, setSearchText] = useState("");

    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [isChangePassOpen, setIsChangePassOpen] = useState(false);
    const [passLoading, setPassLoading] = useState(false);
    const [passForm] = Form.useForm();

    const MATRIX_FACTORY_IDS = [1, 2, 3];
    const isMatrix = useMemo(() =>
        selectedFactoryId ? MATRIX_FACTORY_IDS.includes(selectedFactoryId) : false,
        [selectedFactoryId]
    );

    useEffect(() => {
        const init = async () => {
            try {
                const [dRes, kRes] = await Promise.all([fetch("/api/departments"), fetch("/api/kips")]);
                setDepartments(await dRes.json());
                setKips(await kRes.json());
                setCatalogReady(true);
            } catch { message.error("Lỗi tải danh mục"); }
        };
        init();
    }, []);

    useEffect(() => {
        if (!catalogReady || paramsApplied) return;
        const fParam = searchParams.get("f");
        const dParam = searchParams.get("d");
        const kParam = searchParams.get("k");
        if (fParam) { const id = parseInt(fParam); if (!isNaN(id)) setSelectedFactoryId(id); }
        if (dParam) setMixedDeptValues(dParam.split(",").map(s => s.trim()).filter(Boolean));
        if (kParam) setSelectedKipIds(kParam.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n)));
        setParamsApplied(true);
    }, [catalogReady, paramsApplied, searchParams]);

    const availableDepartments = useMemo(() => {
        if (departments.length === 0 || !session) return [];
        const user = session.user;
        if (["ADMIN", "HR_MANAGER", "LEADER"].includes(user.role)) return departments;
        if (["TIMEKEEPER", "STAFF"].includes(user.role)) {
            const allowedIds = user.managedDeptIds || [];
            return departments.filter(d => allowedIds.includes(d.id));
        }
        return [];
    }, [departments, session]);

    const factoryOptions = useMemo(() =>
        availableDepartments.reduce((acc: { value: number; label: string }[], curr) => {
            if (curr.factory && !acc.find(f => f.value === curr.factory!.id))
                acc.push({ value: curr.factory!.id, label: curr.factory!.name });
            return acc;
        }, []),
        [availableDepartments]
    );

    const mixedDeptOptions = useMemo(() => {
        if (!selectedFactoryId) return [];
        const currentDepts = availableDepartments.filter(d => d.factory?.id === selectedFactoryId);
        const options: { value: string; label: string }[] = [];
        const processedSections = new Set<string>();
        currentDepts.forEach(d => {
            const matrixRegex = new RegExp(`^${selectedFactoryId}([a-zA-Z]+)(\\d+)$`);
            const match = d.code?.match(matrixRegex);
            if (isMatrix && match) {
                const sectionCode = match[1];
                if (!processedSections.has(sectionCode)) {
                    const displayName = d.name.replace(/(kíp|ca)\s*\d+.*$/gi, "").replace(/-+.*$/gi, "").trim();
                    options.push({ value: `SECTION:${sectionCode}`, label: displayName });
                    processedSections.add(sectionCode);
                }
            } else {
                options.push({ value: `DEPT:${d.id}`, label: d.name });
            }
        });
        return options.sort((a, b) => a.label.localeCompare(b.label));
    }, [availableDepartments, selectedFactoryId, isMatrix]);

    const resolveRealDepartmentIds = useCallback(() => {
        if (!selectedFactoryId || mixedDeptValues.length === 0) return [];
        let targetKipNumbers: string[] = [];
        if (selectedKipIds.length > 0) {
            const names = kips.filter(k => selectedKipIds.includes(k.id)).map(k => k.name);
            targetKipNumbers = names.map(name => name.match(/\d+/)?.[0] || "").filter(Boolean);
        }
        const allRealIds: number[] = [];
        mixedDeptValues.forEach(val => {
            if (val.startsWith("DEPT")) {
                const id = parseInt(val.split(":")[1]);
                if (!isNaN(id)) allRealIds.push(id);
            } else if (val.startsWith("SECTION")) {
                const sectionCode = val.split(":")[1];
                availableDepartments.forEach(d => {
                    if (d.factory?.id !== selectedFactoryId) return;
                    const regex = new RegExp(`^${selectedFactoryId}${sectionCode}(\\d+)$`);
                    const match = d.code?.match(regex);
                    if (match) {
                        const deptKipNum = match[1];
                        if (targetKipNumbers.length === 0 || targetKipNumbers.includes(deptKipNum))
                            allRealIds.push(d.id);
                    }
                });
            }
        });
        return Array.from(new Set(allRealIds));
    }, [selectedFactoryId, mixedDeptValues, selectedKipIds, kips, availableDepartments]);

    const fetchData = useCallback(async () => {
        const realIds = resolveRealDepartmentIds();
        if (realIds.length === 0) { setData([]); setChanges({}); return; }
        setLoading(true);
        setChanges({});
        try {
            const m = date.month() + 1;
            const y = date.year();
            let url = `/api/evaluations/monthly?month=${m}&year=${y}&departmentId=${realIds.join(",")}`;
            if (selectedFactoryId) url += `&factoryId=${selectedFactoryId}`;
            if (selectedKipIds.length > 0) url += `&kipIds=${selectedKipIds.join(",")}`;
            const res = await fetch(url);
            const result = await res.json();
            if (result.error) { message.error(result.error); setData([]); }
            else setData(result);
        } catch { message.error("Lỗi tải dữ liệu"); setData([]); }
        finally { setLoading(false); }
    }, [date, resolveRealDepartmentIds, selectedFactoryId, selectedKipIds]);

    useEffect(() => {
        if (!catalogReady) return;
        const timer = setTimeout(() => fetchData(), 400);
        return () => clearTimeout(timer);
    }, [date, selectedFactoryId, mixedDeptValues, selectedKipIds, catalogReady]);

    const getGrade = (empId: number) => changes[empId]?.grade !== undefined ? changes[empId].grade : (data.find(d => d.id === empId)?.grade || "");
    const getNote = (empId: number) => changes[empId]?.note !== undefined ? changes[empId].note : (data.find(d => d.id === empId)?.note || "");

    const handleGradeChange = (empId: number, val: string) => {
        setChanges(prev => ({ ...prev, [empId]: { grade: val, note: prev[empId]?.note ?? getNote(empId) } }));
    };
    const handleNoteChange = (empId: number, val: string) => {
        setChanges(prev => ({ ...prev, [empId]: { grade: prev[empId]?.grade ?? getGrade(empId), note: val } }));
    };
    const handleQuickFill = (targetGrade: string) => {
        const newChanges = { ...changes };
        data.forEach(emp => { newChanges[emp.id] = { grade: targetGrade, note: newChanges[emp.id]?.note || emp.note || "" }; });
        setChanges(newChanges);
        message.success(`Đã xếp loại ${targetGrade} toàn bộ!`);
    };

    const handleSave = async () => {
        const payload = data.map(emp => {
            const changed = changes[emp.id];
            return { employeeId: emp.id, grade: changed ? changed.grade : emp.grade, note: changed ? changed.note : emp.note };
        }).filter(item => item.grade);
        if (payload.length === 0) { message.warning("Không có dữ liệu để lưu"); return; }
        setSaving(true);
        try {
            const res = await fetch("/api/evaluations/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ month: date.month() + 1, year: date.year(), evaluations: payload }),
            });
            if (res.ok) { message.success("Đã lưu thành công!"); fetchData(); }
            else message.error("Lỗi khi lưu");
        } catch { message.error("Lỗi kết nối"); }
        finally { setSaving(false); }
    };

    const handleChangePassword = async (values: { oldPassword: string; newPassword: string; confirmPassword: string }) => {
        setPassLoading(true);
        try {
            const res = await fetch("/api/user/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
            const d = await res.json();
            if (res.ok) { message.success("Đổi mật khẩu thành công!"); setIsChangePassOpen(false); passForm.resetFields(); signOut({ callbackUrl: "/login" }); }
            else message.error(d.error || "Có lỗi xảy ra");
        } catch { message.error("Lỗi kết nối server"); }
        finally { setPassLoading(false); }
    };

    const filterApplied = mixedDeptValues.length > 0;
    const changesCount = Object.keys(changes).length;
    const gradedCount = data.filter(e => getGrade(e.id)).length;

    const filterLabel = useMemo(() => {
        if (!filterApplied) return null;
        const deptLabels = mixedDeptValues.map(v => mixedDeptOptions.find(o => o.value === v)?.label || v);
        return deptLabels.join(" · ");
    }, [filterApplied, mixedDeptValues, mixedDeptOptions]);

    const filteredData = useMemo(() => {
        if (!searchText.trim()) return data;
        const q = searchText.toLowerCase();
        return data.filter(e => e.fullName.toLowerCase().includes(q) || e.code.toLowerCase().includes(q));
    }, [data, searchText]);

    return (
        <div style={{ minHeight: "100vh", background: "#f0f2f5", paddingBottom: 80, maxWidth: 480, margin: "0 auto" }}>

            {/* HEADER */}
            <div style={{ position: "sticky", top: 0, zIndex: 100, background: "linear-gradient(135deg, #722ed1 0%, #531dab 100%)", color: "#fff", padding: "8px 12px", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>Xếp Loại Tháng {date.format("MM/YYYY")}</div>
                        {filterLabel && (
                            <div style={{ fontSize: 10, opacity: 0.75, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {filterLabel}
                            </div>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                        <Link href="/">
                            <Button icon={<HomeOutlined />} size="small"
                                style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: 32, height: 32 }} />
                        </Link>
                        <Badge dot={filterApplied} color="yellow">
                            <Button icon={<FilterOutlined />} size="small" onClick={() => setFilterDrawerOpen(true)}
                                style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: 32, height: 32 }} />
                        </Badge>
                        <Avatar size={30} icon={<UserOutlined />}
                            style={{ background: "rgba(255,255,255,0.3)", cursor: "pointer" }}
                            onClick={() => setUserMenuOpen(true)} />
                    </div>
                </div>
            </div>

            {/* FILTER DRAWER */}
            <Drawer title="Bộ lọc xếp loại" placement="bottom" height="auto" open={filterDrawerOpen}
                onClose={() => setFilterDrawerOpen(false)} styles={{ body: { paddingBottom: 32 } }}
                extra={<Button size="small" danger onClick={() => { setSelectedFactoryId(null); setMixedDeptValues([]); setSelectedKipIds([]); }}>Xóa lọc</Button>}>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Tháng xếp loại</div>
                        <DatePicker value={date} onChange={d => d && setDate(d)} picker="month" format="MM/YYYY"
                            allowClear={false} style={{ width: "100%" }} size="large" />
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Nhà máy</div>
                        <Select style={{ width: "100%" }} size="large" placeholder="Chọn nhà máy..." value={selectedFactoryId}
                            onChange={val => { setSelectedFactoryId(val); setMixedDeptValues([]); setSelectedKipIds([]); }}
                            options={factoryOptions} allowClear />
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>{isMatrix ? "Tổ / Bộ phận" : "Phòng ban"}</div>
                        <Select mode="multiple" style={{ width: "100%" }} size="large" placeholder="Chọn phòng ban..."
                            value={mixedDeptValues} onChange={setMixedDeptValues} options={mixedDeptOptions}
                            disabled={!selectedFactoryId} showSearch optionFilterProp="label" maxTagCount="responsive" allowClear />
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>{isMatrix ? "Lọc theo kíp" : "Kíp"}</div>
                        <Select mode="multiple" style={{ width: "100%" }} size="large" placeholder="Tất cả kíp"
                            value={selectedKipIds} onChange={setSelectedKipIds} disabled={!selectedFactoryId}
                            options={kips.filter(k => k.factoryId === selectedFactoryId).map(k => ({ value: k.id, label: k.name }))} allowClear />
                    </div>
                    <Button type="primary" size="large" block onClick={() => setFilterDrawerOpen(false)}>Áp dụng</Button>
                </div>
            </Drawer>

            {/* USER MENU DRAWER */}
            <Drawer title={null} placement="right" width={240} open={userMenuOpen} onClose={() => setUserMenuOpen(false)}>
                <div style={{ textAlign: "center", paddingTop: 16, paddingBottom: 20 }}>
                    <Avatar size={56} icon={<UserOutlined />} style={{ background: "#722ed1" }} />
                    <div style={{ marginTop: 10, fontWeight: 700, fontSize: 15 }}>{session?.user?.fullName || session?.user?.name || "Người dùng"}</div>
                    <Tag color="purple" style={{ marginTop: 4 }}>{session?.user?.role}</Tag>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <Button icon={<KeyOutlined />} block onClick={() => { setUserMenuOpen(false); setIsChangePassOpen(true); }}>Đổi mật khẩu</Button>
                    <Button danger icon={<LogoutOutlined />} block onClick={() => signOut({ callbackUrl: "/login" })}>Đăng xuất</Button>
                </div>
            </Drawer>

            {/* CHANGE PASSWORD MODAL */}
            <Modal title="Đổi mật khẩu" open={isChangePassOpen}
                onCancel={() => { setIsChangePassOpen(false); passForm.resetFields(); }}
                onOk={() => passForm.submit()} confirmLoading={passLoading} okText="Xác nhận" cancelText="Hủy">
                <Form form={passForm} layout="vertical" onFinish={handleChangePassword}>
                    <Form.Item name="oldPassword" label="Mật khẩu hiện tại" rules={[{ required: true, message: "Vui lòng nhập mật khẩu cũ" }]}>
                        <Input.Password />
                    </Form.Item>
                    <Form.Item name="newPassword" label="Mật khẩu mới" rules={[{ required: true }, { min: 6, message: "Tối thiểu 6 ký tự" }]}>
                        <Input.Password />
                    </Form.Item>
                    <Form.Item name="confirmPassword" label="Nhập lại mật khẩu mới" dependencies={["newPassword"]}
                        rules={[{ required: true }, ({ getFieldValue }) => ({
                            validator(_, value) {
                                if (!value || getFieldValue("newPassword") === value) return Promise.resolve();
                                return Promise.reject("Mật khẩu không khớp!");
                            },
                        })]}>
                        <Input.Password />
                    </Form.Item>
                </Form>
            </Modal>

            {/* MAIN CONTENT */}
            <div style={{ padding: "8px 8px 0" }}>
                {data.length > 0 && (
                    <Alert message={`Đã xếp loại: ${gradedCount}/${data.length} người${changesCount > 0 ? ` · ${changesCount} thay đổi chưa lưu` : ""}`}
                        type={changesCount > 0 ? "warning" : "success"} showIcon
                        style={{ fontSize: 11, padding: "4px 8px", marginBottom: 6 }} />
                )}

                {/* Quick fill */}
                {canEdit && data.length > 0 && (
                    <div style={{ marginBottom: 6, background: "#fff", borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                        <span style={{ fontSize: 11, color: "#666", flexShrink: 0 }}><ThunderboltOutlined style={{ color: "#faad14" }} /> Tất cả:</span>
                        {["A", "A-", "B", "B-", "C"].map(g => (
                            <Popconfirm key={g} title={`Xếp loại ${g} tất cả?`} onConfirm={() => handleQuickFill(g)}>
                                <Button size="small" style={{ background: GRADE_COLORS[g], borderColor: GRADE_COLORS[g], color: "#fff", fontWeight: 700, height: 22, padding: "0 8px", fontSize: 11 }}>
                                    {g}
                                </Button>
                            </Popconfirm>
                        ))}
                    </div>
                )}

                {/* Search */}
                {data.length > 0 && (
                    <Input.Search placeholder="Tìm tên, mã NV..." value={searchText}
                        onChange={e => setSearchText(e.target.value)} allowClear size="middle"
                        style={{ marginBottom: 6 }} />
                )}
            </div>

            {/* EMPLOYEE CARDS */}
            {loading ? (
                <div style={{ textAlign: "center", padding: 40 }}>
                    <Spin size="large" />
                    <div style={{ marginTop: 8, color: "#999", fontSize: 13 }}>Đang tải...</div>
                </div>
            ) : data.length === 0 ? (
                <div style={{ margin: "8px", padding: "24px 16px", background: "#fff", borderRadius: 10, textAlign: "center", color: "#999", border: "1px dashed #ddd" }}>
                    <FilterOutlined style={{ fontSize: 28, marginBottom: 8, color: "#ccc" }} />
                    <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Chưa có dữ liệu</div>
                    <div style={{ fontSize: 12 }}>Bấm nút <FilterOutlined /> góc trên để chọn tháng và bộ phận</div>
                </div>
            ) : (
                <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {filteredData.map((emp, index) => {
                        const currentGrade = getGrade(emp.id);
                        const gradeColor = currentGrade ? GRADE_COLORS[currentGrade] : "#e0e0e0";
                        const hasChange = changes[emp.id] !== undefined;
                        return (
                            <div key={emp.id} style={{ background: "#fff", borderRadius: 8, padding: "8px 10px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", borderLeft: `3px solid ${gradeColor}`, opacity: canEdit ? 1 : 0.85 }}>
                                {/* Name row */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                                            <span style={{ color: "#aaa", fontSize: 11 }}>{index + 1}.</span>
                                            <span style={{ fontWeight: 700, fontSize: 13 }}>{emp.fullName}</span>
                                            {hasChange && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#faad14", display: "inline-block", marginLeft: 2 }} />}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                                            {emp.kipName ? (
                                                <Tag color="purple" style={{ fontSize: 10, lineHeight: "16px", padding: "0 4px", margin: 0 }}>{emp.kipName}</Tag>
                                            ) : (
                                                <Tag style={{ fontSize: 10, lineHeight: "16px", padding: "0 4px", margin: 0 }}>{emp.departmentName}</Tag>
                                            )}
                                            <span style={{ fontSize: 10, color: "#bbb" }}>{emp.code}</span>
                                        </div>
                                    </div>
                                    {currentGrade ? (
                                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: gradeColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                                            {currentGrade}
                                        </div>
                                    ) : (
                                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc", fontSize: 18, flexShrink: 0 }}>
                                            -
                                        </div>
                                    )}
                                </div>

                                {/* Grade select */}
                                <Select value={currentGrade || undefined} onChange={val => handleGradeChange(emp.id, val)}
                                    placeholder="Chọn xếp loại..." disabled={!canEdit} allowClear
                                    style={{ width: "100%", marginBottom: 6 }} size="middle"
                                    options={["A", "A-", "B", "B-", "C"].map(g => ({
                                        value: g,
                                        label: <span style={{ color: GRADE_COLORS[g], fontWeight: 700 }}>{g}</span>
                                    }))} />

                                {/* Note */}
                                {!canEdit ? (
                                    emp.note ? <div style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>📝 {emp.note}</div> : null
                                ) : (
                                    <Input value={getNote(emp.id)} onChange={e => handleNoteChange(emp.id, e.target.value)}
                                        placeholder="Ghi chú / lý do..." size="small" maxLength={100} />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* FLOATING SAVE */}
            {canEdit && data.length > 0 && (
                <div style={{ position: "fixed", bottom: 16, right: 12, zIndex: 200 }}>
                    <Button type="primary" size="large" icon={<SaveOutlined />}
                        onClick={handleSave} loading={saving}
                        style={{
                            height: 44, paddingInline: 18, borderRadius: 22,
                            boxShadow: "0 4px 16px rgba(114,46,209,0.45)",
                            fontSize: 13, fontWeight: 700,
                            background: "#722ed1", borderColor: "#722ed1",
                        }}>
                        Lưu ({changesCount})
                    </Button>
                </div>
            )}

            {!canEdit && (
                <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fffbe6", borderTop: "1px solid #ffe58f", padding: "6px 12px", textAlign: "center", fontSize: 11, color: "#ad6800" }}>
                    Chế độ xem — không có quyền chỉnh sửa
                </div>
            )}
        </div>
    );
}

export default function MobileEvaluationPage() {
    return (
        <Suspense fallback={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}><Spin size="large" /></div>}>
            <MobileEvaluationInner />
        </Suspense>
    );
}
