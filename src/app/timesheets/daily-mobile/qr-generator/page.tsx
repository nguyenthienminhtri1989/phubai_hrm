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
    Space,
    Divider,
    Alert,
    message,
} from "antd";
import { PrinterOutlined, QrcodeOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";

const { Title, Text } = Typography;

interface Factory { id: number; name: string; }
interface Department { id: number; code: string; name: string; factory?: Factory; }
interface Kip { id: number; name: string; factoryId: number; }

const MATRIX_FACTORY_IDS = [1, 2, 3];

// Get the base URL for QR codes
function getBaseUrl() {
    if (typeof window !== "undefined") {
        return window.location.origin;
    }
    return "";
}

export default function QrGeneratorPage() {
    const { data: session } = useSession();

    const [departments, setDepartments] = useState<Department[]>([]);
    const [kips, setKips] = useState<Kip[]>([]);

    const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(null);
    const [selectedSections, setSelectedSections] = useState<string[]>([]);

    const printRef = useRef<HTMLDivElement>(null);

    // Load catalogs
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

    // Permission-filtered departments
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

    const factoryOptions = useMemo(() =>
        availableDepartments.reduce((acc: { value: number; label: string }[], curr) => {
            if (curr.factory && !acc.find(f => f.value === curr.factory!.id))
                acc.push({ value: curr.factory!.id, label: curr.factory!.name });
            return acc;
        }, []),
        [availableDepartments]
    );

    const isMatrix = useMemo(() =>
        selectedFactoryId ? MATRIX_FACTORY_IDS.includes(selectedFactoryId) : false,
        [selectedFactoryId]
    );

    // Unique sections / departments for the selected factory
    const sectionOptions = useMemo(() => {
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

    // Kips for the selected factory
    const factoryKips = useMemo(() =>
        kips.filter(k => k.factoryId === selectedFactoryId),
        [kips, selectedFactoryId]
    );

    // --- Generate QR cards ---
    // For matrix factories: one QR per (section × kíp)
    // For non-matrix: one QR per department (no kíp dimension)
    interface QrCard {
        key: string;
        title: string;
        subtitle: string;
        url: string;
    }

    const qrCards = useMemo<QrCard[]>(() => {
        if (!selectedFactoryId || selectedSections.length === 0) return [];
        const base = getBaseUrl();
        const factory = factoryOptions.find(f => f.value === selectedFactoryId);

        if (isMatrix && factoryKips.length > 0) {
            // One card per section × kíp
            const cards: QrCard[] = [];
            selectedSections.forEach((sectionVal) => {
                const sectionLabel = sectionOptions.find(o => o.value === sectionVal)?.label || sectionVal;
                factoryKips.forEach((kip) => {
                    const url = `${base}/timesheets/daily-mobile?f=${selectedFactoryId}&d=${encodeURIComponent(sectionVal)}&k=${kip.id}`;
                    cards.push({
                        key: `${sectionVal}-${kip.id}`,
                        title: sectionLabel,
                        subtitle: `${factory?.label || ""} · ${kip.name}`,
                        url,
                    });
                });
            });
            return cards;
        } else {
            // One card per department
            return selectedSections.map((deptVal) => {
                const deptLabel = sectionOptions.find(o => o.value === deptVal)?.label || deptVal;
                const url = `${base}/timesheets/daily-mobile?f=${selectedFactoryId}&d=${encodeURIComponent(deptVal)}`;
                return {
                    key: deptVal,
                    title: deptLabel,
                    subtitle: factory?.label || "",
                    url,
                };
            });
        }
    }, [selectedFactoryId, selectedSections, isMatrix, factoryKips, sectionOptions, factoryOptions]);

    // --- PRINT ---
    const handlePrint = () => {
        if (!printRef.current) return;
        const content = printRef.current.innerHTML;

        const printWindow = window.open("", "_blank");
        if (!printWindow) { message.error("Vui lòng cho phép popup để in"); return; }

        printWindow.document.write(`
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>QR Chấm Công</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #fff; }
    .qr-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      padding: 20px;
    }
    .qr-card {
      border: 1.5px solid #333;
      border-radius: 10px;
      padding: 16px 12px;
      text-align: center;
      break-inside: avoid;
    }
    .qr-card .factory-name {
      font-size: 10px;
      color: #666;
      margin-bottom: 2px;
    }
    .qr-card .section-name {
      font-size: 15px;
      font-weight: 800;
      color: #111;
      margin-bottom: 4px;
    }
    .qr-card .kip-name {
      font-size: 12px;
      color: #1677ff;
      font-weight: 600;
      margin-bottom: 10px;
    }
    .qr-card svg {
      width: 140px !important;
      height: 140px !important;
    }
    .qr-card .url-hint {
      font-size: 8px;
      color: #aaa;
      margin-top: 8px;
      word-break: break-all;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .qr-grid { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="qr-grid">${content}</div>
  <script>window.onload = () => { window.print(); window.close(); }<\/script>
</body>
</html>`);
        printWindow.document.close();
    };

    return (
        <AdminLayout>
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
                message="Hướng dẫn sử dụng"
                description={
                    <ol style={{ paddingLeft: 18, margin: 0 }}>
                        <li>Chọn nhà máy và tổ/bộ phận cần tạo QR.</li>
                        <li>Hệ thống tự tạo một QR riêng cho mỗi kíp.</li>
                        <li>Người chấm công dùng điện thoại quét QR → trang chấm công tự hiển thị đúng kíp.</li>
                        <li>In QR để dán ở bảng kíp hoặc phòng làm việc.</li>
                    </ol>
                }
            />

            {/* Filter */}
            <Card size="small" style={{ marginBottom: 20 }}>
                <Space wrap size="large">
                    <div>
                        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>Nhà máy</div>
                        <Select
                            style={{ width: 200 }}
                            placeholder="Chọn nhà máy..."
                            value={selectedFactoryId}
                            onChange={(val) => { setSelectedFactoryId(val); setSelectedSections([]); }}
                            options={factoryOptions}
                            allowClear
                        />
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
                            {isMatrix ? "Tổ / Bộ phận" : "Phòng ban"}
                        </div>
                        <Select
                            mode="multiple"
                            style={{ width: 320 }}
                            placeholder="Chọn tổ/phòng ban (có thể chọn nhiều)..."
                            value={selectedSections}
                            onChange={setSelectedSections}
                            options={sectionOptions}
                            disabled={!selectedFactoryId}
                            showSearch
                            optionFilterProp="label"
                            maxTagCount={3}
                            allowClear
                        />
                    </div>
                    {qrCards.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                            <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
                                In {qrCards.length} mã QR
                            </Button>
                        </div>
                    )}
                </Space>
            </Card>

            {/* Summary */}
            {qrCards.length > 0 && (
                <div style={{ marginBottom: 16, color: "#555" }}>
                    Hiển thị <strong>{qrCards.length}</strong> mã QR
                    {isMatrix && factoryKips.length > 0 && (
                        <span> · {selectedSections.length} tổ × {factoryKips.length} kíp</span>
                    )}
                </div>
            )}

            {/* QR Grid */}
            {qrCards.length === 0 ? (
                <Empty description="Chọn nhà máy và tổ/phòng ban để xem QR code" />
            ) : (
                <>
                    {/* Visible grid */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                        gap: 16,
                    }}>
                        {qrCards.map((card) => (
                            <Card
                                key={card.key}
                                size="small"
                                style={{ textAlign: "center", border: "1.5px solid #e0e0e0" }}
                                bodyStyle={{ padding: "16px 12px" }}
                            >
                                <Text type="secondary" style={{ fontSize: 11 }}>{card.subtitle}</Text>
                                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{card.title}</div>
                                <div style={{ display: "flex", justifyContent: "center", margin: "12px 0" }}>
                                    <QRCodeSVG
                                        value={card.url}
                                        size={160}
                                        level="M"
                                        includeMargin
                                    />
                                </div>
                                <div style={{ fontSize: 11, color: "#aaa", wordBreak: "break-all" }}>
                                    {card.url}
                                </div>
                                <Divider style={{ margin: "10px 0" }} />
                                <Button
                                    size="small"
                                    href={card.url}
                                    target="_blank"
                                    style={{ fontSize: 12 }}
                                >
                                    Mở thử
                                </Button>
                            </Card>
                        ))}
                    </div>

                    {/* Hidden print-only content */}
                    <div style={{ display: "none" }}>
                        <div ref={printRef}>
                            {qrCards.map((card) => (
                                <div key={card.key} className="qr-card">
                                    <div className="factory-name">{card.subtitle}</div>
                                    <div className="section-name">{card.title}</div>
                                    <div className="kip-name">Chấm công mobile</div>
                                    <QRCodeSVG value={card.url} size={140} level="M" includeMargin />
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
