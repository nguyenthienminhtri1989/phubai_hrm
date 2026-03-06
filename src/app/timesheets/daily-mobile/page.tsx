"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import {
    Select,
    Button,
    message,
    Input,
    Tag,
    Space,
    Spin,
    Alert,
    DatePicker,
    Drawer,
    Avatar,
    Badge,
    Modal,
    Form,
} from "antd";
import {
    SaveOutlined,
    FilterOutlined,
    LogoutOutlined,
    UserOutlined,
    KeyOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    MenuOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";

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

interface Factory { id: number; name: string; }
interface Department { id: number; code: string; name: string; factory?: Factory; }
interface Kip { id: number; name: string; factoryId: number; }

// Quick action buttons config
const QUICK_ACTIONS = [
    { code: "+", label: "Đi làm" },
    { code: "XD", label: "Ca đêm" },
    { code: "ĐC", label: "Đảo ca" },
    { code: "CN", label: "Chủ nhật" },
    { code: "L", label: "Nghỉ lễ" },
    { code: "F", label: "Nghỉ F" },
];

// --- MAIN COMPONENT ---
export default function MobileDailyTimesheetPage() {
    const { data: session } = useSession();
    const isViewOnly = ["LEADER", "STAFF"].includes(session?.user?.role as string);

    // --- DATA STATE ---
    const [employees, setEmployees] = useState<TimesheetRow[]>([]);
    const [attendanceCodes, setAttendanceCodes] = useState<AttendanceCode[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [kips, setKips] = useState<Kip[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // --- FILTER STATE ---
    const [date, setDate] = useState<Dayjs>(dayjs());
    const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(null);
    const [mixedDeptValues, setMixedDeptValues] = useState<string[]>([]);
    const [selectedKipIds, setSelectedKipIds] = useState<number[]>([]);

    // --- UI STATE ---
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [isChangePassOpen, setIsChangePassOpen] = useState(false);
    const [passLoading, setPassLoading] = useState(false);
    const [passForm] = Form.useForm();
    const [searchText, setSearchText] = useState("");

    const MATRIX_FACTORY_IDS = [1, 2, 3];
    const isMatrix = useMemo(() => selectedFactoryId ? MATRIX_FACTORY_IDS.includes(selectedFactoryId) : false, [selectedFactoryId]);

    // --- LOAD CATALOGS ---
    useEffect(() => {
        const init = async () => {
            try {
                const [codesRes, deptsRes, kipsRes] = await Promise.all([
                    fetch("/api/attendance-codes"),
                    fetch("/api/departments"),
                    fetch("/api/kips"),
                ]);
                const codes: AttendanceCode[] = await codesRes.json();
                const PRIORITY = ["+", "XD", "ĐC", "X/2", "F", "NB", "Ô", "XL", "L", "TS"];
                codes.sort((a, b) => {
                    const iA = PRIORITY.indexOf(a.code), iB = PRIORITY.indexOf(b.code);
                    if (iA !== -1 && iB !== -1) return iA - iB;
                    if (iA !== -1) return -1;
                    if (iB !== -1) return 1;
                    return a.code.localeCompare(b.code);
                });
                setAttendanceCodes(codes);
                setDepartments(await deptsRes.json());
                setKips(await kipsRes.json());
            } catch {
                message.error("Lỗi tải danh mục");
            }
        };
        init();
    }, []);

    // --- PERMISSION FILTER ---
    const availableDepartments = useMemo(() => {
        if (departments.length === 0 || !session) return [];
        const user = session.user;
        if (["ADMIN", "HR_MANAGER", "LEADER"].includes(user.role)) return departments;
        if (["TIMEKEEPER", "STAFF"].includes(user.role)) {
            const allowedIds = user.managedDeptIds || [];
            return departments.filter((d) => allowedIds.includes(d.id));
        }
        return [];
    }, [departments, session]);

    // --- DROPDOWN OPTIONS ---
    const mixedDeptOptions = useMemo(() => {
        if (!selectedFactoryId) return [];
        const currentDepts = availableDepartments.filter(d => d.factory?.id === selectedFactoryId);
        const options: { value: string; label: string }[] = [];
        const processedSections = new Set<string>();

        currentDepts.forEach((d) => {
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

    const factoryOptions = useMemo(() =>
        availableDepartments.reduce((acc: { value: number; label: string }[], curr) => {
            if (curr.factory && !acc.find(f => f.value === curr.factory!.id))
                acc.push({ value: curr.factory!.id, label: curr.factory!.name });
            return acc;
        }, []),
        [availableDepartments]
    );

    // --- RESOLVE REAL DEPT IDS ---
    const resolveRealDepartmentIds = useCallback(() => {
        if (!selectedFactoryId || mixedDeptValues.length === 0) return [];
        let targetKipNumbers: string[] = [];
        if (selectedKipIds.length > 0) {
            const names = kips.filter((k) => selectedKipIds.includes(k.id)).map((k) => k.name);
            targetKipNumbers = names.map((name) => name.match(/\d+/)?.[0] || "").filter(Boolean);
        }
        const allRealIds: number[] = [];
        mixedDeptValues.forEach((val) => {
            if (val.startsWith("DEPT")) {
                const id = parseInt(val.split(":")[1]);
                if (!isNaN(id)) allRealIds.push(id);
            } else if (val.startsWith("SECTION")) {
                const sectionCode = val.split(":")[1];
                availableDepartments.forEach((d) => {
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

    // --- FETCH TIMESHEET DATA ---
    const fetchTimesheetData = useCallback(async () => {
        const realIds = resolveRealDepartmentIds();
        if (realIds.length === 0) { setEmployees([]); return; }

        setLoading(true);
        try {
            const dateStr = date.format("YYYY-MM-DD");
            const deptParam = realIds.join(",");
            const res = await fetch(`/api/timesheets/daily?date=${dateStr}&departmentId=${deptParam}`);
            if (!res.ok) throw new Error();
            setEmployees(await res.json());
        } catch {
            message.error("Lỗi tải dữ liệu");
            setEmployees([]);
        } finally {
            setLoading(false);
        }
    }, [date, resolveRealDepartmentIds]);

    // Auto-fetch when filter changes
    useEffect(() => {
        const timer = setTimeout(() => { fetchTimesheetData(); }, 400);
        return () => clearTimeout(timer);
    }, [date, selectedFactoryId, mixedDeptValues, selectedKipIds]);

    // --- SAVE ---
    const handleSave = async () => {
        if (employees.length === 0) return;
        const realIds = resolveRealDepartmentIds();
        const payloadDeptId = realIds.length === 1 ? realIds[0] : null;
        const records = employees.map((e) => ({
            employeeId: e.employeeId,
            attendanceCodeId: e.attendanceCodeId || null,
            note: e.note || "",
        }));

        setSaving(true);
        try {
            const res = await fetch("/api/timesheets/daily", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date: date.format("YYYY-MM-DD"), departmentId: payloadDeptId, records }),
            });
            if (res.ok) {
                const validCount = records.filter(r => r.attendanceCodeId !== null).length;
                message.success(`Đã lưu! (${validCount} người được chấm)`);
                fetchTimesheetData();
            } else {
                const err = await res.json();
                message.error(res.status === 403 ? `KHÓA SỔ: ${err.error}` : err.error || "Lỗi lưu");
            }
        } catch {
            message.error("Lỗi kết nối");
        } finally {
            setSaving(false);
        }
    };

    // --- ROW HELPERS ---
    const handleRowChange = (empId: number, field: string, value: unknown) => {
        setEmployees(prev => prev.map(e => e.employeeId === empId ? { ...e, [field]: value } : e));
    };

    const setAllStatus = (codeStr: string) => {
        const target = attendanceCodes.find(c => c.code === codeStr);
        if (!target) return;
        setEmployees(prev => prev.map(e => ({ ...e, attendanceCodeId: target.id })));
    };

    // --- CHANGE PASSWORD ---
    const handleChangePassword = async (values: { oldPassword: string; newPassword: string; confirmPassword: string }) => {
        setPassLoading(true);
        try {
            const res = await fetch("/api/user/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            const data = await res.json();
            if (res.ok) {
                message.success("Đổi mật khẩu thành công!");
                setIsChangePassOpen(false);
                passForm.resetFields();
                signOut({ callbackUrl: "/login" });
            } else {
                message.error(data.error || "Có lỗi xảy ra");
            }
        } catch {
            message.error("Lỗi kết nối server");
        } finally {
            setPassLoading(false);
        }
    };

    // --- COMPUTED ---
    const timesheetStatus = useMemo(() => {
        if (employees.length === 0) return null;
        const hasData = employees.some(e => e.attendanceCodeId !== null);
        const lastUpdate = employees.find(e => e.updatedAt)?.updatedAt;
        return {
            isSubmitted: hasData,
            lastUpdate: lastUpdate ? dayjs(lastUpdate).format("HH:mm - DD/MM/YYYY") : null,
        };
    }, [employees]);

    const filteredEmployees = useMemo(() => {
        if (!searchText.trim()) return employees;
        const q = searchText.toLowerCase();
        return employees.filter(e =>
            e.fullName.toLowerCase().includes(q) ||
            e.employeeCode.toLowerCase().includes(q)
        );
    }, [employees, searchText]);

    const checkedCount = employees.filter(e => e.attendanceCodeId !== null).length;
    const filterApplied = mixedDeptValues.length > 0;

    // --- RENDER ---
    return (
        <div style={{ minHeight: "100vh", background: "#f0f2f5", paddingBottom: 80 }}>

            {/* === TOP HEADER === */}
            <div style={{
                position: "sticky", top: 0, zIndex: 100,
                background: "#1677ff", color: "#fff",
                padding: "10px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>Chấm Công</div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>{date.format("dddd, DD/MM/YYYY")}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {/* Filter button with badge */}
                    <Badge dot={filterApplied} color="yellow">
                        <Button
                            icon={<FilterOutlined />}
                            onClick={() => setFilterDrawerOpen(true)}
                            style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff" }}
                        />
                    </Badge>
                    {/* User avatar */}
                    <Avatar
                        size={34}
                        icon={<UserOutlined />}
                        style={{ background: "rgba(255,255,255,0.3)", cursor: "pointer" }}
                        onClick={() => setUserMenuOpen(true)}
                    />
                </div>
            </div>

            {/* === FILTER DRAWER === */}
            <Drawer
                title="Bộ lọc chấm công"
                placement="bottom"
                height="auto"
                open={filterDrawerOpen}
                onClose={() => setFilterDrawerOpen(false)}
                styles={{ body: { paddingBottom: 32 } }}
                extra={
                    <Button size="small" danger onClick={() => {
                        setSelectedFactoryId(null);
                        setMixedDeptValues([]);
                        setSelectedKipIds([]);
                    }}>
                        Xóa lọc
                    </Button>
                }
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Ngày */}
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Ngày chấm công</div>
                        <DatePicker
                            value={date}
                            onChange={(d) => d && setDate(d)}
                            format="DD/MM/YYYY"
                            allowClear={false}
                            style={{ width: "100%" }}
                            size="large"
                        />
                    </div>

                    {/* Nhà máy */}
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Nhà máy</div>
                        <Select
                            style={{ width: "100%" }}
                            size="large"
                            placeholder="Chọn nhà máy..."
                            value={selectedFactoryId}
                            onChange={(val) => {
                                setSelectedFactoryId(val);
                                setMixedDeptValues([]);
                                setSelectedKipIds([]);
                            }}
                            options={factoryOptions}
                            allowClear
                        />
                    </div>

                    {/* Tổ / Phòng ban */}
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
                            {isMatrix ? "Tổ / Bộ phận" : "Phòng ban"}
                        </div>
                        <Select
                            mode="multiple"
                            style={{ width: "100%" }}
                            size="large"
                            placeholder="Chọn phòng ban..."
                            value={mixedDeptValues}
                            onChange={setMixedDeptValues}
                            options={mixedDeptOptions}
                            disabled={!selectedFactoryId}
                            showSearch
                            optionFilterProp="label"
                            maxTagCount="responsive"
                            allowClear
                        />
                    </div>

                    {/* Kíp */}
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
                            {isMatrix ? "Lọc theo kíp" : "Kíp"}
                        </div>
                        <Select
                            mode="multiple"
                            style={{ width: "100%" }}
                            size="large"
                            placeholder="Tất cả kíp"
                            value={selectedKipIds}
                            onChange={setSelectedKipIds}
                            disabled={!selectedFactoryId}
                            options={kips.filter(k => k.factoryId === selectedFactoryId).map(k => ({ value: k.id, label: k.name }))}
                            allowClear
                        />
                    </div>

                    <Button
                        type="primary"
                        size="large"
                        block
                        onClick={() => setFilterDrawerOpen(false)}
                        style={{ marginTop: 4 }}
                    >
                        Áp dụng
                    </Button>
                </div>
            </Drawer>

            {/* === USER MENU DRAWER === */}
            <Drawer
                title={null}
                placement="right"
                width={260}
                open={userMenuOpen}
                onClose={() => setUserMenuOpen(false)}
            >
                <div style={{ textAlign: "center", paddingTop: 16, paddingBottom: 24 }}>
                    <Avatar size={64} icon={<UserOutlined />} style={{ background: "#1677ff" }} />
                    <div style={{ marginTop: 12, fontWeight: 700, fontSize: 16 }}>
                        {session?.user?.fullName || session?.user?.name || "Người dùng"}
                    </div>
                    <Tag color="blue" style={{ marginTop: 4 }}>{session?.user?.role}</Tag>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <Button
                        icon={<KeyOutlined />}
                        block
                        onClick={() => { setUserMenuOpen(false); setIsChangePassOpen(true); }}
                    >
                        Đổi mật khẩu
                    </Button>
                    <Button
                        danger
                        icon={<LogoutOutlined />}
                        block
                        onClick={() => signOut({ callbackUrl: "/login" })}
                    >
                        Đăng xuất
                    </Button>
                </div>
            </Drawer>

            {/* === CHANGE PASSWORD MODAL === */}
            <Modal
                title="Đổi mật khẩu"
                open={isChangePassOpen}
                onCancel={() => { setIsChangePassOpen(false); passForm.resetFields(); }}
                onOk={() => passForm.submit()}
                confirmLoading={passLoading}
                okText="Xác nhận"
                cancelText="Hủy"
            >
                <Form form={passForm} layout="vertical" onFinish={handleChangePassword}>
                    <Form.Item name="oldPassword" label="Mật khẩu hiện tại"
                        rules={[{ required: true, message: "Vui lòng nhập mật khẩu cũ" }]}>
                        <Input.Password />
                    </Form.Item>
                    <Form.Item name="newPassword" label="Mật khẩu mới"
                        rules={[{ required: true }, { min: 6, message: "Tối thiểu 6 ký tự" }]}>
                        <Input.Password />
                    </Form.Item>
                    <Form.Item name="confirmPassword" label="Nhập lại mật khẩu mới"
                        dependencies={["newPassword"]}
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

            {/* === MAIN CONTENT === */}
            <div style={{ padding: "12px 12px 0" }}>

                {/* Status bar */}
                {employees.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                        {timesheetStatus?.isSubmitted ? (
                            <Alert
                                message={`Đã chấm: ${checkedCount}/${employees.length} người · Cập nhật ${timesheetStatus.lastUpdate}`}
                                type="success"
                                showIcon
                                style={{ fontSize: 12 }}
                            />
                        ) : (
                            <Alert message="Chưa có dữ liệu chấm công." type="info" showIcon style={{ fontSize: 12 }} />
                        )}
                    </div>
                )}

                {/* Quick action buttons (only if not view-only and has data) */}
                {!isViewOnly && employees.length > 0 && (
                    <div style={{ marginBottom: 10, overflowX: "auto" }}>
                        <div style={{ display: "flex", gap: 8, paddingBottom: 4, whiteSpace: "nowrap" }}>
                            <span style={{ fontSize: 12, color: "#666", lineHeight: "28px", flexShrink: 0 }}>Tất cả:</span>
                            {QUICK_ACTIONS.map(({ code, label }) => {
                                const ac = attendanceCodes.find(c => c.code === code);
                                return (
                                    <Button
                                        key={code}
                                        size="small"
                                        onClick={() => setAllStatus(code)}
                                        style={{
                                            flexShrink: 0,
                                            background: ac?.color || "#ddd",
                                            borderColor: ac?.color || "#ddd",
                                            color: "#fff",
                                            fontWeight: 600,
                                        }}
                                    >
                                        {code} · {label}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Search box (when data loaded) */}
                {employees.length > 0 && (
                    <Input.Search
                        placeholder="Tìm tên, mã nhân viên..."
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        allowClear
                        style={{ marginBottom: 10 }}
                    />
                )}
            </div>

            {/* === EMPLOYEE CARDS === */}
            {loading ? (
                <div style={{ textAlign: "center", padding: 60 }}>
                    <Spin size="large" />
                    <div style={{ marginTop: 12, color: "#999" }}>Đang tải...</div>
                </div>
            ) : employees.length === 0 ? (
                <div style={{
                    margin: "12px",
                    padding: "32px 20px",
                    background: "#fff",
                    borderRadius: 12,
                    textAlign: "center",
                    color: "#999",
                    border: "1px dashed #ddd",
                }}>
                    <FilterOutlined style={{ fontSize: 32, marginBottom: 12, color: "#ccc" }} />
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Chưa có dữ liệu</div>
                    <div style={{ fontSize: 13 }}>
                        Bấm nút <FilterOutlined /> góc trên để chọn ngày và bộ phận cần chấm
                    </div>
                </div>
            ) : (
                <div style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {filteredEmployees.map((emp, index) => {
                        const currentCode = attendanceCodes.find(c => c.id === emp.attendanceCodeId);
                        return (
                            <div
                                key={emp.employeeId}
                                style={{
                                    background: "#fff",
                                    borderRadius: 10,
                                    padding: "12px 14px",
                                    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                                    borderLeft: `4px solid ${currentCode?.color || "#e0e0e0"}`,
                                }}
                            >
                                {/* Row 1: Name + index */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                    <div style={{ flex: 1 }}>
                                        <span style={{ color: "#999", fontSize: 12, marginRight: 6 }}>{index + 1}.</span>
                                        <span style={{ fontWeight: 600, fontSize: 15 }}>{emp.fullName}</span>
                                        <div style={{ marginTop: 2 }}>
                                            {emp.kipName ? (
                                                <Tag color="blue" style={{ fontSize: 11 }}>{emp.kipName}</Tag>
                                            ) : (
                                                <Tag style={{ fontSize: 11 }}>{emp.departmentName}</Tag>
                                            )}
                                        </div>
                                    </div>
                                    {/* Status indicator */}
                                    {emp.attendanceCodeId ? (
                                        <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 18, marginTop: 2 }} />
                                    ) : (
                                        <CloseCircleOutlined style={{ color: "#d9d9d9", fontSize: 18, marginTop: 2 }} />
                                    )}
                                </div>

                                {/* Row 2: Attendance code select */}
                                <Select
                                    value={emp.attendanceCodeId}
                                    allowClear
                                    style={{ width: "100%", marginBottom: 8 }}
                                    size="large"
                                    placeholder="Chọn mã chấm công..."
                                    disabled={isViewOnly}
                                    onChange={(val) => handleRowChange(emp.employeeId, "attendanceCodeId", val ?? null)}
                                    options={attendanceCodes.map(c => ({
                                        value: c.id,
                                        label: `${c.code} - ${c.name}`,
                                        item: c,
                                    }))}
                                    optionRender={(opt) => (
                                        <Space>
                                            <Tag
                                                color={opt.data.item.color}
                                                style={{ fontWeight: "bold", minWidth: 36, textAlign: "center" }}
                                            >
                                                {opt.data.item.code}
                                            </Tag>
                                            {opt.data.item.name}
                                        </Space>
                                    )}
                                    labelRender={(props) => {
                                        const c = attendanceCodes.find(x => x.id === props.value);
                                        return c ? (
                                            <Tag color={c.color} style={{ fontWeight: "bold", margin: 0 }}>
                                                {c.code} · {c.name}
                                            </Tag>
                                        ) : (props.label as React.ReactNode);
                                    }}
                                />

                                {/* Row 3: Note input */}
                                {!isViewOnly ? (
                                    <Input
                                        value={emp.note}
                                        disabled={isViewOnly}
                                        onChange={e => handleRowChange(emp.employeeId, "note", e.target.value)}
                                        placeholder="Ghi chú..."
                                        size="small"
                                    />
                                ) : emp.note ? (
                                    <div style={{ fontSize: 12, color: "#666", fontStyle: "italic" }}>📝 {emp.note}</div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* === FLOATING SAVE BUTTON === */}
            {!isViewOnly && employees.length > 0 && (
                <div style={{
                    position: "fixed",
                    bottom: 20,
                    right: 16,
                    zIndex: 200,
                }}>
                    <Button
                        type="primary"
                        size="large"
                        icon={<SaveOutlined />}
                        onClick={handleSave}
                        loading={saving}
                        style={{
                            height: 52,
                            paddingInline: 24,
                            borderRadius: 26,
                            boxShadow: "0 4px 16px rgba(22,119,255,0.45)",
                            fontSize: 15,
                            fontWeight: 600,
                        }}
                    >
                        Lưu ({checkedCount}/{employees.length})
                    </Button>
                </div>
            )}

            {/* View-only notice */}
            {isViewOnly && (
                <div style={{
                    position: "fixed", bottom: 0, left: 0, right: 0,
                    background: "#fffbe6", borderTop: "1px solid #ffe58f",
                    padding: "8px 16px", textAlign: "center", fontSize: 12, color: "#ad6800"
                }}>
                    Bạn đang ở chế độ xem — không có quyền chỉnh sửa
                </div>
            )}
        </div>
    );
}
