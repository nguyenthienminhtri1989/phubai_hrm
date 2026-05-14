"use client";

import React, { useState, useMemo, useRef } from "react";
import AdminLayout from "@/components/AdminLayout";
import CommonFilter, { FilterResult } from "@/components/CommonFilter";
import { Button, Skeleton, Empty, message, Tag } from "antd";
import {
  LeftOutlined,
  RightOutlined,
  ArrowLeftOutlined,
  CloseOutlined,
  UserOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";

// --- INTERFACES (copy từ monthly/page.tsx) ---
interface AttendanceCode {
  id: number;
  code: string;
  name: string;
  color: string;
}
interface MonthlyEmployeeData {
  id: number;
  code: string;
  fullName: string;
  department?: { name: string; factory?: { name: string } };
  kip?: { name: string };
  timesheets: { date: string; attendanceCode: AttendanceCode }[];
  classification?: string | null;
}

type ScreenState = "filter" | "list" | "calendar";

// Helper đếm công
const countCodes = (
  list: { attendanceCode: AttendanceCode }[],
  fullCodes: string[],
  halfCodes: string[] = []
) =>
  (list || []).reduce((total, t) => {
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

  const [selectedEmployee, setSelectedEmployee] =
    useState<MonthlyEmployeeData | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<Dayjs>(dayjs());
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  // --- FETCH danh sách NV theo filter ---
  const fetchEmployees = async (filter: FilterResult) => {
    if (!filter.realDepartmentIds || filter.realDepartmentIds.length === 0) {
      message.warning("Vui lòng chọn phòng ban");
      return;
    }
    setLoadingList(true);
    try {
      const month = filter.date.month() + 1;
      const year = filter.date.year();

      let url = `/api/timesheets/monthly?month=${month}&year=${year}`;
      if (filter.factoryId) url += `&factoryId=${filter.factoryId}`;
      url += `&departmentId=${filter.realDepartmentIds.join(",")}`;
      if (filter.selectedKipIds.length > 0)
        url += `&kipIds=${filter.selectedKipIds.join(",")}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.error) {
        message.error(data.error);
        setEmployees([]);
      } else {
        setEmployees(data);
      }
    } catch (e) {
      console.error(e);
      message.error("Lỗi tải dữ liệu");
      setEmployees([]);
    } finally {
      setLoadingList(false);
    }
  };

  // --- FETCH lại data 1 NV cho tháng khác ---
  const fetchEmployeeForMonth = async (empId: number, newMonth: Dayjs) => {
    if (!currentFilter) return;
    setLoadingCalendar(true);
    try {
      const month = newMonth.month() + 1;
      const year = newMonth.year();

      let url = `/api/timesheets/monthly?month=${month}&year=${year}`;
      if (currentFilter.factoryId) url += `&factoryId=${currentFilter.factoryId}`;
      url += `&departmentId=${currentFilter.realDepartmentIds.join(",")}`;
      if (currentFilter.selectedKipIds.length > 0)
        url += `&kipIds=${currentFilter.selectedKipIds.join(",")}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.error) {
        message.error(data.error);
      } else {
        const found = (data as MonthlyEmployeeData[]).find((e) => e.id === empId);
        if (found) {
          setSelectedEmployee(found);
          // cập nhật cache employees với data tháng mới? Không, list giữ nguyên tháng filter.
        } else {
          // Không có dữ liệu tháng này cho NV này -> tạo bản trống
          setSelectedEmployee((prev) =>
            prev ? { ...prev, timesheets: [] } : null
          );
        }
      }
    } catch (e) {
      console.error(e);
      message.error("Lỗi tải dữ liệu");
    } finally {
      setLoadingCalendar(false);
    }
  };

  const handleFilterChange = (result: FilterResult) => {
    setCurrentFilter(result);
  };

  const handleViewList = () => {
    if (!currentFilter || currentFilter.realDepartmentIds.length === 0) {
      message.warning("Vui lòng chọn phòng ban");
      return;
    }
    setScreen("list");
    fetchEmployees(currentFilter);
  };

  const handleSelectEmployee = (emp: MonthlyEmployeeData) => {
    setSelectedEmployee(emp);
    setCalendarMonth(currentFilter?.date || dayjs());
    setScreen("calendar");
  };

  // --- Group danh sách NV theo phòng ban/kíp ---
  const groupedList = useMemo(() => {
    type Row =
      | { type: "header"; key: string; title: string }
      | { type: "emp"; key: number; emp: MonthlyEmployeeData };
    const rows: Row[] = [];
    let currentKey = "";
    employees.forEach((emp) => {
      const factoryName = emp.department?.factory?.name || "Khác";
      const deptName = emp.department?.name || "Chưa phân loại";
      const kipName = emp.kip?.name ? ` - ${emp.kip.name}` : "";
      const groupKey = `${factoryName} - ${deptName}${kipName}`;
      if (groupKey !== currentKey) {
        rows.push({
          type: "header",
          key: `g-${groupKey}-${emp.id}`,
          title: groupKey.toUpperCase(),
        });
        currentKey = groupKey;
      }
      rows.push({ type: "emp", key: emp.id, emp });
    });
    return rows;
  }, [employees]);

  // --- Swipe tháng ---
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 50) {
      if (dx < 0) changeMonth(1);
      else changeMonth(-1);
    }
  };

  const changeMonth = (delta: number) => {
    if (!selectedEmployee) return;
    const newMonth = calendarMonth.add(delta, "month");
    setCalendarMonth(newMonth);
    fetchEmployeeForMonth(selectedEmployee.id, newMonth);
  };

  // --- Build grid lịch 7 cột (T2..CN) ---
  const calendarCells = useMemo(() => {
    const firstDay = calendarMonth.startOf("month");
    const daysInMonth = calendarMonth.daysInMonth();
    // 0=CN ... 6=T7 -> map sang cột index (T2=0, T3=1, ..., T7=5, CN=6)
    const jsDay = firstDay.day();
    const colIndex = jsDay === 0 ? 6 : jsDay - 1;

    const cells: ({ day: number; date: Dayjs } | null)[] = [];
    for (let i = 0; i < colIndex; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, date: calendarMonth.date(d) });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calendarMonth]);

  const logsByDate = useMemo(() => {
    const map = new Map<string, AttendanceCode>();
    (selectedEmployee?.timesheets || []).forEach((t) => {
      const key = t.date.slice(0, 10);
      map.set(key, t.attendanceCode);
    });
    return map;
  }, [selectedEmployee]);

  // --- Summary ---
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

  // ====== RENDER ======
  return (
    <AdminLayout>
      <div
        className="mx-auto"
        style={{ maxWidth: 480, background: "#f5f5f5", minHeight: "100%", padding: 12 }}
      >
        {screen === "filter" && (
          <div className="flex flex-col gap-3">
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <h2 className="text-base font-semibold m-0 mb-2">
                📋 Xem chấm công tháng
              </h2>
              <CommonFilter dateMode="month" onFilterChange={handleFilterChange} />
            </div>
            <Button
              type="primary"
              size="large"
              block
              onClick={handleViewList}
              disabled={
                !currentFilter ||
                !currentFilter.realDepartmentIds ||
                currentFilter.realDepartmentIds.length === 0
              }
            >
              Xem danh sách →
            </Button>
          </div>
        )}

        {screen === "list" && (
          <div className="flex flex-col gap-2">
            {/* Header */}
            <div className="flex items-center gap-2 bg-white rounded-lg p-2 shadow-sm sticky top-0 z-10">
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => setScreen("filter")}
                size="small"
              >
                Bộ lọc
              </Button>
              <div className="ml-auto text-xs text-gray-500">
                {currentFilter?.date.format("MM/YYYY")} · {employees.length} NV
              </div>
            </div>

            {/* List */}
            {loadingList ? (
              <div className="flex flex-col gap-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg p-3">
                    <Skeleton active paragraph={{ rows: 1 }} />
                  </div>
                ))}
              </div>
            ) : groupedList.length === 0 ? (
              <div className="bg-white rounded-lg p-6">
                <Empty description="Không có nhân viên" />
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {groupedList.map((row) =>
                  row.type === "header" ? (
                    <div
                      key={row.key}
                      style={{
                        background: "#e6f7ff",
                        color: "#0050b3",
                        padding: "8px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 6,
                        marginTop: 6,
                        textTransform: "uppercase",
                      }}
                    >
                      {row.title}
                    </div>
                  ) : (
                    <button
                      key={row.key}
                      onClick={() => handleSelectEmployee(row.emp)}
                      className="bg-white rounded-lg shadow-sm flex items-center text-left"
                      style={{
                        padding: 12,
                        minHeight: 56,
                        border: "1px solid #f0f0f0",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "#e6f4ff",
                          color: "#1677ff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                      >
                        <UserOutlined />
                      </div>
                      <div className="ml-3 flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">
                          {row.emp.fullName}
                          {row.emp.classification && (
                            <Tag
                              color={
                                row.emp.classification.startsWith("A")
                                  ? "green"
                                  : row.emp.classification === "B"
                                  ? "blue"
                                  : "orange"
                              }
                              style={{ marginLeft: 6 }}
                            >
                              {row.emp.classification}
                            </Tag>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {row.emp.code}
                          {row.emp.department?.name
                            ? ` · ${row.emp.department.name}`
                            : ""}
                          {row.emp.kip?.name ? ` · ${row.emp.kip.name}` : ""}
                        </div>
                      </div>
                      <RightOutlined style={{ color: "#bbb", fontSize: 12 }} />
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {screen === "calendar" && selectedEmployee && (
          <div className="flex flex-col gap-2">
            {/* Header */}
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="flex items-start gap-2">
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setScreen("list")}
                  size="small"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-base truncate flex items-center gap-2">
                    {selectedEmployee.fullName}
                    {selectedEmployee.classification && (
                      <Tag
                        color={
                          selectedEmployee.classification.startsWith("A")
                            ? "green"
                            : selectedEmployee.classification === "B"
                            ? "blue"
                            : "orange"
                        }
                      >
                        Xếp loại {selectedEmployee.classification}
                      </Tag>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {selectedEmployee.code}
                    {selectedEmployee.department?.name
                      ? ` · ${selectedEmployee.department.name}`
                      : ""}
                    {selectedEmployee.kip?.name
                      ? ` · ${selectedEmployee.kip.name}`
                      : ""}
                  </div>
                </div>
                <Button
                  icon={<CloseOutlined />}
                  onClick={() => setScreen("list")}
                  size="small"
                />
              </div>

              {/* Month nav */}
              <div className="flex items-center justify-center gap-4 mt-3">
                <Button
                  icon={<LeftOutlined />}
                  shape="circle"
                  onClick={() => changeMonth(-1)}
                />
                <div className="font-semibold text-sm">
                  Tháng {calendarMonth.format("MM/YYYY")}
                </div>
                <Button
                  icon={<RightOutlined />}
                  shape="circle"
                  onClick={() => changeMonth(1)}
                />
              </div>
            </div>

            {/* Calendar grid */}
            <div
              className="bg-white rounded-lg p-2 shadow-sm"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {/* DOW row */}
              <div
                className="grid"
                style={{
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: 4,
                  marginBottom: 4,
                }}
              >
                {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d, i) => (
                  <div
                    key={d}
                    style={{
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: 600,
                      color: i === 6 ? "#ff4d4f" : "#666",
                      padding: "4px 0",
                    }}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {loadingCalendar ? (
                <Skeleton active paragraph={{ rows: 5 }} />
              ) : (
                <div
                  className="grid"
                  style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}
                >
                  {calendarCells.map((cell, idx) => {
                    const colInWeek = idx % 7; // 6 = CN
                    if (!cell) {
                      return (
                        <div
                          key={idx}
                          style={{
                            aspectRatio: "1 / 1",
                            background: "#fafafa",
                            borderRadius: 6,
                          }}
                        />
                      );
                    }
                    const dateKey = cell.date.format("YYYY-MM-DD");
                    const ac = logsByDate.get(dateKey);
                    const isToday = cell.date.isSame(dayjs(), "day");
                    const isSunday = colInWeek === 6;

                    return (
                      <div
                        key={idx}
                        style={{
                          aspectRatio: "1 / 1",
                          background: ac ? ac.color : "#f5f5f5",
                          borderRadius: 6,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          border: isToday
                            ? "2px solid #1677ff"
                            : "1px solid transparent",
                          position: "relative",
                          padding: 2,
                          overflow: "hidden",
                        }}
                        title={ac?.name}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: 2,
                            left: 4,
                            fontSize: 10,
                            color: ac
                              ? "rgba(255,255,255,0.9)"
                              : isSunday
                              ? "#ff4d4f"
                              : "#888",
                            fontWeight: 500,
                          }}
                        >
                          {cell.day}
                        </div>
                        {ac && (
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: "#fff",
                              textShadow: "0 1px 2px rgba(0,0,0,0.25)",
                              marginTop: 6,
                              lineHeight: 1,
                            }}
                          >
                            {ac.code}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary bar */}
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="grid grid-cols-2 gap-2">
                <SummaryPill icon="🟢" label="T.Công" value={summary.total} />
                <SummaryPill icon="🌙" label="Ca 3" value={summary.ca3} />
                <SummaryPill icon="📋" label="Phép 100%" value={summary.phep} />
                <SummaryPill icon="🏥" label="Ốm/BHXH" value={summary.om} />
                <SummaryPill icon="❌" label="K.lương" value={summary.klu} />
                <SummaryPill icon="⚠️" label="Vô lý do" value={summary.vld} />
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function SummaryPill({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number;
}) {
  const dim = value === 0;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        background: dim ? "#fafafa" : "#f0f7ff",
        borderRadius: 8,
        border: "1px solid",
        borderColor: dim ? "#f0f0f0" : "#bae0ff",
        opacity: dim ? 0.6 : 1,
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div className="flex flex-col">
        <span style={{ fontSize: 11, color: "#666", lineHeight: 1.2 }}>
          {label}
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>
          {value}
        </span>
      </div>
    </div>
  );
}
