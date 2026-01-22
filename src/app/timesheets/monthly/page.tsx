//src/app/timesheets/monthly/page.tsx
"use client";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import React, { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useSession } from "next-auth/react";
import {
  Table,
  Select,
  Button,
  DatePicker,
  message,
  Card,
  Typography,
  Tooltip,
  Input,
} from "antd";
import {
  FileExcelOutlined,
  SearchOutlined,
  FilterOutlined, // [MỚI] Import icon phễu
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";

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
  classification?: string | null; // Dữ liệu xếp loại
}
interface Factory {
  id: number;
  name: string;
}
interface Department {
  id: number;
  code: string;
  name: string;
  factory?: Factory;
  isKip: boolean;
}
interface Kip {
  id: number;
  name: string;
  factoryId: number;
}
interface DeptOption {
  value: string;
  label: string;
  type: "SECTION" | "DEPT";
  code?: string;
  id?: number;
}

export default function MonthlyTimesheetPage() {
  const { data: session } = useSession();

  // --- STATE ---
  const [departments, setDepartments] = useState<Department[]>([]);
  const [kips, setKips] = useState<Kip[]>([]);
  const [employees, setEmployees] = useState<MonthlyEmployeeData[]>([]);

  // Filter State
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs());
  const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(null);
  const [mixedDeptValues, setMixedDeptValues] = useState<string[]>([]);
  const [selectedKipIds, setSelectedKipIds] = useState<number[]>([]);

  // State tìm kiếm theo tên
  const [searchText, setSearchText] = useState("");

  const [loading, setLoading] = useState(false);

  // --- CONFIG ---
  const MATRIX_FACTORY_IDS = [1, 2, 3];

  // 1. Load Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [deptRes, kipRes] = await Promise.all([
          fetch("/api/departments"),
          fetch("/api/kips"),
        ]);
        setDepartments(await deptRes.json());
        setKips(await kipRes.json());
      } catch (error) {
        message.error("Lỗi tải danh mục");
      }
    };
    fetchData();
  }, []);

  // --- LOGIC PERMISSION ---
  const availableDepartments = useMemo(() => {
    if (departments.length === 0 || !session) return [];
    const user = session.user;
    if (["ADMIN", "HR_MANAGER", "LEADER"].includes(user.role))
      return departments;
    if (user.role === "TIMEKEEPER") {
      const allowedIds = user.managedDeptIds || [];
      return departments.filter((d) => allowedIds.includes(d.id));
    }
    return [];
  }, [departments, session]);

  const isMatrix = useMemo(
    () =>
      selectedFactoryId
        ? MATRIX_FACTORY_IDS.includes(selectedFactoryId)
        : false,
    [selectedFactoryId]
  );

  // --- LOGIC DROPDOWN GỘP (Section + Dept) ---
  const mixedDeptOptions = useMemo<DeptOption[]>(() => {
    if (!selectedFactoryId) return [];
    const currentDepts = availableDepartments.filter(
      (d) => d.factory?.id === selectedFactoryId
    );
    const options: DeptOption[] = [];
    const processedSections = new Set<string>();

    currentDepts.forEach((d) => {
      const matrixRegex = new RegExp(`^${selectedFactoryId}([a-zA-Z]+)(\\d+)$`);
      const match = d.code?.match(matrixRegex);

      if (isMatrix && match) {
        const sectionCode = match[1];
        if (!processedSections.has(sectionCode)) {
          const displayName = d.name
            .replace(/(kíp|ca)\s*\d+.*$/gi, "")
            .replace(/-+.*$/gi, "")
            .trim()
            .replace(/-+.*$/gi, "")
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

  // --- RESOLVE ID ---
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
        if (!isNaN(id)) allRealIds.push(id);
      } else if (val.startsWith("SECTION")) {
        const sectionCode = val.split(":")[1];
        availableDepartments.forEach((d) => {
          if (d.factory?.id !== selectedFactoryId) return;
          const regex = new RegExp(
            `^${selectedFactoryId}${sectionCode}(\\d+)$`
          );
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

  // --- HANDLERS ---
  const handleFactoryChange = (val: number) => {
    setSelectedFactoryId(val);
    setMixedDeptValues([]);
    setSelectedKipIds([]);
    setEmployees([]);
  };

  const handleMixedDeptChange = (vals: string[]) => {
    setMixedDeptValues(vals);
  };

  const handleKipChange = (val: number[]) => {
    setSelectedKipIds(val);
  };

  // --- [MỚI] HÀM RESET BỘ LỌC ---
  const handleReset = () => {
    setSelectedFactoryId(null);
    setMixedDeptValues([]);
    setSelectedKipIds([]);
    setSearchText("");
    setEmployees([]); // Xóa dữ liệu bảng
  };

  // --- FETCH DATA ---
  const fetchMonthlyData = async () => {
    if (mixedDeptValues.length === 0 && !searchText.trim()) {
      setEmployees([]);
      return;
    }

    setLoading(true);
    try {
      const month = selectedMonth.month() + 1;
      const year = selectedMonth.year();
      let url = `/api/timesheets/monthly?month=${month}&year=${year}`;

      if (selectedFactoryId) {
        url += `&factoryId=${selectedFactoryId}`;
      }

      const realIds = resolveRealDepartmentIds();
      if (realIds.length > 0) url += `&departmentId=${realIds.join(",")}`;
      if (selectedKipIds.length > 0)
        url += `&kipIds=${selectedKipIds.join(",")}`;

      if (searchText.trim()) {
        url += `&name=${encodeURIComponent(searchText.trim())}`;
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

  // --- TỰ ĐỘNG TẢI (AUTO FETCH) ---
  useEffect(() => {
    let shouldFetch = false;
    if (mixedDeptValues.length > 0) shouldFetch = true;
    if (searchText.trim().length > 0) shouldFetch = true;

    if (shouldFetch) {
      const timer = setTimeout(() => {
        fetchMonthlyData();
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setEmployees([]);
    }
  }, [
    selectedFactoryId,
    selectedMonth,
    mixedDeptValues,
    selectedKipIds,
    searchText,
  ]);

  // --- LOGIC LỌC THEO TÊN (Client Side) ---
  const filteredEmployees = useMemo(() => {
    const lowerText = searchText.toLowerCase();
    return employees.filter((emp) => {
      return (
        emp.fullName.toLowerCase().includes(lowerText) ||
        emp.code.toLowerCase().includes(lowerText)
      );
    });
  }, [employees, searchText]);

  // --- COLUMNS ---
  const columns = useMemo(() => {
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
              {record.kip
                ? `(${record.kip.name})`
                : record.department
                  ? record.department.name
                  : ""}
            </div>
          </div>
        ),
      },
    ];
    const daysInMonth = selectedMonth.daysInMonth();
    const dayColumns = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const currentDay = dayjs(
        `${selectedMonth.year()}-${selectedMonth.month() + 1}-${i}`
      );
      const isWeekend = currentDay.day() === 0;
      const dateStr = currentDay.format("YYYY-MM-DD");
      dayColumns.push({
        title: (
          <div
            style={{
              textAlign: "center",
              color: isWeekend ? "#ff4d4f" : "inherit",
            }}
          >
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
          if (log)
            return (
              <Tooltip title={log.attendanceCode.name}>
                <div
                  style={{
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
          return null;
        },
      });
    }

    const countCodes = (
      record: MonthlyEmployeeData,
      fullCodes: string[],
      halfCodes: string[] = []
    ) => {
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
        width: 60,
        align: "center",
        fixed: "right",
        className: "bg-green-50",
        render: (_: any, r: MonthlyEmployeeData) => {
          const total = countCodes(
            r,
            ["+", "XD", "CT", "LĐ", "XL", "LE", "LD"],
            ["X/2"]
          );
          return total > 0 ? <b style={{ color: "#16a34a" }}>{total}</b> : "-";
        },
      },
      {
        title: <span style={{ fontSize: 12 }}>Ca 3</span>,
        width: 50,
        align: "center",
        fixed: "right",
        render: (_: any, r: MonthlyEmployeeData) => {
          const total = countCodes(r, ["XD", "LD"]);
          return total > 0 ? <b>{total}</b> : "-";
        },
      },
      {
        title: <span style={{ color: "#ff78cf", fontSize: 12 }}>100%</span>,
        width: 50,
        align: "center",
        fixed: "right",
        render: (_: any, r: MonthlyEmployeeData) => {
          const total = countCodes(r, ["F", "R", "L"]);
          return total > 0 ? <b style={{ color: "#2563eb" }}>{total}</b> : "-";
        },
      },
      {
        title: <span style={{ color: "#F8FF3B", fontSize: 12 }}>BHXH</span>,
        width: 50,
        align: "center",
        fixed: "right",
        render: (_: any, r: MonthlyEmployeeData) => {
          const total = countCodes(r, ["Ô", "CÔ", "TS", "DS", "T", "CL"]);
          return total > 0 ? <b style={{ color: "#ca8a04" }}>{total}</b> : "-";
        },
      },
      {
        title: <span style={{ color: "#FF4545", fontSize: 12 }}>K.Lương</span>,
        width: 60,
        align: "center",
        fixed: "right",
        render: (_: any, r: MonthlyEmployeeData) => {
          const total = countCodes(r, ["RO"]);
          return total > 0 ? <b style={{ color: "#dc2626" }}>{total}</b> : "-";
        },
      },
      {
        title: <span style={{ fontSize: 12 }}>Vô LD</span>,
        width: 50,
        align: "center",
        fixed: "right",
        render: (_: any, r: MonthlyEmployeeData) => {
          const total = countCodes(r, ["O"]);
          return total > 0 ? (
            <b style={{ color: "red", textDecoration: "underline" }}>{total}</b>
          ) : (
            "-"
          );
        },
      },
      {
        title: <span style={{ fontSize: 12 }}>Bão</span>,
        width: 50,
        align: "center",
        fixed: "right",
        render: (_: any, r: MonthlyEmployeeData) => {
          const total = countCodes(r, ["B"]);
          return total > 0 ? <b>{total}</b> : "-";
        },
      },
      {
        title: <span style={{ fontSize: 12 }}>X.Loại</span>,
        width: 60,
        align: "center",
        fixed: "right",
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
  }, [selectedMonth, employees]);

  // --- EXPORT EXCEL ---
  const handleExportExcel = async () => {
    if (employees.length === 0) return;
    setLoading(true);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("BangCong");
    worksheet.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };

    const row1 = worksheet.getCell("A1");
    row1.value = "CÔNG TY CỔ PHẦN SỢI PHÚ BÀI";
    row1.font = { name: "Times New Roman", size: 14, bold: true };

    const row2 = worksheet.getCell("A2");
    row2.value = `BẢNG CHẤM CÔNG THÁNG ${selectedMonth.format("MM/YYYY")}`;
    row2.font = { name: "Times New Roman", size: 16, bold: true };
    row2.alignment = { horizontal: "center" };

    const currentFactoryName =
      availableDepartments.find((d) => d.factory?.id === selectedFactoryId)
        ?.factory?.name || "";
    const row3 = worksheet.getCell("A3");
    row3.value = currentFactoryName.toUpperCase();
    row3.font = { name: "Times New Roman", size: 14, bold: true };
    row3.alignment = { horizontal: "center" };

    let deptName = "";
    if (mixedDeptValues.length > 0) {
      const selectedLabels = mixedDeptValues
        .map((val) => {
          const found = mixedDeptOptions.find((o) => o.value === val);
          return found ? found.label : "";
        })
        .filter(Boolean)
        .join(", ");

      let kipSuffix = "";
      if (selectedKipIds.length > 0) {
        const kNames = kips
          .filter((k) => selectedKipIds.includes(k.id))
          .map((k) => k.name)
          .join(", ");
        kipSuffix = ` - (Kíp: ${kNames})`;
      }
      deptName = `${selectedLabels}${kipSuffix}`;
    }

    const row4 = worksheet.getCell("A4");
    row4.value = `Bộ phận: ${deptName}`;
    row4.font = { name: "Times New Roman", size: 12, bold: true, italic: true };
    row4.alignment = { horizontal: "center" };

    const headerRow = ["STT", "Họ và tên"];
    const daysInMonth = selectedMonth.daysInMonth();
    for (let i = 1; i <= daysInMonth; i++) headerRow.push(`${i}`);

    const summaryHeaders = [
      "T.Công",
      "Ca 3",
      "100%",
      "BHXH",
      "K.Lương",
      "Vô LD",
      "L.Bão",
      "X.Loại",
    ];
    headerRow.push(...summaryHeaders);

    const headerRowExcel = worksheet.addRow(headerRow);
    headerRowExcel.eachCell((cell) => {
      cell.font = { name: "Times New Roman", bold: true };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
    });

    employees.forEach((emp, index) => {
      const rowData: any[] = [index + 1, emp.fullName];
      for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = dayjs(
          `${selectedMonth.year()}-${selectedMonth.month() + 1}-${i}`
        ).format("YYYY-MM-DD");
        const log = emp.timesheets.find((t) => t.date.startsWith(dateStr));
        rowData.push(log ? log.attendanceCode.code : "");
      }

      const countCodes = (fullCodes: string[], halfCodes: string[] = []) =>
        emp.timesheets.reduce((total, t) => {
          const code = t.attendanceCode.code;
          if (fullCodes.includes(code)) return total + 1;
          if (halfCodes.includes(code)) return total + 0.5;
          return total;
        }, 0);

      rowData.push(
        countCodes(["+", "XD", "CT", "LĐ", "XL", "LE", "LD"], ["X/2"]) || ""
      );
      rowData.push(countCodes(["XD", "LD"]) || "");
      rowData.push(countCodes(["F", "R", "L", "ĐC"]) || "");
      rowData.push(countCodes(["Ô", "CÔ", "TS", "DS", "T", "CL"]) || "");
      rowData.push(countCodes(["RO"]) || "");
      rowData.push(countCodes(["O"]) || "");
      rowData.push(countCodes(["B"]) || "");
      rowData.push(emp.classification || "");

      const row = worksheet.addRow(rowData);
      row.eachCell((cell, colNumber) => {
        cell.font = { name: "Times New Roman", color: { argb: "FF000000" } };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        if (colNumber === 2) cell.alignment = { horizontal: "left", indent: 1 };
        else cell.alignment = { horizontal: "center" };
        if (colNumber > 2 + daysInMonth && cell.value)
          cell.font = { name: "Times New Roman", bold: true };
      });
    });

    worksheet.getColumn(1).width = 5;
    worksheet.getColumn(2).width = 25;
    for (let i = 3; i <= 2 + daysInMonth; i++) worksheet.getColumn(i).width = 4;

    const totalCols = 2 + daysInMonth + summaryHeaders.length;
    const lastRowIdx = worksheet.lastRow ? worksheet.lastRow.number : 0;

    worksheet.mergeCells(1, 1, 1, totalCols);
    worksheet.mergeCells(2, 1, 2, totalCols);
    worksheet.mergeCells(3, 1, 3, totalCols);
    worksheet.mergeCells(4, 1, 4, totalCols);

    const dateRowIndex = lastRowIdx + 2;
    const dateStartCol = Math.floor(totalCols * 0.6);
    worksheet.mergeCells(dateRowIndex, dateStartCol, dateRowIndex, totalCols);
    const dateCell = worksheet.getCell(dateRowIndex, dateStartCol);
    dateCell.value = "Phú Bài, ngày ...... tháng ...... năm 20......";
    dateCell.font = { name: "Times New Roman", italic: true, size: 12 };
    dateCell.alignment = { horizontal: "center" };

    const signTitleRowIndex = dateRowIndex + 1;
    const sectionSize = Math.floor(totalCols / 3);

    worksheet.mergeCells(signTitleRowIndex, 1, signTitleRowIndex, sectionSize);
    const cell1 = worksheet.getCell(signTitleRowIndex, 1);
    cell1.value = "NGƯỜI CHẤM CÔNG";
    cell1.font = { name: "Times New Roman", bold: true, size: 12 };
    cell1.alignment = { horizontal: "center" };

    worksheet.mergeCells(
      signTitleRowIndex,
      sectionSize + 1,
      signTitleRowIndex,
      sectionSize * 2
    );
    const cell2 = worksheet.getCell(signTitleRowIndex, sectionSize + 1);
    cell2.value = "PHỤ TRÁCH ĐƠN VỊ";
    cell2.font = { name: "Times New Roman", bold: true, size: 12 };
    cell2.alignment = { horizontal: "center" };

    worksheet.mergeCells(
      signTitleRowIndex,
      sectionSize * 2 + 1,
      signTitleRowIndex,
      totalCols
    );
    const cell3 = worksheet.getCell(signTitleRowIndex, sectionSize * 2 + 1);
    cell3.value = "CÁN BỘ KIỂM TRA";
    cell3.font = { name: "Times New Roman", bold: true, size: 12 };
    cell3.alignment = { horizontal: "center" };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(
      blob,
      `BangCong_${selectedMonth.format("MM-YYYY")}_${deptName}.xlsx`
    );
    setLoading(false);
  };

  return (
    <AdminLayout>
      <div style={{ marginBottom: 24 }}>
        <Title level={3}>Tổng hợp chấm công tháng</Title>
      </div>
      <Card style={{ marginBottom: 16 }} size="small">
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 600 }}>Tháng:</div>
            <DatePicker
              picker="month"
              value={selectedMonth}
              onChange={(val) => val && setSelectedMonth(val)}
              allowClear={false}
              format="MM/YYYY"
              style={{ width: 120 }}
            />
          </div>

          <div>
            <div style={{ fontWeight: 600 }}>Nhà máy:</div>
            <Select
              style={{ width: 180 }}
              placeholder="Chọn nhà máy"
              value={selectedFactoryId}
              onChange={handleFactoryChange}
            >
              {availableDepartments
                .reduce((acc: Factory[], curr) => {
                  if (
                    curr.factory &&
                    !acc.find((f) => f.id === curr.factory!.id)
                  )
                    acc.push(curr.factory!);
                  return acc;
                }, [])
                .map((f) => (
                  <Select.Option key={f.id} value={f.id}>
                    {f.name}
                  </Select.Option>
                ))}
            </Select>
          </div>

          <div>
            <div style={{ fontWeight: 600 }}>
              {isMatrix ? "Chọn Tổ / Bộ phận:" : "Phòng ban:"}
            </div>
            <Select
              mode="multiple"
              style={{ width: 300 }}
              placeholder="Chọn..."
              value={mixedDeptValues}
              onChange={handleMixedDeptChange}
              allowClear
              disabled={!selectedFactoryId}
              showSearch
              optionFilterProp="children"
              maxTagCount="responsive"
            >
              {mixedDeptOptions.map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
          </div>

          <div>
            <div style={{ fontWeight: 600 }}>
              {isMatrix ? "Lọc theo Kíp:" : "Chọn Kíp:"}
            </div>
            <Select
              mode="multiple"
              style={{ width: 200 }}
              placeholder="Chọn Kíp"
              value={selectedKipIds}
              onChange={handleKipChange}
              allowClear
              disabled={!selectedFactoryId}
            >
              {kips
                .filter((k) => k.factoryId === selectedFactoryId)
                .map((k) => (
                  <Select.Option key={k.id} value={k.id}>
                    {k.name}
                  </Select.Option>
                ))}
            </Select>
          </div>

          <div>
            <div style={{ fontWeight: 600 }}>Tìm tên / Mã NV:</div>
            <Input
              placeholder="Nhập tên..."
              prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: 180 }}
            />
          </div>

          {/* [MỚI] NÚT XÓA LỌC */}
          <div style={{ marginTop: 20 }}>
            <Button
              danger // Màu đỏ
              icon={<FilterOutlined />}
              onClick={handleReset}
              // Chỉ hiện khi có điều kiện lọc (Nhà máy hoặc Tìm tên)
              disabled={!selectedFactoryId && !searchText}
            >
              Xóa lọc
            </Button>
          </div>

          <div style={{ marginTop: 20, marginLeft: "auto" }}>
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
        </div>
      </Card>

      <Table
        bordered
        dataSource={filteredEmployees}
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