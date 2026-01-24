"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Select, DatePicker, Button, message, Card, Space } from "antd";
import { FilterOutlined } from "@ant-design/icons";
import { useSession } from "next-auth/react";
import dayjs, { Dayjs } from "dayjs";

// --- INTERFACES ---
interface Factory { id: number; name: string; }
interface Department { id: number; code: string; name: string; factory?: Factory; }
interface Kip { id: number; name: string; factoryId: number; }
interface DeptOption { value: string; label: string; type: "SECTION" | "DEPT"; }

// Dữ liệu bộ lọc trả về cho trang cha
export interface FilterResult {
    date: Dayjs;
    factoryId: number | null;
    realDepartmentIds: number[]; // Đã giải mã thành ID thật (VD: [15, 16])
    selectedKipIds: number[]; // Kíp đã chọn (để trang cha hiển thị nếu cần)
    mixedDeptValues: string[]; // Giá trị UI (để debug nếu cần)
}

interface Props {
    dateMode?: "date" | "month" | "year" | "none"; // Chế độ ngày
    onFilterChange: (result: FilterResult) => void; // Hàm báo ra ngoài
    loading?: boolean; // Trạng thái loading từ trang cha
}

export default function CommonFilter({ dateMode = "date", onFilterChange, loading = false }: Props) {
    const { data: session } = useSession();

    // --- STATE ---
    const [departments, setDepartments] = useState<Department[]>([]);
    const [kips, setKips] = useState<Kip[]>([]);

    // Selection State
    const [date, setDate] = useState<Dayjs>(dayjs());
    const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(null);
    const [mixedDeptValues, setMixedDeptValues] = useState<string[]>([]);
    const [selectedKipIds, setSelectedKipIds] = useState<number[]>([]);

    // Config
    const MATRIX_FACTORY_IDS = [1, 2, 3]; // Các nhà máy áp dụng logic gộp Tổ

    // 1. Load Danh mục (Chỉ 1 lần)
    useEffect(() => {
        const init = async () => {
            try {
                const [dRes, kRes] = await Promise.all([
                    fetch("/api/departments"),
                    fetch("/api/kips")
                ]);
                setDepartments(await dRes.json());
                setKips(await kRes.json());
            } catch (e) {
                message.error("Lỗi tải bộ lọc");
            }
        };
        init();
    }, []);

    // 2. Logic Phân quyền
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

    const isMatrix = useMemo(() => selectedFactoryId ? MATRIX_FACTORY_IDS.includes(selectedFactoryId) : false, [selectedFactoryId]);

    // 3. Tạo Dropdown Gộp (Section/Dept)
    const mixedDeptOptions = useMemo<DeptOption[]>(() => {
        if (!selectedFactoryId) return [];
        const currentDepts = availableDepartments.filter(d => d.factory?.id === selectedFactoryId);
        const options: DeptOption[] = [];
        const processedSections = new Set<string>();

        currentDepts.forEach((d) => {
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

    // 4. Hàm giải mã ID thực tế (Core Logic)
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
                        if (targetKipNumbers.length === 0 || targetKipNumbers.includes(deptKipNum)) {
                            allRealIds.push(d.id);
                        }
                    }
                });
            }
        });
        return Array.from(new Set(allRealIds));
    }, [selectedFactoryId, mixedDeptValues, selectedKipIds, kips, availableDepartments]);

    // 5. Trigger change ra ngoài (Debounce nhẹ)
    useEffect(() => {
        const timer = setTimeout(() => {
            const realIds = resolveRealDepartmentIds();
            // Bắn dữ liệu ra trang cha
            onFilterChange({
                date,
                factoryId: selectedFactoryId,
                realDepartmentIds: realIds,
                selectedKipIds,
                mixedDeptValues
            });
        }, 300);
        return () => clearTimeout(timer);
    }, [date, selectedFactoryId, mixedDeptValues, selectedKipIds]);

    // UI Handlers
    const handleFactoryChange = (val: number) => {
        setSelectedFactoryId(val);
        setMixedDeptValues([]);
        setSelectedKipIds([]);
    };

    const handleReset = () => {
        setSelectedFactoryId(null);
        setMixedDeptValues([]);
        setSelectedKipIds([]);
    };

    return (
        <Card size="small" style={{ marginBottom: 16, background: "#f5f5f5" }} bodyStyle={{ padding: 12 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>

                {/* 1. CHỌN THỜI GIAN */}
                {dateMode !== "none" && (
                    <div>
                        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
                            {dateMode === 'date' ? 'Ngày:' : dateMode === 'month' ? 'Tháng:' : 'Năm:'}
                        </div>
                        <DatePicker
                            value={date}
                            onChange={(d) => d && setDate(d)}
                            format={dateMode === 'date' ? "DD/MM/YYYY" : dateMode === 'month' ? "MM/YYYY" : "YYYY"}
                            picker={dateMode === 'date' ? undefined : dateMode}
                            allowClear={false}
                            style={{ width: 130 }}
                        />
                    </div>
                )}

                {/* 2. CHỌN NHÀ MÁY */}
                <div>
                    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>Nhà máy:</div>
                    <Select
                        style={{ width: 180 }}
                        placeholder="Chọn Nhà máy"
                        value={selectedFactoryId}
                        onChange={handleFactoryChange}
                        options={availableDepartments.reduce((acc: any[], curr) => {
                            if (curr.factory && !acc.find((f) => f.value === curr.factory!.id))
                                acc.push({ value: curr.factory!.id, label: curr.factory!.name });
                            return acc;
                        }, [])}
                    />
                </div>

                {/* 3. CHỌN PHÒNG BAN / TỔ */}
                <div>
                    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
                        {isMatrix ? "Tổ / Bộ phận:" : "Phòng ban:"}
                    </div>
                    <Select
                        mode="multiple"
                        style={{ width: 300 }}
                        placeholder="Chọn..."
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

                {/* 4. CHỌN KÍP */}
                <div>
                    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
                        {isMatrix ? "Lọc theo Kíp:" : "Chọn Kíp:"}
                    </div>
                    <Select
                        mode="multiple"
                        style={{ width: 200 }}
                        placeholder="Tất cả"
                        value={selectedKipIds}
                        onChange={setSelectedKipIds}
                        disabled={!selectedFactoryId}
                        options={kips.filter(k => k.factoryId === selectedFactoryId).map(k => ({ value: k.id, label: k.name }))}
                        allowClear
                    />
                </div>

                {/* 5. NÚT XÓA */}
                <div style={{ marginTop: 20 }}>
                    <Button
                        danger
                        icon={<FilterOutlined />}
                        onClick={handleReset}
                        disabled={!selectedFactoryId}
                    />
                </div>
            </div>
        </Card>
    );
}