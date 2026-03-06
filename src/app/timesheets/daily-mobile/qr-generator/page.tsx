"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useSession } from "next-auth/react";
import {
    Select,
    Button,
    Typography,
    Card,
    Empty,
    Tag,
    Divider,
    Alert,
    message,
    Space,
} from "antd";
import {
    PrinterOutlined,
    QrcodeOutlined,
    ArrowLeftOutlined,
    FilterOutlined,
} from "@ant-design/icons";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";

const { Title, Text } = Typography;

interface Factory { id: number; name: string; }
interface Department { id: number; code: string; name: string; isKip: boolean; factory?: Factory; }
interface Kip { id: number; name: string; factoryId: number; }

// Option in the section/dept dropdown — carries isKip so QR logic knows
interface SectionOption {
    value: string;   // "SECTION:X" (matrix kíp group) | "DEPT:id" (plain dept)
    label: string;
    isKip: boolean;  // true → needs kíp dimension; false → one QR only
}

interface QrCard {
    key: string;
    sectionLabel: string;
    kipLabel: string;      // empty string for non-kíp depts
    factoryLabel: string;
    url: string;
}

const MATRIX_FACTORY_IDS = [1, 2, 3];

function getBaseUrl() {
    return typeof window !== "undefined" ? window.location.origin : "";
}

