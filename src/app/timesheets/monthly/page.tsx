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

// Interface cho dữ liệu trả về từ API
interface MonthlyEmployeeData {
  id: number;
  code: string;
  fullName: string;
  timesheets: {
    date: string; // Ngày chấm
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
}

export default function MonthlyTimesheetPage() {
  // --- STATE ---
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<MonthlyEmployeeData[]>([]);

  // Bộ lọc
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs()); // Mặc định tháng hiện tại
  const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(
    null
  );
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Thêm state để lưu trạng thái khóa
  const [isLocked, setIsLocked] = useState(false);
  const { data: session } = useSession(); // Lấy session để check quyền hiển thị nút

  // 1. Hàm kiểm tra trạng thái khóa (Gọi khi department/month thay đổi)
  const checkLockStatus = async () => {
    if (!selectedDeptId || !selectedMonth) return;
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

  // 1. Tải danh sách phòng ban
  useEffect(() => {
    fetch("/api/departments")
      .then((res) => res.json())
      .then((data) => setDepartments(data))
      .catch(() => message.error("Lỗi tải danh mục"));
  }, []);

  // Logic lọc Nhà máy -> Phòng ban (Giống trang Daily)
  const factories = useMemo(() => {
    const map = new Map();
    departments.forEach((d) => d.factory && map.set(d.factory.id, d.factory));
    return Array.from(map.values()) as Factory[];
  }, [departments]);

  const filteredDepartments = useMemo(() => {
    if (!selectedFactoryId) return [];
    return departments.filter((d) => d.factory?.id === selectedFactoryId);
  }, [departments, selectedFactoryId]);

  // 2. Tải dữ liệu Bảng công tháng
  const fetchMonthlyData = async () => {
    if (!selectedDeptId) return;

    setLoading(true);
    try {
      const month = selectedMonth.month() + 1; // dayjs month từ 0-11
      const year = selectedMonth.year();

      const res = await fetch(
        `/api/timesheets/monthly?departmentId=${selectedDeptId}&month=${month}&year=${year}`
      );
      const data = await res.json();
      setEmployees(data);
    } catch (error) {
      message.error("Lỗi tải dữ liệu bảng công");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyData();
    checkLockStatus(); // <-- Thêm dòng này
  }, [selectedDeptId, selectedMonth]);

  // 2. Hàm xử lý khi bấm nút Khóa/Mở
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
          isLocked: !isLocked, // Đảo ngược trạng thái hiện tại
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

  // 3. TẠO CẤU TRÚC CỘT (Đã cập nhật theo yêu cầu thống kê chi tiết)
  const columns = useMemo(() => {
    // A. Cột cố định bên trái
    const fixedColumns: any[] = [
      {
        title: "STT",
        key: "index",
        width: 50,
        fixed: "left",
        align: "center",
        // render nhận vào (text, record, index)
        render: (_: any, __: any, index: number) => (
          <span style={{ color: "#888", fontWeight: 600 }}>{index + 1}</span>
        ),
      },
      {
        title: "Họ tên",
        dataIndex: "fullName",
        width: 160,
        fixed: "left",
        ellipsis: true,
      },
    ];

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

    // C. Cột Tổng hợp (THEO YÊU CẦU MỚI)
    // Tôi tạo một hàm helper nhỏ để đếm cho gọn code
    const countCodes = (record: MonthlyEmployeeData, codes: string[]) => {
      return record.timesheets.filter((t) =>
        codes.includes(t.attendanceCode.code)
      ).length;
    };

    const summaryColumns = [
      {
        title: <span style={{ color: "#05FA46", fontSize: 12 }}>T.Công</span>, // Tổng công thực tế
        width: 60,
        align: "center",
        fixed: "right",
        className: "bg-green-50", // Tailwind class cho nền hơi xanh nhẹ
        render: (_: any, r: MonthlyEmployeeData) => {
          // X, XD, CT, LĐ, XL, LE, LD (Tất cả các loại đi làm)
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
          // XD, LD (Tính cả làm ca 3 ngày lễ)
          const total = countCodes(r, ["XD", "LD"]);
          return total > 0 ? <b>{total}</b> : "-";
        },
      },
      {
        title: <span style={{ color: "#ff78cf", fontSize: 12 }}>100%</span>, // Nghỉ hưởng 100% lương
        width: 50,
        align: "center",
        fixed: "right",
        render: (_: any, r: MonthlyEmployeeData) => {
          // F, R, L, ĐC
          const total = countCodes(r, ["F", "R", "L", "ĐC"]);
          return total > 0 ? <b style={{ color: "#2563eb" }}>{total}</b> : "-";
        },
      },
      {
        title: <span style={{ color: "#F8FF3B", fontSize: 12 }}>BHXH</span>, // Ốm, Thai sản...
        width: 50,
        align: "center",
        fixed: "right",
        render: (_: any, r: MonthlyEmployeeData) => {
          // Ô, CÔ, TS, DS, T, CL
          const total = countCodes(r, ["Ô", "CÔ", "TS", "DS", "T", "CL"]);
          return total > 0 ? <b style={{ color: "#ca8a04" }}>{total}</b> : "-";
        },
      },
      {
        title: <span style={{ color: "#FF4545", fontSize: 12 }}>K.Lương</span>, // Không lương
        width: 60,
        align: "center",
        fixed: "right",
        render: (_: any, r: MonthlyEmployeeData) => {
          // RO
          const total = countCodes(r, ["RO"]);
          return total > 0 ? <b style={{ color: "#dc2626" }}>{total}</b> : "-";
        },
      },
      {
        title: <span style={{ fontSize: 12 }}>Vô LD</span>, // Vô lý do
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
        title: <span style={{ fontSize: 12 }}>Bão</span>, // Bão lụt
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
  }, [selectedMonth, employees]); // Cấu trúc cột thay đổi khi thay đổi tháng

  // 2. THÊM HÀM XỬ LÝ XUẤT EXCEL
  const handleExportExcel = async () => {
    if (employees.length === 0) return;
    setLoading(true); // Bật loading cho chuyên nghiệp

    // A. KHỞI TẠO WORKBOOK
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("BangCong");

    // Thiết lập in ấn: Ngang, A4
    worksheet.pageSetup = {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true, // Tự co cho vừa trang
      fitToWidth: 1,
      fitToHeight: 0, // 0 nghĩa là chiều dọc tự động nhiều trang
    };

    // B. TẠO HEADER (TIÊU ĐỀ)
    // Dòng 1: Tên công ty
    // worksheet.mergeCells("A1:L1"); <--- Xóa hoặc comment dòng này
    const row1 = worksheet.getCell("A1");
    row1.value = "CÔNG TY CỔ PHẦN SỢI PHÚ BÀI";
    row1.font = { name: "Times New Roman", size: 14, bold: true };
    row1.alignment = { horizontal: "left" };

    // Dòng 2: Tiêu đề Bảng chấm công
    // worksheet.mergeCells("A2:AC2"); <--- Xóa hoặc comment dòng này
    const row2 = worksheet.getCell("A2");
    row2.value = `BẢNG CHẤM CÔNG THÁNG ${selectedMonth.format("MM/YYYY")}`;
    row2.font = { name: "Times New Roman", size: 16, bold: true };
    row2.alignment = { horizontal: "center" };

    // Dòng 3: Tên phòng ban
    const deptName =
      departments.find((d) => d.id === selectedDeptId)?.name || "";
    // worksheet.mergeCells("A3:AC3"); <--- Xóa hoặc comment dòng này
    const row3 = worksheet.getCell("A3");
    row3.value = `Bộ phận: ${deptName}`;
    row3.font = { name: "Times New Roman", size: 12, bold: true, italic: true };
    row3.alignment = { horizontal: "center" };

    // C. TẠO HEADER BẢNG DỮ LIỆU (Dòng 4)
    // Các cột tĩnh
    const headerRow = ["STT", "Mã NV", "Họ và tên"];
    const daysInMonth = selectedMonth.daysInMonth();

    // Các cột ngày (1 -> 30)
    for (let i = 1; i <= daysInMonth; i++) {
      headerRow.push(`${i}`);
    }

    // Các cột tổng hợp
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

    // Add dòng header vào Excel
    const headerRowExcel = worksheet.addRow(headerRow);

    // Style cho dòng Header (Chữ đậm, căn giữa, viền)
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
        fgColor: { argb: "FFE0E0E0" }, // Màu xám nhẹ
      };
    });

    // D. ĐỔ DỮ LIỆU NHÂN VIÊN
    employees.forEach((emp, index) => {
      // ... (Đoạn tạo rowData giữ nguyên) ...
      const rowData: any[] = [
        index + 1, // STT
        emp.code,
        emp.fullName,
      ];

      // 1. Duyệt qua từng ngày
      for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = dayjs(
          `${selectedMonth.year()}-${selectedMonth.month() + 1}-${i}`
        ).format("YYYY-MM-DD");
        const log = emp.timesheets.find((t) => t.date.startsWith(dateStr));
        rowData.push(log ? log.attendanceCode.code : "");
      }

      // 2. Tính toán lại Tổng hợp (Logic giống hệt Frontend)
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

      // Thêm dòng vào Excel
      const row = worksheet.addRow(rowData);

      // --- SỬA ĐỔI Ở ĐÂY: FORMAT CHO TỪNG Ô ---
      row.eachCell((cell, colNumber) => {
        // 1. Font chữ chung: Times New Roman, màu đen mặc định
        cell.font = { name: "Times New Roman", color: { argb: "FF000000" } }; // Màu đen

        // 2. Kẻ khung
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };

        // 3. Căn lề
        if (colNumber === 3) {
          // Cột Họ tên: Căn trái, cách lề một chút cho đẹp
          cell.alignment = { horizontal: "left", indent: 1 };
        } else {
          // Các cột còn lại (STT, Mã, Ngày, Tổng): Căn giữa
          cell.alignment = { horizontal: "center" };
        }

        // 4. XỬ LÝ RIÊNG CÁC Ô CHẤM CÔNG (Cột 4 -> 4 + daysInMonth)
        // Chỉ in đậm, KHÔNG tô màu nền nữa
        if (colNumber > 3 && colNumber <= 3 + daysInMonth) {
          const cellValue = cell.value?.toString();
          if (cellValue) {
            // Nếu có dữ liệu (X, F...) thì in đậm lên cho dễ nhìn
            cell.font = { name: "Times New Roman", bold: true };
          }
        }

        // 5. XỬ LÝ CÁC CỘT TỔNG HỢP (In đậm luôn cho số liệu rõ ràng)
        if (colNumber > 3 + daysInMonth) {
          if (cell.value) {
            // Nếu có số liệu
            cell.font = { name: "Times New Roman", bold: true };
          }
        }
      });
    });

    // E. CHỈNH ĐỘ RỘNG CỘT
    worksheet.getColumn(1).width = 5; // STT
    worksheet.getColumn(2).width = 10; // Mã
    worksheet.getColumn(3).width = 25; // Họ tên
    // Các cột ngày
    for (let i = 4; i <= 3 + daysInMonth; i++) {
      worksheet.getColumn(i).width = 4; // Nhỏ xinh
    }

    // F. FOOTER (CHỮ KÝ)
    const lastRowIdx = worksheet.lastRow ? worksheet.lastRow.number : 0;
    const footerStartRow = lastRowIdx + 2; // Cách bảng 2 dòng

    // Dòng Ngày tháng (Căn phải)
    // Tính toán cột cuối cùng để merge
    const lastColIndex = 3 + daysInMonth + summaryHeaders.length;
    // Chuyển số thành chữ cái cột (Ví dụ: 30 -> AD). ExcelJS hỗ trợ getCell(row, col) nên không lo.

    const dateRow = worksheet.getRow(footerStartRow);
    const dateCell = dateRow.getCell(lastColIndex - 5); // Lùi về một chút
    dateCell.value = "Phú Bài, ngày ...... tháng ...... năm 20......";
    dateCell.font = { name: "Times New Roman", italic: true };
    // Merge từ ô đó đến hết phải
    worksheet.mergeCells(
      footerStartRow,
      lastColIndex - 5,
      footerStartRow,
      lastColIndex
    );
    worksheet.getCell(footerStartRow, lastColIndex - 5).alignment = {
      horizontal: "center",
    };

    // Dòng Chữ ký (Cách 1 dòng so với ngày)
    const signRowIdx = footerStartRow + 2;

    // Chia 3 cột ký
    const col1Pos = 3; // Cột C
    const col2Pos = Math.floor(lastColIndex / 2);
    const col3Pos = lastColIndex - 3;

    // Set giá trị
    worksheet.getCell(signRowIdx, col1Pos).value = "NGƯỜI CHẤM CÔNG";
    worksheet.getCell(signRowIdx, col2Pos).value = "PHỤ TRÁCH ĐƠN VỊ";
    worksheet.getCell(signRowIdx, col3Pos).value = "CÁN BỘ KIỂM TRA";

    // Style đậm
    [col1Pos, col2Pos, col3Pos].forEach((c) => {
      const cell = worksheet.getCell(signRowIdx, c);
      cell.font = { name: "Times New Roman", bold: true };
      cell.alignment = { horizontal: "center" };
    });

    // G. GỘP LẠI HEADER CHO CHÍNH XÁC (Vì giờ mới biết tổng số cột)
    worksheet.mergeCells(1, 1, 1, lastColIndex); // Dòng 1 merge hết chiều ngang
    worksheet.mergeCells(2, 1, 2, lastColIndex); // Dòng 2 merge hết chiều ngang
    worksheet.mergeCells(3, 1, 3, lastColIndex); // Dòng 3 merge hết chiều ngang

    // H. XUẤT FILE
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

      {/* BỘ LỌC */}
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
            />
          </div>

          <div>
            <div style={{ fontWeight: 600 }}>Nhà máy:</div>
            <Select
              style={{ width: 180 }}
              placeholder="Chọn nhà máy"
              value={selectedFactoryId}
              onChange={(val) => {
                setSelectedFactoryId(val);
                setSelectedDeptId(null);
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

          <div>
            <div style={{ fontWeight: 600 }}>Phòng ban:</div>
            <Select
              style={{ width: 220 }}
              placeholder="Chọn phòng ban"
              value={selectedDeptId}
              onChange={(val) => setSelectedDeptId(val)}
              disabled={!selectedFactoryId}
            >
              {filteredDepartments.map((d) => (
                <Select.Option key={d.id} value={d.id}>
                  {d.name}
                </Select.Option>
              ))}
            </Select>
          </div>

          <div style={{ marginTop: 20 }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchMonthlyData}
              disabled={!selectedDeptId}
            >
              Xem dữ liệu
            </Button>
          </div>

          {/* Ở khu vực các nút bấm (cạnh nút Xuất Excel) */}

          <div style={{ marginTop: 20, marginLeft: 10 }}>
            {/* Chỉ hiện nút này cho ADMIN hoặc HR_MANAGER */}
            {["ADMIN", "HR_MANAGER"].includes(session?.user?.role || "") && (
              <Button
                type={isLocked ? "default" : "primary"}
                danger={!isLocked} // Màu đỏ nếu đang mở (để cảnh báo cần khóa), hoặc tùy thẩm mỹ của bạn
                icon={isLocked ? <UnlockOutlined /> : <LockOutlined />}
                onClick={handleToggleLock}
                disabled={!selectedDeptId}
              >
                {isLocked ? "Mở khóa sổ" : "Khóa sổ tháng này"}
              </Button>
            )}

            {/* Nếu là Timekeeper thì chỉ hiện thông báo trạng thái thôi */}
            {session?.user?.role === "TIMEKEEPER" && isLocked && (
              <Tag color="red" style={{ padding: "5px 10px", fontSize: 14 }}>
                <LockOutlined /> ĐÃ KHÓA SỔ
              </Tag>
            )}
          </div>

          <div style={{ marginTop: 20, marginLeft: "auto" }}>
            <Button
              type="primary"
              style={{ background: "#217346" }} // Màu xanh Excel đặc trưng
              icon={<FileExcelOutlined />}
              onClick={handleExportExcel} // <--- Gắn hàm vào đây
              disabled={!selectedDeptId || employees.length === 0} // Chỉ cho xuất khi có dữ liệu
              loading={loading} // Hiệu ứng xoay xoay khi đang xuất
            >
              Xuất Excel
            </Button>
          </div>
        </div>
      </Card>

      {/* BẢNG DỮ LIỆU */}
      {selectedDeptId && (
        <Table
          bordered
          dataSource={employees}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: "max-content", y: 600 }} // Cho phép cuộn ngang và dọc
          size="small"
        />
      )}

      {!selectedDeptId && (
        <div style={{ textAlign: "center", padding: 50, color: "#999" }}>
          Vui lòng chọn bộ lọc để xem bảng công.
        </div>
      )}
    </AdminLayout>
  );
}
