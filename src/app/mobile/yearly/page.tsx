"use client";

import React, { useState, useMemo } from "react";
import {
  Button, Drawer, Badge, Spin, message, Tag,
} from "antd";
import {
  FilterOutlined, HomeOutlined, BarChartOutlined,
  CalendarOutlined, CheckSquareOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import dayjs from "dayjs";
import CommonFilter, { FilterResult } from "@/components/CommonFilter";

// --- INTERFACES ---
interface YearlyData {
  id: number;
  code: string;
  fullName: string;
  departmentName: string;
  kipName: string;
  data: (string | number | null)[];
  summary: { col1: number; col2?: number; col3?: number };
}

type ReportType = "evaluation" | "workday" | "leave";

const MONTHS = ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"];

const GRADE_COLORS: Record<string, string> = {
  A: "#52c41a", "A-": "#95de64", B: "#1677ff", "B-": "#69b1ff", C: "#ff4d4f",
};

const TAB_CONFIG: { key: ReportType; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "evaluation", label: "Xếp loại", icon: <CheckSquareOutlined />, color: "#722ed1" },
  { key: "workday",    label: "Tổng công", icon: <BarChartOutlined />,   color: "#1677ff" },
  { key: "leave",      label: "Phép (F)",  icon: <CalendarOutlined />,   color: "#fa8c16" },
];