export default function QrGeneratorPage() {
    const { data: session } = useSession();

    const [departments, setDepartments] = useState<Department[]>([]);
    const [kips, setKips] = useState<Kip[]>([]);

    // Filter state (mirrors CommonFilter without date)
    const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(null);
    const [selectedSections, setSelectedSections] = useState<string[]>([]);
    const [selectedKipIds, setSelectedKipIds] = useState<number[]>([]);

    const printRef = useRef<HTMLDivElement>(null);

    // --- Load catalogs ---
    useEffect(() => {
        const init = async () => {
            try {
                const [dRes, kRes] = await Promise.all([
                    fetch("/api/departments"),
                    fetch("/api/kips"),
                ]);
                setDepartments(await dRes.json());
                setKips(await kRes.json());
            } catch {
                message.error("Lỗi tải danh mục");
            }
        };
        init();
    }, []);

    // --- Permission-filtered departments (same as CommonFilter) ---
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

    const isMatrix = useMemo(
        () => (selectedFactoryId ? MATRIX_FACTORY_IDS.includes(selectedFactoryId) : false),
        [selectedFactoryId]
    );

    // --- Factory dropdown ---
    const factoryOptions = useMemo(() =>
        availableDepartments.reduce((acc: { value: number; label: string }[], curr) => {
            if (curr.factory && !acc.find(f => f.value === curr.factory!.id))
                acc.push({ value: curr.factory!.id, label: curr.factory!.name });
            return acc;
        }, []),
        [availableDepartments]
    );

    // --- Section/dept dropdown — same grouping as CommonFilter, but carries isKip ---
    const sectionOptions = useMemo<SectionOption[]>(() => {
        if (!selectedFactoryId) return [];
        const currentDepts = availableDepartments.filter(d => d.factory?.id === selectedFactoryId);
        const options: SectionOption[] = [];
        const seenSections = new Set<string>();

        currentDepts.forEach(d => {
            const matrixRegex = new RegExp(`^${selectedFactoryId}([a-zA-Z]+)(\\d+)$`);
            const match = d.code?.match(matrixRegex);

            if (isMatrix && match && d.isKip) {
                // Shift-based dept in a matrix factory → group into SECTION
                const sectionCode = match[1];
                if (!seenSections.has(sectionCode)) {
                    const displayName = d.name
                        .replace(/(kíp|ca)\s*\d+.*$/gi, "")
                        .replace(/-+.*$/gi, "")
                        .trim();
                    options.push({ value: `SECTION:${sectionCode}`, label: displayName, isKip: true });
                    seenSections.add(sectionCode);
                }
            } else {
                // Plain department (non-shift OR non-matrix factory)
                // isKip comes directly from the DB field
                options.push({ value: `DEPT:${d.id}`, label: d.name, isKip: d.isKip });
            }
        });

        return options.sort((a, b) => a.label.localeCompare(b.label));
    }, [availableDepartments, selectedFactoryId, isMatrix]);

    // --- Kíp dropdown (factory kíps) ---
    const factoryKips = useMemo(
        () => kips.filter(k => k.factoryId === selectedFactoryId),
        [kips, selectedFactoryId]
    );

    // Kíps to print: if none selected → all kíps of factory
    const targetKips = useMemo(
        () => selectedKipIds.length > 0
            ? factoryKips.filter(k => selectedKipIds.includes(k.id))
            : factoryKips,
        [selectedKipIds, factoryKips]
    );

    // Show kíp selector only if at least one selected section is shift-based
    const hasKipSection = useMemo(
        () => selectedSections.some(v => sectionOptions.find(o => o.value === v)?.isKip === true),
        [selectedSections, sectionOptions]
    );

    // --- Build QR cards ---
    //  SECTION:X  (isKip=true)  → one QR per kíp
    //  DEPT:id    (isKip=true)  → one QR per kíp (non-matrix dept that still works in shifts)
    //  DEPT:id    (isKip=false) → one QR only, no kíp dimension
    const qrCards = useMemo<QrCard[]>(() => {
        if (!selectedFactoryId || selectedSections.length === 0) return [];
        const base = getBaseUrl();
        const factoryLabel = factoryOptions.find(f => f.value === selectedFactoryId)?.label || "";

        const cards: QrCard[] = [];

        selectedSections.forEach(sectionVal => {
            const opt = sectionOptions.find(o => o.value === sectionVal);
            if (!opt) return;

            const sectionLabel = opt.label;

            if (opt.isKip && targetKips.length > 0) {
                // Shift-based → one QR per kíp
                targetKips.forEach(kip => {
                    const url = `${base}/timesheets/daily-mobile?f=${selectedFactoryId}&d=${encodeURIComponent(sectionVal)}&k=${kip.id}`;
                    cards.push({
                        key: `${sectionVal}-${kip.id}`,
                        sectionLabel,
                        kipLabel: kip.name,
                        factoryLabel,
                        url,
                    });
                });
            } else {
                // Non-shift dept (isKip=false) OR shift dept with no kíp data → one QR only
                const url = `${base}/timesheets/daily-mobile?f=${selectedFactoryId}&d=${encodeURIComponent(sectionVal)}`;
                cards.push({
                    key: sectionVal,
                    sectionLabel,
                    kipLabel: "",
                    factoryLabel,
                    url,
                });
            }
        });

        return cards;
    }, [selectedFactoryId, selectedSections, sectionOptions, targetKips, factoryOptions]);

    // --- Print (serializes SVG properly) ---
    const handlePrint = () => {
        const printArea = printRef.current;
        if (!printArea) return;

        const serializer = new XMLSerializer();
        const cardEls = Array.from(printArea.querySelectorAll<HTMLElement>(".qr-card"));
        const serializedCards = cardEls.map(card => {
            const clone = card.cloneNode(true) as HTMLElement;
            clone.querySelectorAll("svg").forEach((svgClone, i) => {
                const original = card.querySelectorAll("svg")[i];
                if (original) {
                    const str = serializer.serializeToString(original);
                    const wrapper = document.createElement("div");
                    wrapper.innerHTML = str;
                    if (wrapper.firstChild) svgClone.replaceWith(wrapper.firstChild);
                }
            });
            return clone.outerHTML;
        }).join("\n");

        const win = window.open("", "_blank");
        if (!win) { message.error("Vui lòng cho phép popup để in"); return; }

        win.document.write(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8"/>
  <title>QR Chấm Công</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;background:#fff}
    .qr-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:20px}
    .qr-card{border:1.5px solid #333;border-radius:10px;padding:16px 12px;text-align:center;break-inside:avoid}
    .factory-lbl{font-size:10px;color:#888;margin-bottom:2px}
    .section-lbl{font-size:16px;font-weight:800;color:#111;margin-bottom:6px}
    .kip-lbl{display:inline-block;background:#e6f4ff;color:#1677ff;font-weight:700;font-size:13px;padding:2px 10px;border-radius:20px;margin-bottom:10px}
    .no-kip-lbl{display:inline-block;background:#f6ffed;color:#389e0d;font-size:11px;padding:2px 8px;border-radius:20px;margin-bottom:10px}
    .qr-img{display:flex;justify-content:center;margin:8px 0}
    .qr-img svg{width:150px!important;height:150px!important}
    .url-hint{font-size:8px;color:#bbb;margin-top:8px;word-break:break-all}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style>
</head>
<body>
  <div class="qr-grid">${serializedCards}</div>
  <script>window.onload=()=>{window.print();window.close()}<\/script>
</body>
</html>`);
        win.document.close();
    };

    const handleReset = () => {
        setSelectedFactoryId(null);
        setSelectedSections([]);
        setSelectedKipIds([]);
    };

    // Count summary
    const kipCount = selectedKipIds.length > 0 ? selectedKipIds.length : factoryKips.length;
    const kipSectionCount = selectedSections.filter(v => sectionOptions.find(o => o.value === v)?.isKip).length;
    const noKipSectionCount = selectedSections.length - kipSectionCount;

    return (
        <AdminLayout>
            {/* Header */}
            <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
                <Link href="/timesheets/daily-mobile">
                    <Button icon={<ArrowLeftOutlined />} />
                </Link>
                <Title level={3} style={{ margin: 0 }}>
                    <QrcodeOutlined style={{ marginRight: 8 }} />
                    Tạo QR Chấm Công Mobile
                </Title>
            </div>

            <Alert
                type="info"
                showIcon
                style={{ marginBottom: 20 }}
                message="Hướng dẫn"
                description={
                    <ol style={{ paddingLeft: 16, margin: 0 }}>
                        <li>Chọn <b>Nhà máy</b> → <b>Tổ/Bộ phận</b> → (tuỳ chọn) <b>Kíp cụ thể</b>.</li>
                        <li><b>Bộ phận theo kíp</b>: tạo 1 QR riêng cho mỗi kíp.</li>
                        <li><b>Bộ phận không theo kíp</b> (hành chính, phụ trợ): chỉ tạo 1 QR duy nhất.</li>
                        <li>Không chọn kíp → in QR cho <b>tất cả kíp</b> của tổ đó.</li>
                        <li>Bấm <b>In</b> để in QR dán lên bảng kíp hoặc phòng làm việc.</li>
                    </ol>
                }
            />

            {/* ===== FILTER ===== */}
            <Card
                size="small"
                style={{ marginBottom: 20, background: "#f5f5f5" }}
                styles={{ body: { padding: 12 } }}
            >
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>

                    {/* 1. Nhà máy */}
                    <div>
                        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>Nhà máy:</div>
                        <Select
                            style={{ width: 180 }}
                            placeholder="Chọn nhà máy"
                            value={selectedFactoryId}
                            onChange={(val) => {
                                setSelectedFactoryId(val ?? null);
                                setSelectedSections([]);
                                setSelectedKipIds([]);
                            }}
                            options={factoryOptions}
                            allowClear
                        />
                    </div>

                    {/* 2. Tổ / Phòng ban */}
                    <div>
                        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
                            {isMatrix ? "Tổ / Bộ phận:" : "Phòng ban:"}
                        </div>
                        <Select
                            mode="multiple"
                            style={{ width: 320 }}
                            placeholder="Chọn tổ / phòng ban..."
                            value={selectedSections}
                            onChange={setSelectedSections}
                            disabled={!selectedFactoryId}
                            showSearch
                            optionFilterProp="label"
                            maxTagCount="responsive"
                            allowClear
                            options={sectionOptions.map(o => ({
                                value: o.value,
                                label: o.label,
                                // Visual cue: italic for non-kíp depts
                            }))}
                            optionRender={(opt) => {
                                const secOpt = sectionOptions.find(o => o.value === opt.value);
                                return (
                                    <Space>
                                        <span>{opt.label as string}</span>
                                        {secOpt && secOpt.isKip && (
                                            <Tag color="green" style={{ fontSize: 10 }}>Ca Kíp</Tag>
                                        )}
                                    </Space>
                                );
                            }}
                        />
                    </div>

                    {/* 3. Kíp — chỉ hiện khi có ít nhất 1 bộ phận theo kíp được chọn */}
                    {hasKipSection && (
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
                                Kíp cần in:
                                {selectedKipIds.length === 0 && (
                                    <Tag style={{ marginLeft: 6, fontSize: 11 }}>Tất cả</Tag>
                                )}
                            </div>
                            <Select
                                mode="multiple"
                                style={{ width: 240 }}
                                placeholder="Tất cả kíp (mặc định)"
                                value={selectedKipIds}
                                onChange={setSelectedKipIds}
                                options={factoryKips.map(k => ({ value: k.id, label: k.name }))}
                                allowClear
                            />
                        </div>
                    )}

                    {/* Reset */}
                    <Button
                        danger
                        icon={<FilterOutlined />}
                        onClick={handleReset}
                        disabled={!selectedFactoryId}
                        title="Xóa bộ lọc"
                    />
                </div>
            </Card>

            {/* ===== SUMMARY + PRINT ===== */}
            {qrCards.length > 0 && (
                <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Space wrap>
                        <Text>
                            Hiển thị <strong>{qrCards.length}</strong> mã QR
                        </Text>
                        {kipSectionCount > 0 && (
                            <Tag color="blue">
                                {kipSectionCount} tổ theo kíp × {kipCount} kíp
                            </Tag>
                        )}
                        {noKipSectionCount > 0 && (
                            <Tag color="green">
                                {noKipSectionCount} bộ phận không theo kíp
                            </Tag>
                        )}
                    </Space>
                    <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint} size="large">
                        In {qrCards.length} mã QR
                    </Button>
                </div>
            )}

            {/* ===== QR GRID ===== */}
            {qrCards.length === 0 ? (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                        <span>
                            Chọn <b>Nhà máy</b> và <b>Tổ / Phòng ban</b> để tạo QR code
                        </span>
                    }
                />
            ) : (
                <>
                    {/* On-screen grid */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
                        gap: 16,
                    }}>
                        {qrCards.map(card => (
                            <Card
                                key={card.key}
                                size="small"
                                style={{ textAlign: "center", border: "1.5px solid #e0e0e0" }}
                                styles={{ body: { padding: "16px 12px" } }}
                            >
                                <div style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>
                                    {card.factoryLabel}
                                </div>
                                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>
                                    {card.sectionLabel}
                                </div>
                                {card.kipLabel ? (
                                    <Tag color="blue" style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                                        {card.kipLabel}
                                    </Tag>
                                ) : (
                                    <Tag color="green" style={{ fontSize: 11, marginBottom: 10 }}>
                                        {/* Bộ phận (không theo kíp) */}
                                    </Tag>
                                )}
                                <div style={{ display: "flex", justifyContent: "center", margin: "10px 0" }}>
                                    <QRCodeSVG value={card.url} size={160} level="M" includeMargin />
                                </div>
                                <div style={{ fontSize: 10, color: "#bbb", wordBreak: "break-all", marginBottom: 8 }}>
                                    {card.url}
                                </div>
                                <Divider style={{ margin: "8px 0" }} />
                                <Button size="small" href={card.url} target="_blank">
                                    Mở thử
                                </Button>
                            </Card>
                        ))}
                    </div>

                    {/* Hidden clone for print */}
                    <div style={{ display: "none" }} aria-hidden>
                        <div ref={printRef}>
                            {qrCards.map(card => (
                                <div key={card.key} className="qr-card">
                                    <div className="factory-lbl">{card.factoryLabel}</div>
                                    <div className="section-lbl">{card.sectionLabel}</div>
                                    {card.kipLabel
                                        ? <div className="kip-lbl">{card.kipLabel}</div>
                                        : <div className="no-kip-lbl">Bộ phận (không theo kíp)</div>
                                    }
                                    <div className="qr-img">
                                        <QRCodeSVG value={card.url} size={150} level="M" includeMargin />
                                    </div>
                                    <div className="url-hint">{card.url}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </AdminLayout>
    );
}
