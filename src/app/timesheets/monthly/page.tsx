// src/app/timesheets/monthly/page.tsx

"use client";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import React, { useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import {
  Table,
  Button,
  message,
  Typography,
  Tooltip,
} from "antd";
import { FileExcelOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

// [QUAN TRỌNG] Import Component lọc dùng chung
import CommonFilter, { FilterResult } from "@/components/CommonFilter";

const { Title } = Typography;

// --- INTERFACES ---
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
  department?: { name: string };
  kip?: { name: string };
  timesheets: { date: string; attendanceCode: AttendanceCode }[];
  classification?: string | null;
}

export default function MonthlyTimesheetPage() {
  // --- STATE ---
  const [employees, setEmployees] = useState<MonthlyEmployeeData[]>([]);
  const [loading, setLoading] = useState(false);

  // State lưu bộ lọc hiện tại (để dùng cho Excel và render cột ngày)
  const [currentFilter, setCurrentFilter] = useState<FilterResult | null>(null);

  // --- 1. FETCH DATA (Gọi khi CommonFilter thay đổi) ---
  const fetchMonthlyData = async (filter: FilterResult) => {
    // Nếu chưa chọn phòng ban -> Xóa bảng
    if (!filter.realDepartmentIds || filter.realDepartmentIds.length === 0) {
      setEmployees([]);
      return;
    }

    setLoading(true);
    try {
      const month = filter.date.month() + 1;
      const year = filter.date.year();

      let url = `/api/timesheets/monthly?month=${month}&year=${year}`;

      if (filter.factoryId) {
        url += `&factoryId=${filter.factoryId}`;
      }

      // Gửi danh sách ID phòng đã giải mã từ CommonFilter
      url += `&departmentId=${filter.realDepartmentIds.join(",")}`;

      // Gửi danh sách Kíp (nếu có)
      if (filter.selectedKipIds.length > 0) {
        url += `&kipIds=${filter.selectedKipIds.join(",")}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        message.error(data.error);
        setEmployees([]);
      } else {
        setEmployees(data);
      }
    } catch (error) {
      message.error("Lỗi tải dữ liệu");
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  // Callback nhận từ Component con
  const handleFilterChange = (result: FilterResult) => {
    setCurrentFilter(result); // Lưu lại để dùng cho Columns và Excel
    fetchMonthlyData(result);
  };

  // --- 2. COLUMNS DEFINITION ---
  const columns = useMemo(() => {
    // Nếu chưa có filter thì dùng tháng hiện tại làm mẫu
    const viewDate = currentFilter?.date || dayjs();
    const daysInMonth = viewDate.daysInMonth();

    const fixedColumns: any[] = [
      {
        title: "STT",
        key: "index",
        width: 50,
        fixed: "left",
        align: "center",
        render: (_: any, __: any, index: number) => (
          <span style={{ color: "#888", fontWeight: 600 }}>{index + 1}</span>
        ),
      },
      {
        title: "Họ tên",
        dataIndex: "fullName",
        width: 160,
        fixed: "left",
        render: (text: string, record: MonthlyEmployeeData) => (
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            <div style={{ fontSize: 11, color: "#888" }}>
              {record.kip ? `(${record.kip.name})` : record.department?.name || ""}
            </div>
          </div>
        ),
      },
    ];

    const dayColumns = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const currentDay = dayjs(`${viewDate.year()}-${viewDate.month() + 1}-${i}`);
      const isWeekend = currentDay.day() === 0;
      const dateStr = currentDay.format("YYYY-MM-DD");

      dayColumns.push({
        title: (
          <div style={{ textAlign: "center", color: isWeekend ? "#ff4d4f" : "inherit" }}>
            <div>{i}</div>
            <div style={{ fontSize: 10, color: "#999" }}>
              {["CN", "T2", "T3", "T4", "T5", "T6", "T7"][currentDay.day()]}
            </div>
          </div>
        ),
        width: 40,
        align: "center",
        render: (_: any, record: MonthlyEmployeeData) => {
          const log = record.timesheets.find((t) => t.date.startsWith(dateStr));
          if (log) {
            return (
              <Tooltip title={log.attendanceCode.name}>
                <div style={{
                  background: log.attendanceCode.color,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: "bold",
                  borderRadius: 2,
                  height: 22,
                  lineHeight: "22px",
                  cursor: "default",
                }}
                >
                  {log.attendanceCode.code}
                </div>
              </Tooltip>
            );
          }
          return null;
        },
      });
    }

    const countCodes = (record: MonthlyEmployeeData, fullCodes: string[], halfCodes: string[] = []) => {
      return record.timesheets.reduce((total, t) => {
        const code = t.attendanceCode.code;
        if (fullCodes.includes(code)) return total + 1;
        if (halfCodes.includes(code)) return total + 0.5;
        return total;
      }, 0);
    };

    const summaryColumns = [
      {
        title: <span style={{ color: "#05FA46", fontSize: 12 }}>T.Công</span>,
        width: 60, align: "center", fixed: "right", className: "bg-green-50",
        render: (_: any, r: MonthlyEmployeeData) => {
          const total = countCodes(r, ["+", "XD", "CT", "LĐ", "XL", "LE", "LD"], ["X/2"]);
          return total > 0 ? <b style={{ color: "#16a34a" }}>{total}</b> : "-";
        },
      },
      {
        title: <span style={{ fontSize: 12 }}>Ca 3</span>, width: 50, align: "center", fixed: "right",
        render: (_: any, r: MonthlyEmployeeData) => {
          const total = countCodes(r, ["XD", "LD"]);
          return total > 0 ? <b>{total}</b> : "-";
        },
      },
      {
        title: <span style={{ color: "#ff78cf", fontSize: 12 }}>100%</span>, width: 50, align: "center", fixed: "right",
        render: (_: any, r: MonthlyEmployeeData) => {
          const total = countCodes(r, ["F", "R", "L"]);
          return total > 0 ? <b style={{ color: "#2563eb" }}>{total}</b> : "-";
        },
      },
      {
        title: <span style={{ color: "#F8FF3B", fontSize: 12 }}>BHXH</span>, width: 50, align: "center", fixed: "right",
        render: (_: any, r: MonthlyEmployeeData) => {
          const total = countCodes(r, ["Ô", "CÔ", "TS", "DS", "T", "CL"]);
          return total > 0 ? <b style={{ color: "#ca8a04" }}>{total}</b> : "-";
        },
      },
      {
        title: <span style={{ color: "#FF4545", fontSize: 12 }}>K.Lương</span>, width: 60, align: "center", fixed: "right",
        render: (_: any, r: MonthlyEmployeeData) => {
          const total = countCodes(r, ["RO"]);
          return total > 0 ? <b style={{ color: "#dc2626" }}>{total}</b> : "-";
        },
      },
      {
        title: <span style={{ fontSize: 12 }}>Vô LD</span>, width: 50, align: "center", fixed: "right",
        render: (_: any, r: MonthlyEmployeeData) => {
          const total = countCodes(r, ["O"]);
          return total > 0 ? <b style={{ color: "red", textDecoration: "underline" }}>{total}</b> : "-";
        },
      },
      {
        title: <span style={{ fontSize: 12 }}>Bão</span>, width: 50, align: "center", fixed: "right",
        render: (_: any, r: MonthlyEmployeeData) => {
          const total = countCodes(r, ["B"]);
          return total > 0 ? <b>{total}</b> : "-";
        },
      },
      {
        title: <span style={{ fontSize: 12 }}>X.Loại</span>, width: 60, align: "center", fixed: "right",
        render: (_: any, r: MonthlyEmployeeData) => {
          const grade = r.classification;
          let color = "#000";
          if (grade === "A" || grade === "A+") color = "#16a34a";
          if (grade === "B") color = "#2563eb";
          if (grade === "C") color = "#ca8a04";
          return <b style={{ color: color, fontSize: 13 }}>{grade || "-"}</b>;
        },
      },
    ];
    return [...fixedColumns, ...dayColumns, ...summaryColumns];
  }, [currentFilter, employees]); // Phụ thuộc vào currentFilter để vẽ lại cột ngày

  // --- 3. EXPORT EXCEL ---
  const handleExportExcel = async () => {
    if (employees.length === 0 || !currentFilter) return;
    setLoading(true);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("BangCong");
    worksheet.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

    // --- Header ---
    const row1 = worksheet.getCell("A1");
    row1.value = "CÔNG TY CỔ PHẦN SỢI PHÚ BÀI";
    row1.font = { name: "Times New Roman", size: 14, bold: true };

    const row2 = worksheet.getCell("A2");
    row2.value = `BẢNG CHẤM CÔNG THÁNG ${currentFilter.date.format("MM/YYYY")}`;
    row2.font = { name: "Times New Roman", size: 16, bold: true };
    row2.alignment = { horizontal: "center" };

    // Tên bộ phận (Lấy từ dữ liệu nhân viên đầu tiên để hiển thị đại diện)
    // Hoặc hiển thị generic vì CommonFilter đã ẩn logic tên phòng
    const deptDisplayName = employees.length > 0
      ? (employees[0].kip ? `Kíp: ${employees[0].kip.name}` : `Bộ phận: ${employees[0].department?.name || 'Tổng hợp'}`)
      : "Tổng hợp";

    const row3 = worksheet.getCell("A3");
    row3.value = deptDisplayName.toUpperCase();
    row3.font = { name: "Times New Roman", size: 14, bold: true };
    row3.alignment = { horizontal: "center" };

    // --- Table Header ---
    const headerRow = ["STT", "Họ và tên"];
    const daysInMonth = currentFilter.date.daysInMonth();
    for (let i = 1; i <= daysInMonth; i++) headerRow.push(`${i}`);
    headerRow.push("T.Công", "Ca 3", "100%", "BHXH", "K.Lương", "Vô LD", "L.Bão", "X.Loại");

    const headerRowExcel = worksheet.addRow(headerRow);
    headerRowExcel.eachCell((cell) => {
      cell.font = { name: "Times New Roman", bold: true };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
    });

    // --- Table Data ---
    employees.forEach((emp, index) => {
      const rowData: any[] = [index + 1, emp.fullName];
      for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = dayjs(`${currentFilter.date.year()}-${currentFilter.date.month() + 1}-${i}`).format("YYYY-MM-DD");
        const log = emp.timesheets.find((t) => t.date.startsWith(dateStr));
        rowData.push(log ? log.attendanceCode.code : "");
      }

      const count = (codes: string[]) => emp.timesheets.reduce((acc, t) => codes.includes(t.attendanceCode.code) ? acc + 1 : acc, 0);
      // (Simplified count logic for brevity in this example, use full logic in prod)
      const countComplex = (full: string[], half: string[]) => emp.timesheets.reduce((acc, t) => {
        if (full.includes(t.attendanceCode.code)) return acc + 1;
        if (half.includes(t.attendanceCode.code)) return acc + 0.5;
        return acc;
      }, 0);

      rowData.push(countComplex(["+", "XD", "CT", "LĐ", "XL", "LE", "LD"], ["X/2"]) || "");
      rowData.push(count(["XD", "LD"]) || "");
      rowData.push(count(["F", "R", "L", "ĐC"]) || "");
      rowData.push(count(["Ô", "CÔ", "TS", "DS", "T", "CL"]) || "");
      rowData.push(count(["RO"]) || "");
      rowData.push(count(["O"]) || "");
      rowData.push(count(["B"]) || "");
      rowData.push(emp.classification || "");

      const row = worksheet.addRow(rowData);
      row.eachCell((cell, colNumber) => {
        cell.font = { name: "Times New Roman" };
        cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
        if (colNumber === 2) cell.alignment = { horizontal: "left", indent: 1 };
        else cell.alignment = { horizontal: "center" };
      });
    });

    // --- Footer ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `BangCong_${currentFilter.date.format("MM-YYYY")}.xlsx`);
    setLoading(false);
  };

  return (
    <AdminLayout>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Tổng hợp chấm công tháng</Title>
        <Button
          type="primary"
          style={{ background: "#217346" }}
          icon={<FileExcelOutlined />}
          onClick={handleExportExcel}
          disabled={employees.length === 0}
          loading={loading}
        >
          Xuất Excel
        </Button>
      </div>

      {/* --- SỬ DỤNG COMPONENT LỌC DÙNG CHUNG --- */}
      <CommonFilter
        dateMode="month" // Chế độ Tháng
        onFilterChange={handleFilterChange}
      />

      <Table
        bordered
        dataSource={employees}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        scroll={{ x: "max-content", y: 600 }}
        size="small"
      />
    </AdminLayout>
  );
}