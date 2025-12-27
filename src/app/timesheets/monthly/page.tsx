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
  Tag,
  Space, // Thêm Space
} from "antd";
import {
  ReloadOutlined,
  FileExcelOutlined,
  LockOutlined,
  UnlockOutlined,
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
  department?: { name: string }; // Thêm thông tin
  kip?: { name: string }; // Thêm thông tin
  timesheets: {
    date: string;
    attendanceCode: AttendanceCode;
  }[];
}

interface Factory {
  id: number;
  name: string;
}

interface Department {
  id: number;
  name: string;
  factory?: Factory;
  isKip: boolean; // <--- Quan trọng: cần trường này
}

interface Kip {
  id: number;
  name: string;
  factoryId: number;
}

export default function MonthlyTimesheetPage() {
  const { data: session } = useSession();

  // --- STATE ---
  const [departments, setDepartments] = useState<Department[]>([]);
  const [kips, setKips] = useState<Kip[]>([]); // <--- Mới thêm
  const [employees, setEmployees] = useState<MonthlyEmployeeData[]>([]);

  // Bộ lọc
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs());
  const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(
    null
  );
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [selectedKipIds, setSelectedKipIds] = useState<number[]>([]); // <--- Mới thêm

  const [loading, setLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // --- CẤU HÌNH NHÀ MÁY 3 ---
  const SHIFT_FACTORY_IDS = [3]; // ID Nhà máy dùng chế độ Kíp

  // 1. Tải dữ liệu ban đầu (Department + Kips)
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

  // --- LOGIC PHÂN QUYỀN (GIỐNG TRANG DAILY) ---

  // A. Lọc danh sách được phép xem
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

  // B. Kiểm tra quyền xem Kíp
  const hasKipPermission = useMemo(() => {
    if (availableDepartments.length === 0) return false;
    return availableDepartments.some((d) => d.isKip === true);
  }, [availableDepartments]);

  // C. Xác định xem Nhà máy hiện tại có dùng chế độ Kíp không
  const isShiftFactory = useMemo(() => {
    if (!selectedFactoryId) return false;
    return SHIFT_FACTORY_IDS.includes(selectedFactoryId);
  }, [selectedFactoryId]);

  // D. Lọc danh sách Nhà máy
  const factories = useMemo(() => {
    const map = new Map();
    availableDepartments.forEach(
      (d) => d.factory && map.set(d.factory.id, d.factory)
    );
    return Array.from(map.values()) as Factory[];
  }, [availableDepartments]);

  // E. Lọc danh sách Phòng ban hiển thị
  const filteredDepartments = useMemo(() => {
    if (!selectedFactoryId) return [];

    let depts = availableDepartments.filter(
      (d) => d.factory?.id === selectedFactoryId
    );

    // Nếu là Nhà máy 3 -> Ẩn các phòng sản xuất (isKip=true) để chọn bên ô Kíp
    if (isShiftFactory) {
      depts = depts.filter((d) => d.isKip === false);
    }
    // Nhà máy 1, 2 -> Hiện tất cả

    return depts;
  }, [availableDepartments, selectedFactoryId, isShiftFactory]);

  // --- LOGIC HIỂN THỊ UI ---
  const showKipSelect = isShiftFactory && !selectedDeptId && hasKipPermission;
  const showDeptSelect = !isShiftFactory || selectedKipIds.length === 0;

  // 2. Tải dữ liệu Bảng công tháng
  const fetchMonthlyData = async () => {
    // Nếu chưa chọn gì cả thì không tải, xóa bảng
    if (!selectedDeptId && selectedKipIds.length === 0) {
      setEmployees([]);
      return;
    }

    setLoading(true);
    try {
      const month = selectedMonth.month() + 1;
      const year = selectedMonth.year();
      const kipIdsParam =
        selectedKipIds.length > 0 ? selectedKipIds.join(",") : "";

      const res = await fetch(
        `/api/timesheets/monthly?departmentId=${
          selectedDeptId || ""
        }&kipIds=${kipIdsParam}&month=${month}&year=${year}`
      );
      const data = await res.json();

      if (data.error) {
        message.error(data.error);
        setEmployees([]);
      } else {
        setEmployees(data);
      }
    } catch (error) {
      message.error("Lỗi tải dữ liệu bảng công");
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyData();
    // Nếu đang chọn phòng ban cụ thể thì check lock, nếu chọn kíp thì thôi (hoặc nâng cấp sau)
    if (selectedDeptId) checkLockStatus();
  }, [selectedDeptId, selectedKipIds, selectedMonth]);

  // Check Lock Status
  const checkLockStatus = async () => {
    if (!selectedDeptId || !selectedMonth) {
      setIsLocked(false);
      return;
    }
    try {
      const m = selectedMonth.month() + 1;
      const y = selectedMonth.year();
      const res = await fetch(
        `/api/timesheets/lock?departmentId=${selectedDeptId}&month=${m}&year=${y}`
      );
      const data = await res.json();
      setIsLocked(data.isLocked);
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle Lock
  const handleToggleLock = async () => {
    if (!selectedDeptId) return;
    try {
      const m = selectedMonth.month() + 1;
      const y = selectedMonth.year();

      const res = await fetch("/api/timesheets/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId: selectedDeptId,
          month: m,
          year: y,
          isLocked: !isLocked,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsLocked(data.isLocked);
        message.success(data.message);
      } else {
        message.error("Không thể thực hiện hành động");
      }
    } catch (e) {
      message.error("Lỗi kết nối");
    }
  };

  // --- CẤU TRÚC CỘT (Cột thông tin nhân viên có thay đổi chút xíu để hiển thị bộ phận) ---
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

    // ... (Phần Cột ngày và Cột tổng hợp GIỮ NGUYÊN như cũ) ...
    // B. Cột ngày (Dynamic)
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
          if (log) {
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
          }
          return null;
        },
      });
    }

    // Helper đếm
    const countCodes = (record: MonthlyEmployeeData, codes: string[]) => {
      return record.timesheets.filter((t) =>
        codes.includes(t.attendanceCode.code)
      ).length;
    };

    const summaryColumns = [
      {
        title: <span style={{ color: "#05FA46", fontSize: 12 }}>T.Công</span>,
        width: 60,
        align: "center",
        fixed: "right",
        className: "bg-green-50",
        render: (_: any, r: MonthlyEmployeeData) => {
          const total = countCodes(r, [
            "X",
            "XD",
            "CT",
            "LĐ",
            "XL",
            "LE",
            "LD",
          ]);
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
          const total = countCodes(r, ["F", "R", "L", "ĐC"]);
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
    ];

    return [...fixedColumns, ...dayColumns, ...summaryColumns];
  }, [selectedMonth, employees]);

  // --- EXPORT EXCEL (Đã cập nhật tiêu đề động) ---
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

    // Dòng 1
    const row1 = worksheet.getCell("A1");
    row1.value = "CÔNG TY CỔ PHẦN SỢI PHÚ BÀI";
    row1.font = { name: "Times New Roman", size: 14, bold: true };

    // Dòng 2
    const row2 = worksheet.getCell("A2");
    row2.value = `BẢNG CHẤM CÔNG THÁNG ${selectedMonth.format("MM/YYYY")}`;
    row2.font = { name: "Times New Roman", size: 16, bold: true };
    row2.alignment = { horizontal: "center" };

    // Dòng 3 (Hiển thị tên Phòng hoặc tên Kíp)
    let deptName = "";
    if (selectedDeptId) {
      deptName = departments.find((d) => d.id === selectedDeptId)?.name || "";
    } else if (selectedKipIds.length > 0) {
      // Lấy tên các kíp đã chọn
      const selectedKipNames = kips
        .filter((k) => selectedKipIds.includes(k.id))
        .map((k) => k.name)
        .join(", ");
      deptName = `Các Kíp: ${selectedKipNames}`;
    }

    const row3 = worksheet.getCell("A3");
    row3.value = `Bộ phận: ${deptName}`;
    row3.font = { name: "Times New Roman", size: 12, bold: true, italic: true };
    row3.alignment = { horizontal: "center" };

    // Header bảng
    const headerRow = ["STT", "Mã NV", "Họ và tên"];
    const daysInMonth = selectedMonth.daysInMonth();
    for (let i = 1; i <= daysInMonth; i++) headerRow.push(`${i}`);
    const summaryHeaders = [
      "T.Công",
      "Ca 3",
      "100%",
      "BHXH",
      "K.Lương",
      "Vô LD",
      "Bão",
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

    // Data
    employees.forEach((emp, index) => {
      const rowData: any[] = [index + 1, emp.code, emp.fullName];
      for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = dayjs(
          `${selectedMonth.year()}-${selectedMonth.month() + 1}-${i}`
        ).format("YYYY-MM-DD");
        const log = emp.timesheets.find((t) => t.date.startsWith(dateStr));
        rowData.push(log ? log.attendanceCode.code : "");
      }

      // Tổng hợp
      const countCodes = (codes: string[]) =>
        emp.timesheets.filter((t) => codes.includes(t.attendanceCode.code))
          .length;
      rowData.push(countCodes(["X", "XD", "CT", "LĐ", "XL", "LE", "LD"]) || "");
      rowData.push(countCodes(["XD", "LD"]) || "");
      rowData.push(countCodes(["F", "R", "L", "ĐC"]) || "");
      rowData.push(countCodes(["Ô", "CÔ", "TS", "DS", "T", "CL"]) || "");
      rowData.push(countCodes(["RO"]) || "");
      rowData.push(countCodes(["O"]) || "");
      rowData.push(countCodes(["B"]) || "");

      const row = worksheet.addRow(rowData);
      row.eachCell((cell, colNumber) => {
        cell.font = { name: "Times New Roman", color: { argb: "FF000000" } };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        if (colNumber === 3) cell.alignment = { horizontal: "left", indent: 1 };
        else cell.alignment = { horizontal: "center" };

        // In đậm mã công
        if (colNumber > 3 && colNumber <= 3 + daysInMonth && cell.value)
          cell.font = { name: "Times New Roman", bold: true };
        // In đậm tổng hợp
        if (colNumber > 3 + daysInMonth && cell.value)
          cell.font = { name: "Times New Roman", bold: true };
      });
    });

    // Footer & Export (Giữ nguyên logic cũ)
    worksheet.getColumn(1).width = 5;
    worksheet.getColumn(2).width = 10;
    worksheet.getColumn(3).width = 25;
    for (let i = 4; i <= 3 + daysInMonth; i++) worksheet.getColumn(i).width = 4;

    const lastRowIdx = worksheet.lastRow ? worksheet.lastRow.number : 0;
    const footerStartRow = lastRowIdx + 2;
    const lastColIndex = 3 + daysInMonth + summaryHeaders.length;

    const dateRow = worksheet.getRow(footerStartRow);
    const dateCell = dateRow.getCell(lastColIndex - 5);
    dateCell.value = "Phú Bài, ngày ...... tháng ...... năm 20......";
    dateCell.font = { name: "Times New Roman", italic: true };
    worksheet.mergeCells(
      footerStartRow,
      lastColIndex - 5,
      footerStartRow,
      lastColIndex
    );
    worksheet.getCell(footerStartRow, lastColIndex - 5).alignment = {
      horizontal: "center",
    };

    worksheet.mergeCells(1, 1, 1, lastColIndex);
    worksheet.mergeCells(2, 1, 2, lastColIndex);
    worksheet.mergeCells(3, 1, 3, lastColIndex);

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
          {/* THÁNG */}
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

          {/* NHÀ MÁY */}
          <div>
            <div style={{ fontWeight: 600 }}>Nhà máy:</div>
            <Select
              style={{ width: 180 }}
              placeholder="Chọn nhà máy"
              value={selectedFactoryId}
              onChange={(val) => {
                setSelectedFactoryId(val);
                setSelectedDeptId(null);
                setSelectedKipIds([]);
                setEmployees([]);
              }}
            >
              {factories.map((f) => (
                <Select.Option key={f.id} value={f.id}>
                  {f.name}
                </Select.Option>
              ))}
            </Select>
          </div>

          {/* CHỌN KÍP (Chỉ hiện nếu Nhà máy 3 + Có quyền + Chưa chọn Phòng) */}
          {showKipSelect && (
            <div>
              <div style={{ fontWeight: 600 }}>Kíp:</div>
              <Select
                mode="multiple"
                style={{ width: 200 }}
                placeholder="Chọn Kíp"
                value={selectedKipIds}
                onChange={(val) => {
                  setSelectedKipIds(val);
                  if (val.length > 0) setSelectedDeptId(null);
                }}
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
          )}

          {/* CHỌN PHÒNG BAN (Ẩn nếu đang chọn Kíp) */}
          {showDeptSelect && (
            <div>
              <div style={{ fontWeight: 600 }}>
                {isShiftFactory ? "Phòng (HC/Khác):" : "Phòng ban:"}
              </div>
              <Select
                style={{ width: 220 }}
                placeholder="Chọn phòng ban"
                value={selectedDeptId}
                onChange={(val) => {
                  setSelectedDeptId(val);
                  if (val) setSelectedKipIds([]);
                }}
                disabled={!selectedFactoryId}
                showSearch
                optionFilterProp="children"
              >
                {filteredDepartments.map((d) => (
                  <Select.Option key={d.id} value={d.id}>
                    {d.name}
                  </Select.Option>
                ))}
              </Select>
            </div>
          )}

          {/* NÚT XEM DỮ LIỆU */}
          <div style={{ marginTop: 20 }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchMonthlyData}
              disabled={!selectedDeptId && selectedKipIds.length === 0}
            >
              Xem
            </Button>
          </div>

          {/* NÚT KHÓA SỔ (Chỉ hiện khi chọn Phòng ban cụ thể - Kíp tạm thời chưa hỗ trợ khóa) */}
          {selectedDeptId && (
            <div style={{ marginTop: 20, marginLeft: 10 }}>
              {["ADMIN", "HR_MANAGER"].includes(session?.user?.role || "") && (
                <Button
                  type={isLocked ? "default" : "primary"}
                  danger={!isLocked}
                  icon={isLocked ? <UnlockOutlined /> : <LockOutlined />}
                  onClick={handleToggleLock}
                >
                  {isLocked ? "Mở khóa sổ" : "Khóa sổ"}
                </Button>
              )}
              {session?.user?.role === "TIMEKEEPER" && isLocked && (
                <Tag color="red" style={{ padding: "5px 10px", fontSize: 14 }}>
                  <LockOutlined /> ĐÃ KHÓA SỔ
                </Tag>
              )}
            </div>
          )}

          {/* NÚT XUẤT EXCEL */}
          <div style={{ marginTop: 20, marginLeft: "auto" }}>
            <Button
              type="primary"
              style={{ background: "#217346" }}
              icon={<FileExcelOutlined />}
              onClick={handleExportExcel}
              disabled={
                (!selectedDeptId && selectedKipIds.length === 0) ||
                employees.length === 0
              }
              loading={loading}
            >
              Xuất Excel
            </Button>
          </div>
        </div>
      </Card>

      {/* BẢNG DỮ LIỆU */}
      {employees.length > 0 ? (
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
      ) : (
        <div style={{ textAlign: "center", padding: 50, color: "#999" }}>
          Vui lòng chọn bộ lọc để xem bảng công.
        </div>
      )}
    </AdminLayout>
  );
}
