"use client";

import React, { useState, useMemo, useRef } from "react";
import { Button, Skeleton, Empty, message, Tag } from "antd";
import {
  LeftOutlined, RightOutlined, ArrowLeftOutlined,
  CloseOutlined, UserOutlined, HomeOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import Link from "next/link";
import CommonFilter, { FilterResult } from "@/components/CommonFilter";

interface AttendanceCode { id: number; code: string; name: string; color: string; }
interface MonthlyEmployeeData {
  id: number; code: string; fullName: string;
  department?: { name: string; factory?: { name: string } };
  kip?: { name: string };
  timesheets: { date: string; attendanceCode: AttendanceCode }[];
  classification?: string | null;
}
type ScreenState = "filter" | "list" | "calendar";

const countCodes = (
  list: { attendanceCode: AttendanceCode }[],
  fullCodes: string[], halfCodes: string[] = []
) => (list || []).reduce((total, t) => {
  const code = t.attendanceCode.code;
  if (fullCodes.includes(code)) return total + 1;
  if (halfCodes.includes(code)) return total + 0.5;
  return total;
}, 0);

export default function MobileTimesheetPage() {
  const [screen, setScreen] = useState<ScreenState>("filter");
  const [currentFilter, setCurrentFilter] = useState<FilterResult | null>(null);
  const [employees, setEmployees] = useState<MonthlyEmployeeData[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<MonthlyEmployeeData | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<Dayjs>(dayjs());
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  const fetchEmployees = async (filter: FilterResult) => {
    if (!filter.realDepartmentIds || filter.realDepartmentIds.length === 0) {
      message.warning("Vui lòng chọn phòng ban"); return;
    }
    setLoadingList(true);
    try {
      const month = filter.date.month() + 1, year = filter.date.year();
      let url = `/api/timesheets/monthly?month=${month}&year=${year}`;
      if (filter.factoryId) url += `&factoryId=${filter.factoryId}`;
      url += `&departmentId=${filter.realDepartmentIds.join(",")}`;
      if (filter.selectedKipIds.length > 0) url += `&kipIds=${filter.selectedKipIds.join(",")}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) { message.error(data.error); setEmployees([]); }
      else setEmployees(data);
    } catch { message.error("Lỗi tải dữ liệu"); setEmployees([]); }
    finally { setLoadingList(false); }
  };

  const fetchEmployeeForMonth = async (empId: number, newMonth: Dayjs) => {
    if (!currentFilter) return;
    setLoadingCalendar(true);
    try {
      const month = newMonth.month() + 1, year = newMonth.year();
      let url = `/api/timesheets/monthly?month=${month}&year=${year}`;
      if (currentFilter.factoryId) url += `&factoryId=${currentFilter.factoryId}`;
      url += `&departmentId=${currentFilter.realDepartmentIds.join(",")}`;
      if (currentFilter.selectedKipIds.length > 0) url += `&kipIds=${currentFilter.selectedKipIds.join(",")}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.error) {
        const found = (data as MonthlyEmployeeData[]).find(e => e.id === empId);
        setSelectedEmployee(found ?? (prev => prev ? { ...prev!, timesheets: [] } : null) as any);
      }
    } catch { message.error("Lỗi tải dữ liệu"); }
    finally { setLoadingCalendar(false); }
  };

  const handleViewList = () => {
    if (!currentFilter || currentFilter.realDepartmentIds.length === 0) {
      message.warning("Vui lòng chọn phòng ban"); return;
    }
    setScreen("list");
    fetchEmployees(currentFilter);
  };

  const handleSelectEmployee = (emp: MonthlyEmployeeData) => {
    setSelectedEmployee(emp);
    setCalendarMonth(currentFilter?.date || dayjs());
    setScreen("calendar");
  };

  const changeMonth = (delta: number) => {
    if (!selectedEmployee) return;
    const newMonth = calendarMonth.add(delta, "month");
    setCalendarMonth(newMonth);
    fetchEmployeeForMonth(selectedEmployee.id, newMonth);
  };

  // Grouped employee list
  const groupedList = useMemo(() => {
    type Row = { type: "header"; key: string; title: string } | { type: "emp"; key: number; emp: MonthlyEmployeeData };
    const rows: Row[] = [];
    let currentKey = "";
    employees.forEach(emp => {
      const groupKey = `${emp.department?.factory?.name || "Khác"} - ${emp.department?.name || "Chưa phân loại"}${emp.kip?.name ? ` - ${emp.kip.name}` : ""}`;
      if (groupKey !== currentKey) {
        rows.push({ type: "header", key: `g-${groupKey}-${emp.id}`, title: groupKey.toUpperCase() });
        currentKey = groupKey;
      }
      rows.push({ type: "emp", key: emp.id, emp });
    });
    return rows;
  }, [employees]);

  // Swipe
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 50) { dx < 0 ? changeMonth(1) : changeMonth(-1); }
  };

  // Calendar cells
  const calendarCells = useMemo(() => {
    const firstDay = calendarMonth.startOf("month");
    const daysInMonth = calendarMonth.daysInMonth();
    const jsDay = firstDay.day();
    const colIndex = jsDay === 0 ? 6 : jsDay - 1;
    const cells: ({ day: number; date: Dayjs } | null)[] = [];
    for (let i = 0; i < colIndex; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, date: calendarMonth.date(d) });
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calendarMonth]);

  const logsByDate = useMemo(() => {
    const map = new Map<string, AttendanceCode>();
    (selectedEmployee?.timesheets || []).forEach(t => map.set(t.date.slice(0, 10), t.attendanceCode));
    return map;
  }, [selectedEmployee]);

  const summary = useMemo(() => {
    const ts = selectedEmployee?.timesheets || [];
    return {
      total: countCodes(ts, ["+", "X", "XD", "CT", "LĐ", "XL", "LE", "LD"], ["X/2", "1/2X"]),
      ca3: countCodes(ts, ["XD", "LD"]),
      phep: countCodes(ts, ["F", "R", "L"]),
      om: countCodes(ts, ["Ô", "CÔ", "TS", "DS", "T", "CL"]),
      klu: countCodes(ts, ["RO"]),
      vld: countCodes(ts, ["O"]),
    };
  }, [selectedEmployee]);

  const pageStyle: React.CSSProperties = {
    maxWidth: 480, margin: "0 auto", minHeight: "100vh",
    background: "#f5f5f5", display: "flex", flexDirection: "column",
  };

  // ── SCREEN 1: FILTER ──
  if (screen === "filter") return (
    <div style={pageStyle}>
      <div style={{ background: "linear-gradient(135deg, #1677ff 0%, #0958d9 100%)", color: "#fff", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>📋 Chấm công tháng</div>
        <Link href="/"><Button icon={<HomeOutlined />} size="small" style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: 32, height: 32 }} /></Link>
      </div>
      <div style={{ padding: 12, flex: 1 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", marginBottom: 12 }}>
          <CommonFilter dateMode="month" onFilterChange={setCurrentFilter} />
        </div>
        <Button type="primary" size="large" block onClick={handleViewList}
          disabled={!currentFilter || !currentFilter.realDepartmentIds || currentFilter.realDepartmentIds.length === 0}
          style={{ height: 48, fontSize: 15, borderRadius: 10 }}>
          Xem danh sách →
        </Button>
      </div>
    </div>
  );

  // ── SCREEN 2: DANH SÁCH ──
  if (screen === "list") return (
    <div style={pageStyle}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "linear-gradient(135deg, #1677ff 0%, #0958d9 100%)", color: "#fff", padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
        <Button icon={<ArrowLeftOutlined />} size="small" onClick={() => setScreen("filter")}
          style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", height: 32 }}>Bộ lọc</Button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Tháng {currentFilter?.date.format("MM/YYYY")}
          </div>
        </div>
        <div style={{ fontSize: 11, opacity: 0.8, flexShrink: 0 }}>{employees.length} NV</div>
        <Link href="/"><Button icon={<HomeOutlined />} size="small" style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: 32, height: 32 }} /></Link>
      </div>

      <div style={{ padding: "8px 10px", flex: 1 }}>
        {loadingList ? (
          [...Array(5)].map((_, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 10, padding: 14, marginBottom: 8 }}>
              <Skeleton active paragraph={{ rows: 1 }} />
            </div>
          ))
        ) : groupedList.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 10, padding: 32, textAlign: "center" }}>
            <Empty description="Không có nhân viên" />
          </div>
        ) : (
          groupedList.map(row => row.type === "header" ? (
            <div key={row.key} style={{ background: "#e6f4ff", color: "#0958d9", padding: "6px 12px", fontSize: 11, fontWeight: 700, borderRadius: 6, marginTop: 8, marginBottom: 2, letterSpacing: 0.5 }}>
              {row.title}
            </div>
          ) : (
            <button key={row.key} onClick={() => handleSelectEmployee(row.emp)} style={{ width: "100%", background: "#fff", borderRadius: 10, padding: "12px 14px", border: "1px solid #f0f0f0", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, marginBottom: 6, minHeight: 56, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", textAlign: "left" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#e6f4ff", color: "#1677ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                <UserOutlined />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                  {row.emp.fullName}
                  {row.emp.classification && (
                    <Tag color={row.emp.classification.startsWith("A") ? "green" : row.emp.classification === "B" ? "blue" : "orange"}
                      style={{ fontSize: 10, padding: "0 4px", margin: 0, lineHeight: "16px" }}>
                      {row.emp.classification}
                    </Tag>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#999", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.emp.code}{row.emp.department?.name ? ` · ${row.emp.department.name}` : ""}{row.emp.kip?.name ? ` · ${row.emp.kip.name}` : ""}
                </div>
              </div>
              <RightOutlined style={{ color: "#bbb", fontSize: 12, flexShrink: 0 }} />
            </button>
          ))
        )}
      </div>
    </div>
  );

  // ── SCREEN 3: LỊCH ──
  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "linear-gradient(135deg, #1677ff 0%, #0958d9 100%)", color: "#fff", padding: "10px 12px", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button icon={<ArrowLeftOutlined />} size="small" onClick={() => setScreen("list")}
            style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: 32, height: 32, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
              {selectedEmployee?.fullName}
              {selectedEmployee?.classification && (
                <Tag color={selectedEmployee.classification.startsWith("A") ? "green" : selectedEmployee.classification === "B" ? "blue" : "orange"}
                  style={{ fontSize: 10, padding: "0 4px", margin: 0, lineHeight: "16px" }}>
                  Loại {selectedEmployee.classification}
                </Tag>
              )}
            </div>
            <div style={{ fontSize: 11, opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selectedEmployee?.code}{selectedEmployee?.department?.name ? ` · ${selectedEmployee.department.name}` : ""}{selectedEmployee?.kip?.name ? ` · ${selectedEmployee.kip.name}` : ""}
            </div>
          </div>
          <Button icon={<CloseOutlined />} size="small" onClick={() => setScreen("list")}
            style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: 32, height: 32, flexShrink: 0 }} />
        </div>
        {/* Month nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 10 }}>
          <Button icon={<LeftOutlined />} shape="circle" size="small" onClick={() => changeMonth(-1)}
            style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff" }} />
          <span style={{ fontWeight: 700, fontSize: 14, minWidth: 120, textAlign: "center" }}>
            Tháng {calendarMonth.format("MM/YYYY")}
          </span>
          <Button icon={<RightOutlined />} shape="circle" size="small" onClick={() => changeMonth(1)}
            style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff" }} />
        </div>
      </div>

      <div style={{ padding: "10px 10px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Calendar */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 4 }}>
            {["T2","T3","T4","T5","T6","T7","CN"].map((d, i) => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: i === 6 ? "#ff4d4f" : "#666", padding: "4px 0" }}>{d}</div>
            ))}
          </div>
          {loadingCalendar ? <Skeleton active paragraph={{ rows: 5 }} /> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
              {calendarCells.map((cell, idx) => {
                const colInWeek = idx % 7;
                if (!cell) return <div key={idx} style={{ aspectRatio: "1/1", background: "#fafafa", borderRadius: 5 }} />;
                const ac = logsByDate.get(cell.date.format("YYYY-MM-DD"));
                const isToday = cell.date.isSame(dayjs(), "day");
                const isSun = colInWeek === 6;
                return (
                  <div key={idx} title={ac?.name} style={{
                    aspectRatio: "1/1", background: ac ? ac.color : "#f5f5f5", borderRadius: 5,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    border: isToday ? "2px solid #1677ff" : "1px solid transparent",
                    position: "relative", padding: 2, overflow: "hidden",
                  }}>
                    <div style={{ position: "absolute", top: 2, left: 3, fontSize: 10, fontWeight: 500, color: ac ? "rgba(255,255,255,0.9)" : isSun ? "#ff4d4f" : "#999" }}>{cell.day}</div>
                    {ac && <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.25)", marginTop: 6, lineHeight: 1 }}>{ac.code}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Summary */}
        <div style={{ background: "#fff", borderRadius: 12, padding: "10px 12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { icon: "🟢", label: "Tổng công", value: summary.total },
              { icon: "🌙", label: "Ca 3", value: summary.ca3 },
              { icon: "📋", label: "Phép 100%", value: summary.phep },
              { icon: "🏥", label: "Ốm/BHXH", value: summary.om },
              { icon: "❌", label: "Không lương", value: summary.klu },
              { icon: "⚠️", label: "Vô lý do", value: summary.vld },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: item.value === 0 ? "#fafafa" : "#f0f7ff", borderRadius: 8, border: `1px solid ${item.value === 0 ? "#f0f0f0" : "#bae0ff"}`, opacity: item.value === 0 ? 0.6 : 1 }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 11, color: "#666", lineHeight: 1.2 }}>{item.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