export default function MobileYearlyPage() {
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<FilterResult | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterResult | null>(null);
  const [reportType, setReportType] = useState<ReportType>("evaluation");
  const [reportData, setReportData] = useState<YearlyData[]>([]);
  const [displayYear, setDisplayYear] = useState<number>(dayjs().year());
  const [loading, setLoading] = useState(false);

  const filterApplied = !!(activeFilter && activeFilter.realDepartmentIds && activeFilter.realDepartmentIds.length > 0);
  const activeTab = TAB_CONFIG.find(t => t.key === reportType)!;

  // --- FETCH ---
  const fetchData = async (filter: FilterResult, type: ReportType) => {
    setDisplayYear(filter.date.year());
    if (!filter.realDepartmentIds || filter.realDepartmentIds.length === 0) {
      setReportData([]);
      return;
    }
    setLoading(true);
    try {
      const year = filter.date.year();
      let url = `/api/reports/yearly?year=${year}&type=${type}`;
      if (filter.factoryId) url += `&factoryId=${filter.factoryId}`;
      url += `&departmentId=${filter.realDepartmentIds.join(",")}`;
      if (filter.selectedKipIds.length > 0) url += `&kipIds=${filter.selectedKipIds.join(",")}`;
      const res = await fetch(url);
      const result = await res.json();
      if (result.error) { message.error(result.error); setReportData([]); }
      else setReportData(result);
    } catch {
      message.error("Lỗi tải dữ liệu");
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = () => {
    if (!currentFilter || currentFilter.realDepartmentIds.length === 0) {
      message.warning("Vui lòng chọn phòng ban");
      return;
    }
    setActiveFilter(currentFilter);
    setFilterDrawerOpen(false);
    fetchData(currentFilter, reportType);
  };

  const handleTabChange = (type: ReportType) => {
    setReportType(type);
    if (activeFilter) fetchData(activeFilter, type);
  };

  // --- RENDER CELL VALUE ---
  const renderCell = (val: string | number | null, type: ReportType) => {
    if (type === "evaluation") {
      const s = String(val || "");
      const color = s.startsWith("A") ? GRADE_COLORS.A : s.startsWith("B") ? GRADE_COLORS.B : s === "C" ? GRADE_COLORS.C : "#bbb";
      return val
        ? <span style={{ color, fontWeight: 700, fontSize: 11 }}>{val}</span>
        : <span style={{ color: "#e0e0e0", fontSize: 11 }}>-</span>;
    }
    return <span style={{ color: val === 0 || val == null ? "#ddd" : "#333", fontSize: 11, fontWeight: val ? 600 : 400 }}>{val ?? "-"}</span>;
  };

  // --- SUMMARY PILLS ---
  const renderSummary = (row: YearlyData) => {
    if (reportType === "evaluation") {
      return (
        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
          <span style={{ background: "#f6ffed", border: "1px solid #b7eb8f", borderRadius: 4, padding: "1px 6px", fontSize: 11, color: GRADE_COLORS.A, fontWeight: 700 }}>A: {row.summary.col1}</span>
          <span style={{ background: "#e6f4ff", border: "1px solid #91caff", borderRadius: 4, padding: "1px 6px", fontSize: 11, color: GRADE_COLORS.B, fontWeight: 700 }}>B: {row.summary.col2 ?? 0}</span>
          <span style={{ background: "#fff2f0", border: "1px solid #ffccc7", borderRadius: 4, padding: "1px 6px", fontSize: 11, color: GRADE_COLORS.C, fontWeight: 700 }}>C: {row.summary.col3 ?? 0}</span>
        </div>
      );
    }
    if (reportType === "workday") {
      return (
        <div style={{ marginTop: 6 }}>
          <span style={{ background: "#e6f4ff", border: "1px solid #91caff", borderRadius: 4, padding: "1px 8px", fontSize: 11, color: "#1677ff", fontWeight: 700 }}>Tổng: {row.summary.col1} công</span>
        </div>
      );
    }
    if (reportType === "leave") {
      const rem = row.summary.col2 ?? 0;
      return (
        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
          <span style={{ background: "#fffbe6", border: "1px solid #ffe58f", borderRadius: 4, padding: "1px 6px", fontSize: 11, color: "#fa8c16", fontWeight: 700 }}>Đã nghỉ: {row.summary.col1}</span>
          <span style={{ background: rem < 0 ? "#fff2f0" : "#f6ffed", border: `1px solid ${rem < 0 ? "#ffccc7" : "#b7eb8f"}`, borderRadius: 4, padding: "1px 6px", fontSize: 11, color: rem < 0 ? "#ff4d4f" : "#52c41a", fontWeight: 700 }}>Còn: {rem}</span>
        </div>
      );
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5", paddingBottom: 24, maxWidth: 480, margin: "0 auto" }}>

      {/* STICKY HEADER */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: `linear-gradient(135deg, ${activeTab.color} 0%, ${activeTab.color}cc 100%)`, color: "#fff", padding: "8px 12px", boxShadow: "0 2px 8px rgba(0,0,0,0.2)", transition: "background 0.3s" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {activeTab.icon} Tổng hợp Năm {displayYear}
            </div>
            {filterApplied && (
              <div style={{ fontSize: 10, opacity: 0.8, marginTop: 1 }}>
                {activeTab.label} · {reportData.length} nhân viên
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
          </div>
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div style={{ display: "flex", gap: 0, padding: "8px 8px 0", borderBottom: "none" }}>
        {TAB_CONFIG.map(tab => (
          <button key={tab.key} onClick={() => handleTabChange(tab.key)}
            style={{
              flex: 1, border: "none", cursor: "pointer", padding: "8px 4px",
              background: reportType === tab.key ? "#fff" : "transparent",
              borderBottom: reportType === tab.key ? `2px solid ${tab.color}` : "2px solid transparent",
              color: reportType === tab.key ? tab.color : "#999",
              fontWeight: reportType === tab.key ? 700 : 400,
              fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              borderRadius: reportType === tab.key ? "8px 8px 0 0" : 0,
              transition: "all 0.2s",
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* FILTER DRAWER */}
      <Drawer title="Bộ lọc báo cáo năm" placement="bottom" height="auto"
        open={filterDrawerOpen} onClose={() => setFilterDrawerOpen(false)}
        styles={{ body: { paddingBottom: 32 } }}
        extra={<Button size="small" danger onClick={() => { setCurrentFilter(null); setActiveFilter(null); setReportData([]); }}>Xóa lọc</Button>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <CommonFilter dateMode="year" onFilterChange={setCurrentFilter} />
          <Button type="primary" size="large" block onClick={handleApplyFilter}
            disabled={!currentFilter || currentFilter.realDepartmentIds.length === 0}>
            Xem báo cáo →
          </Button>
        </div>
      </Drawer>

      {/* CONTENT */}
      <div style={{ padding: "8px 8px 0" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spin size="large" />
            <div style={{ marginTop: 10, color: "#999", fontSize: 13 }}>Đang tải...</div>
          </div>
        ) : !filterApplied ? (
          <div style={{ margin: "8px 0", padding: "32px 16px", background: "#fff", borderRadius: 10, textAlign: "center", color: "#999", border: "1px dashed #ddd" }}>
            <FilterOutlined style={{ fontSize: 32, marginBottom: 10, color: "#ccc" }} />
            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Chưa chọn bộ lọc</div>
            <div style={{ fontSize: 12 }}>Bấm nút <FilterOutlined /> góc trên để chọn năm và bộ phận</div>
          </div>
        ) : reportData.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 10, padding: "32px 16px", textAlign: "center", color: "#999" }}>
            Không có dữ liệu
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {reportData.map((row, index) => (
              <div key={row.id} style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `3px solid ${activeTab.color}` }}>
                {/* Name row */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                  <span style={{ color: "#bbb", fontSize: 11 }}>{index + 1}.</span>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{row.fullName}</span>
                  {row.kipName
                    ? <Tag color="purple" style={{ fontSize: 10, lineHeight: "16px", padding: "0 4px", margin: 0 }}>{row.kipName}</Tag>
                    : <Tag style={{ fontSize: 10, lineHeight: "16px", padding: "0 4px", margin: 0 }}>{row.departmentName}</Tag>
                  }
                </div>

                {/* Month grid - 6 cols x 2 rows */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 2, marginTop: 4 }}>
                  {MONTHS.map((m, i) => (
                    <div key={m} style={{ textAlign: "center", background: "#fafafa", borderRadius: 4, padding: "3px 2px", border: "1px solid #f0f0f0" }}>
                      <div style={{ fontSize: 9, color: "#aaa", lineHeight: 1.2 }}>{m}</div>
                      <div style={{ lineHeight: 1.4 }}>{renderCell(row.data[i], reportType)}</div>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                {renderSummary(row)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
