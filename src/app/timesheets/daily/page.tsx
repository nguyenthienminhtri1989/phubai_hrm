"use client";

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
  Input,
  Tag,
  Space,
  Typography,
  Alert,
} from "antd";
import { SaveOutlined, ReloadOutlined } from "@ant-design/icons";
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
interface Factory {
  id: number;
  name: string;
  code: string;
}
interface Department {
  id: number;
  code: string; // Bắt buộc có mã code
  name: string;
  factory?: Factory;
  isKip: boolean;
}
interface TimesheetRow {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  attendanceCodeId: number | null;
  note: string;
  updatedAt?: string;
}
interface Kip {
  id: number;
  name: string;
  factoryId: number;
  factory?: { name: string };
}

// Helper Interface cho Dropdown gộp
interface DeptOption {
  value: string; // Format: "SECTION:GT" hoặc "DEPT:15"
  label: string;
  type: "SECTION" | "DEPT";
  code?: string; // Mã tổ (GT) nếu là Section
  id?: number; // ID thật nếu là Dept
}

export default function DailyTimesheetPage() {
  const { data: session } = useSession();
  const isViewOnly = session?.user?.role === "LEADER";

  // --- STATE ---
  const [departments, setDepartments] = useState<Department[]>([]);
  const [attendanceCodes, setAttendanceCodes] = useState<AttendanceCode[]>([]);
  const [employees, setEmployees] = useState<TimesheetRow[]>([]);
  const [kips, setKips] = useState<Kip[]>([]);

  // --- FILTER STATE ---
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(
    null
  );

  // State quản lý lựa chọn Dropdown gộp
  // Giá trị sẽ là "SECTION:GT" hoặc "DEPT:123"
  const [mixedDeptValue, setMixedDeptValue] = useState<string | null>(null);

  // State Kíp (cho NM2 và NM3)
  const [selectedKipIds, setSelectedKipIds] = useState<number[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- CONFIG ---
  const EXCLUSIVE_FACTORY_IDS = [3]; // NM3: Chọn Kíp HOẶC Phòng
  const MATRIX_FACTORY_IDS = [2]; // NM2: Ma trận

  // 1. Load Data
  useEffect(() => {
    const fetchInitData = async () => {
      try {
        const [deptRes, codeRes, kipRes] = await Promise.all([
          fetch("/api/departments"),
          fetch("/api/attendance-codes"),
          fetch("/api/kips"),
        ]);
        setDepartments(await deptRes.json());
        setKips(await kipRes.json());

        const codes: AttendanceCode[] = await codeRes.json();
        const PRIORITY = [
          "X",
          "XD",
          "ĐC",
          "X/2",
          "F",
          "NB",
          "Ô",
          "XL",
          "L",
          "TS",
        ];
        codes.sort((a, b) => {
          const iA = PRIORITY.indexOf(a.code),
            iB = PRIORITY.indexOf(b.code);
          if (iA !== -1 && iB !== -1) return iA - iB;
          if (iA !== -1) return -1;
          if (iB !== -1) return 1;
          return a.code.localeCompare(b.code);
        });
        setAttendanceCodes(codes);
      } catch (error) {
        message.error("Lỗi tải danh mục");
      }
    };
    fetchInitData();
  }, []);

  // --- LOGIC ---
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

  const hasKipPermission = useMemo(
    () => availableDepartments.some((d) => d.isKip === true),
    [availableDepartments]
  );

  const factories = useMemo(() => {
    const map = new Map();
    availableDepartments.forEach((d) => {
      if (d.factory) map.set(d.factory.id, d.factory);
    });
    return Array.from(map.values()) as Factory[];
  }, [availableDepartments]);

  const isExclusive = useMemo(
    () =>
      selectedFactoryId
        ? EXCLUSIVE_FACTORY_IDS.includes(selectedFactoryId)
        : false,
    [selectedFactoryId]
  );
  const isMatrix = useMemo(
    () =>
      selectedFactoryId
        ? MATRIX_FACTORY_IDS.includes(selectedFactoryId)
        : false,
    [selectedFactoryId]
  );

  // --- LOGIC TẠO DANH SÁCH DROPDOWN GỘP (QUAN TRỌNG) ---
  const mixedDeptOptions = useMemo<DeptOption[]>(() => {
    if (!selectedFactoryId) return [];
    const currentDepts = availableDepartments.filter(
      (d) => d.factory?.id === selectedFactoryId
    );
    const options: DeptOption[] = [];
    const processedSections = new Set<string>(); // Để tránh trùng lặp Section

    currentDepts.forEach((d) => {
      // Check xem có phải là Phòng thuộc Kíp (Ma trận) không? Dựa vào Regex Mã Code
      // Regex: Bắt đầu bằng ID nhà máy, Chữ cái ở giữa, Kết thúc số
      const matrixRegex = new RegExp(`^${selectedFactoryId}([a-zA-Z]+)(\\d+)$`);
      const match = d.code?.match(matrixRegex);

      if (isMatrix && match) {
        // --- TRƯỜNG HỢP 1: LÀ TỔ SẢN XUẤT (Ma trận) ---
        const sectionCode = match[1]; // VD: GT
        if (!processedSections.has(sectionCode)) {
          // Tạo tên hiển thị đẹp (Cắt bỏ chữ Kíp)
          const displayName = d.name
            .replace(/(kíp|ca)\s*\d+.*$/gi, "")
            .trim()
            .replace(/-+.*$/gi, "")
            .trim();

          options.push({
            value: `SECTION:${sectionCode}`,
            label: displayName, // VD: "Tổ Ghép thô"
            type: "SECTION",
            code: sectionCode,
          });
          processedSections.add(sectionCode);
        }
      } else {
        // --- TRƯỜNG HỢP 2: LÀ PHÒNG BAN BÌNH THƯỜNG (Hoặc NM3 HC) ---
        // Với NM3 Exclusive: Ẩn các phòng SX (isKip=true) để chọn bên ô Kíp riêng
        if (isExclusive && d.isKip) return;

        options.push({
          value: `DEPT:${d.id}`,
          label: d.name,
          type: "DEPT",
          id: d.id,
        });
      }
    });

    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [availableDepartments, selectedFactoryId, isMatrix, isExclusive]);

  // --- XỬ LÝ SỰ KIỆN ---
  const handleFactoryChange = (val: number) => {
    setSelectedFactoryId(val);
    setMixedDeptValue(null);
    setSelectedKipIds([]);
    setEmployees([]); // Xóa bảng khi đổi nhà máy
  };

  const handleMixedDeptChange = (val: string) => {
    setMixedDeptValue(val);
    // Nếu chọn loại DEPT (Phòng thường) thì xóa chọn Kíp đi cho sạch
    if (val && val.startsWith("DEPT")) {
      setSelectedKipIds([]);
    }
    // Nếu là NM3 (Exclusive), chọn Phòng thì xóa Kíp
    if (isExclusive && val) setSelectedKipIds([]);
  };

  const handleKipChange = (val: number[]) => {
    setSelectedKipIds(val);
    // NM3: Chọn Kíp thì xóa chọn Phòng
    if (isExclusive && val.length > 0) setMixedDeptValue(null);
  };

  // --- HÀM TÍNH TOÁN ID PHÒNG BAN THỰC TẾ ---
  const resolveRealDepartmentIds = (): number[] => {
    if (!selectedFactoryId) return [];

    // TH1: Chọn Phòng ban cụ thể (DEPT)
    if (mixedDeptValue && mixedDeptValue.startsWith("DEPT")) {
      const id = parseInt(mixedDeptValue.split(":")[1]);
      return [id];
    }

    // TH2: Chọn Tổ Sản Xuất (SECTION) - Logic Ma trận
    if (mixedDeptValue && mixedDeptValue.startsWith("SECTION")) {
      const sectionCode = mixedDeptValue.split(":")[1]; // GT

      // Lấy danh sách số Kíp từ các Kíp đã chọn
      // Nếu không chọn Kíp nào -> Lấy HẾT các Kíp (Logic: Xem cả tổ)
      let targetKipNumbers: string[] = [];

      if (selectedKipIds.length > 0) {
        // Lấy số từ tên Kíp đã chọn (Kíp 1 -> "1")
        const selectedKipNames = kips
          .filter((k) => selectedKipIds.includes(k.id))
          .map((k) => k.name);
        targetKipNumbers = selectedKipNames
          .map((name) => name.match(/\d+/)?.[0] || "")
          .filter((n) => n);
      } else {
        // Không chọn kíp -> Không lọc -> Lấy tất cả phòng có mã sectionCode
        // Tuy nhiên để an toàn, ta sẽ duyệt qua department list
      }

      const realIds: number[] = [];
      availableDepartments.forEach((d) => {
        if (d.factory?.id !== selectedFactoryId) return;
        // Check Code: Phải khớp Section (2GT...)
        const regex = new RegExp(`^${selectedFactoryId}${sectionCode}(\\d+)$`);
        const match = d.code?.match(regex);

        if (match) {
          const deptKipNum = match[1]; // Số kíp trong mã phòng
          // Nếu có chọn Kíp cụ thể -> Phải khớp số Kíp
          if (targetKipNumbers.length > 0) {
            if (targetKipNumbers.includes(deptKipNum)) {
              realIds.push(d.id);
            }
          } else {
            // Không chọn Kíp -> Lấy hết
            realIds.push(d.id);
          }
        }
      });
      return realIds;
    }

    return [];
  };

  // --- FETCH DATA ---
  const fetchTimesheetData = async () => {
    // 1. Kiểm tra điều kiện & Xóa bảng nếu không chọn gì
    // NM3: Phải chọn Phòng HOẶC Kíp
    // NM2/1: Phải chọn Phòng/Tổ
    if (isExclusive) {
      if (!mixedDeptValue && selectedKipIds.length === 0) {
        setEmployees([]);
        return;
      }
    } else {
      if (!mixedDeptValue) {
        setEmployees([]);
        return;
      }
    }

    setLoading(true);
    try {
      const dateStr = selectedDate.format("YYYY-MM-DD");
      let url = `/api/timesheets/daily?date=${dateStr}`;

      if (isExclusive && selectedKipIds.length > 0 && !mixedDeptValue) {
        // NM3 trường hợp chỉ chọn Kíp (không chọn phòng)
        url += `&kipIds=${selectedKipIds.join(",")}`;
      } else {
        // Các trường hợp còn lại: Phải phân giải ra Department IDs
        const realIds = resolveRealDepartmentIds();
        if (realIds.length === 0) {
          message.warning("Không tìm thấy dữ liệu phòng ban tương ứng.");
          setEmployees([]);
          setLoading(false);
          return;
        }
        url += `&departmentId=${realIds.join(",")}`; // Gửi chuỗi "15,16"
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error("Lỗi tải");
      const data = await res.json();
      setEmployees(data);
    } catch (error) {
      console.error(error);
      message.error("Lỗi tải dữ liệu");
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto load
  useEffect(() => {
    fetchTimesheetData();
  }, [selectedDate, selectedFactoryId, mixedDeptValue, selectedKipIds]);

  // --- SAVE ---
  const handleSave = async () => {
    const validRecords = employees.filter(
      (e) => e.attendanceCodeId !== null && e.attendanceCodeId !== undefined
    );
    if (validRecords.length === 0) {
      message.warning("Chưa chọn công!");
      return;
    }

    setSaving(true);
    try {
      // Vì lưu nhiều phòng ban cùng lúc, ta không gửi departmentId cụ thể ở cấp cao nhất
      // Mà API daily của ta ở POST nó tự suy ra Department từ EmployeeID (hoặc ta gửi null)
      // *Lưu ý*: API daily POST cũ của bạn có thể đang cần departmentId để check khóa sổ.
      // Nếu ta gửi null, logic check khóa sổ phải dựa vào employee list (như ta đã sửa ở các bước trước cho Kíp).

      // Tuy nhiên, để an toàn, nếu chỉ có 1 dept thì gửi, nhiều thì gửi null
      const realIds = resolveRealDepartmentIds();
      const payloadDeptId = realIds.length === 1 ? realIds[0] : null;

      const payload = {
        date: selectedDate.format("YYYY-MM-DD"),
        departmentId: payloadDeptId,
        records: validRecords.map((e) => ({
          employeeId: e.employeeId,
          attendanceCodeId: e.attendanceCodeId,
          note: e.note,
        })),
      };

      const res = await fetch("/api/timesheets/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        message.success(`Lưu thành công ${validRecords.length} NV!`);
        fetchTimesheetData();
      } else {
        const err = await res.json();
        message.error(
          res.status === 403 ? `KHÓA SỔ: ${err.error}` : err.error || "Lỗi lưu"
        );
      }
    } catch (error) {
      message.error("Lỗi kết nối");
    } finally {
      setSaving(false);
    }
  };

  // Helpers
  const handleRowChange = (empId: number, field: string, value: any) => {
    const newData = [...employees];
    const index = newData.findIndex((i) => i.employeeId === empId);
    if (index > -1) {
      newData[index] = { ...newData[index], [field]: value };
      setEmployees(newData);
    }
  };
  const setAllStatus = (codeStr: string) => {
    const targetCode = attendanceCodes.find((c) => c.code === codeStr);
    if (!targetCode) return;
    setEmployees(
      employees.map((e) => ({ ...e, attendanceCodeId: targetCode.id }))
    );
  };
  const timesheetStatus = useMemo(() => {
    if (employees.length === 0) return null;
    const hasData = employees.some((e) => e.attendanceCodeId !== null);
    const lastUpdate = employees.find((e) => e.updatedAt)?.updatedAt;
    return {
      isSubmitted: hasData,
      lastUpdate: lastUpdate
        ? dayjs(lastUpdate).format("HH:mm - DD/MM/YYYY")
        : null,
    };
  }, [employees]);

  // UI VARS
  // Show Kip if: (Matrix AND selected Section) OR (Exclusive AND has permission AND not selected Dept)
  const isSectionSelected = mixedDeptValue?.startsWith("SECTION");
  const showKipSelect =
    (isMatrix && isSectionSelected) ||
    (isExclusive && hasKipPermission && !mixedDeptValue);

  // Show Dept if: Not Exclusive OR (Exclusive AND not selected Kip)
  const showDeptSelect =
    !isExclusive || (isExclusive && selectedKipIds.length === 0);

  // COLUMNS (Giữ nguyên)
  const columns = [
    {
      title: "STT",
      key: "index",
      width: 50,
      align: "center" as const,
      render: (_: any, __: any, index: number) => (
        <span style={{ color: "#888" }}>{index + 1}</span>
      ),
    },
    { title: "Họ và tên", dataIndex: "fullName", width: 220 },
    {
      title: "Bộ phận",
      key: "deptInfo",
      width: 150,
      render: (_: any, record: TimesheetRow) => (
        <div style={{ fontSize: 12 }}>
          {(record as any).kipName ? (
            <Tag color="blue">{(record as any).kipName}</Tag>
          ) : (
            <Tag>{(record as any).departmentName}</Tag>
          )}
        </div>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "attendanceCodeId",
      width: 200,
      render: (value: number, record: TimesheetRow) => (
        <Select
          value={value}
          allowClear
          style={{ width: "100%" }}
          placeholder="Chọn"
          onChange={(val) =>
            handleRowChange(record.employeeId, "attendanceCodeId", val)
          }
          options={attendanceCodes.map((c) => ({
            value: c.id,
            label: `${c.code} - ${c.name}`,
            item: c,
          }))}
          optionRender={(opt) => (
            <Space>
              <Tag
                color={opt.data.item.color}
                style={{
                  fontWeight: "bold",
                  minWidth: 40,
                  textAlign: "center",
                }}
              >
                {opt.data.item.code}
              </Tag>
              {opt.data.item.name}
            </Space>
          )}
          labelRender={(props) => {
            const c = attendanceCodes.find((x) => x.id === props.value);
            return c ? (
              <Tag
                color={c.color}
                style={{
                  fontWeight: "bold",
                  width: "100%",
                  textAlign: "center",
                }}
              >
                {c.code} - {c.name}
              </Tag>
            ) : (
              props.label
            );
          }}
        />
      ),
    },
    {
      title: "Ghi chú",
      dataIndex: "note",
      render: (txt: string, rec: TimesheetRow) => (
        <Input
          value={txt}
          onChange={(e) =>
            handleRowChange(rec.employeeId, "note", e.target.value)
          }
          placeholder="..."
        />
      ),
    },
  ];

  return (
    <AdminLayout>
      <div style={{ marginBottom: 24 }}>
        <Title level={3}>Chấm công hàng ngày</Title>
      </div>
      <Card style={{ marginBottom: 16, background: "#f5f5f5" }} size="small">
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Ngày:</div>
            <DatePicker
              value={selectedDate}
              onChange={(d) => d && setSelectedDate(d)}
              format="DD/MM/YYYY"
              allowClear={false}
              style={{ width: 130 }}
            />
          </div>

          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Nhà máy:</div>
            <Select
              style={{ width: 180 }}
              placeholder="Chọn Nhà máy"
              value={selectedFactoryId}
              onChange={handleFactoryChange}
            >
              {factories.map((f) => (
                <Select.Option key={f.id} value={f.id}>
                  {f.name}
                </Select.Option>
              ))}
            </Select>
          </div>

          {showDeptSelect && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {isMatrix ? "Chọn Tổ / Bộ phận:" : "Phòng ban:"}
              </div>
              <Select
                style={{ width: 220 }}
                placeholder="Chọn..."
                allowClear
                value={mixedDeptValue}
                onChange={handleMixedDeptChange}
                disabled={!selectedFactoryId}
                showSearch
                optionFilterProp="children"
              >
                {mixedDeptOptions.map((opt) => (
                  <Select.Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Select.Option>
                ))}
              </Select>
            </div>
          )}

          {showKipSelect && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {isMatrix ? "Lọc theo Kíp (Chọn nhiều):" : "Chọn Kíp:"}
              </div>
              <Select
                mode="multiple"
                style={{ width: 220 }}
                placeholder="Tất cả Kíp"
                allowClear
                value={selectedKipIds}
                onChange={handleKipChange}
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
          )}

          <div style={{ marginTop: 24 }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchTimesheetData}
              disabled={!mixedDeptValue && selectedKipIds.length === 0}
            >
              Tải lại
            </Button>
          </div>
        </div>
      </Card>

      {employees.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {timesheetStatus?.isSubmitted ? (
            <Alert
              message={`Đã chấm công (Cập nhật: ${timesheetStatus.lastUpdate})`}
              type="success"
              showIcon
            />
          ) : (
            <Alert message="Chưa có dữ liệu." type="info" showIcon />
          )}
        </div>
      )}

      {employees.length > 0 ? (
        <>
          <div
            style={{
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <Space>
              <span style={{ fontWeight: 600 }}>Thao tác nhanh:</span>
              <Button size="small" onClick={() => setAllStatus("X")}>
                Đi làm (X)
              </Button>
              <Button size="small" onClick={() => setAllStatus("XD")}>
                Làm ca đêm (XD)
              </Button>
              <Button size="small" onClick={() => setAllStatus("ĐC")}>
                Đảo ca (ĐC)
              </Button>
            </Space>
            {!isViewOnly && (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
              >
                LƯU DỮ LIỆU
              </Button>
            )}
          </div>
          <Table
            bordered
            dataSource={employees}
            columns={columns}
            rowKey="employeeId"
            loading={loading}
            pagination={false}
            scroll={{ y: 600 }}
            size="middle"
          />
        </>
      ) : (
        <div
          style={{
            textAlign: "center",
            padding: "50px",
            color: "#999",
            background: "#fff",
            border: "1px dashed #ddd",
          }}
        >
          Vui lòng chọn <b>Nhà máy</b> và bộ phận cần chấm công.
        </div>
      )}
    </AdminLayout>
  );
}
