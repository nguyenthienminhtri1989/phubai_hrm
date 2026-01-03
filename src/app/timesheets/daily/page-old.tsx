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
import {
  SaveOutlined,
  ReloadOutlined,
  FilterOutlined,
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

interface Factory {
  id: number;
  name: string;
  code: string;
}

interface Department {
  id: number;
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
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [selectedKipIds, setSelectedKipIds] = useState<number[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 1. Tải danh mục hệ thống
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

        // --- XỬ LÝ SẮP XẾP MÃ CÔNG ---
        const codes: AttendanceCode[] = await codeRes.json();

        // Định nghĩa thứ tự ưu tiên (Những mã hay dùng nhất để lên đầu)
        // Bạn có thể thêm bớt tùy ý vào danh sách này
        const PRIORITY_ORDER = [
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
          const indexA = PRIORITY_ORDER.indexOf(a.code);
          const indexB = PRIORITY_ORDER.indexOf(b.code);

          // 1. Nếu cả 2 đều nằm trong danh sách ưu tiên -> Sắp theo thứ tự trong danh sách
          if (indexA !== -1 && indexB !== -1) {
            return indexA - indexB;
          }

          // 2. Nếu chỉ có A nằm trong danh sách -> A lên trước
          if (indexA !== -1) return -1;

          // 3. Nếu chỉ có B nằm trong danh sách -> B lên trước
          if (indexB !== -1) return 1;

          // 4. Các mã còn lại (ít dùng) -> Sắp xếp Alphabet cho dễ tìm
          return a.code.localeCompare(b.code);
        });

        setAttendanceCodes(codes);
        // -----------------------------
      } catch (error) {
        message.error("Lỗi tải danh mục hệ thống");
      }
    };
    fetchInitData();
  }, []);

  // --- LOGIC PHÂN QUYỀN ---

  // A. Lọc danh sách được phép quản lý
  const availableDepartments = useMemo(() => {
    if (departments.length === 0 || !session) return [];
    const user = session.user;

    if (["ADMIN", "HR_MANAGER", "LEADER"].includes(user.role)) {
      return departments;
    }
    if (user.role === "TIMEKEEPER") {
      const allowedIds = user.managedDeptIds || [];
      return departments.filter((d) => allowedIds.includes(d.id));
    }
    return [];
  }, [departments, session]);

  // B. KIỂM TRA: User này có quyền xem Kíp hay không?
  const hasKipPermission = useMemo(() => {
    if (availableDepartments.length === 0) return false;
    return availableDepartments.some((d) => d.isKip === true);
  }, [availableDepartments]);

  // C. List Nhà máy
  const factories = useMemo(() => {
    const map = new Map();
    availableDepartments.forEach((dept) => {
      if (dept.factory) map.set(dept.factory.id, dept.factory);
    });
    return Array.from(map.values()) as Factory[];
  }, [availableDepartments]);

  // --- CẤU HÌNH NHÀ MÁY DÙNG KÍP ---
  const SHIFT_FACTORY_IDS = [3, 2];

  // --- LOGIC TỰ ĐỘNG PHÁT HIỆN ---
  const isShiftFactory = useMemo(() => {
    if (!selectedFactoryId) return false;
    return SHIFT_FACTORY_IDS.includes(selectedFactoryId);
  }, [selectedFactoryId]);

  // D. Lọc Phòng ban hiển thị vào Dropdown
  const filteredDepartments = useMemo(() => {
    if (!selectedFactoryId) return [];

    let depts = availableDepartments.filter(
      (d) => d.factory?.id === selectedFactoryId
    );

    if (isShiftFactory) {
      depts = depts.filter((d) => d.isKip === false);
    }

    return depts;
  }, [availableDepartments, selectedFactoryId, isShiftFactory]);

  // --- FETCH DATA (ĐÃ SỬA ĐỂ TỰ XÓA DỮ LIỆU) ---
  const fetchTimesheetData = async () => {
    // [LOGIC MỚI] Nếu chưa chọn gì cả -> Xóa sạch dữ liệu cũ và return
    if (!selectedDeptId && selectedKipIds.length === 0) {
      setEmployees([]); // <--- Dòng này giúp bảng biến mất khi xóa ô chọn
      return;
    }

    setLoading(true);
    try {
      const dateStr = selectedDate.format("YYYY-MM-DD");
      const kipIdsParam =
        selectedKipIds.length > 0 ? selectedKipIds.join(",") : "";

      const url = `/api/timesheets/daily?date=${dateStr}&departmentId=${
        selectedDeptId || ""
      }&kipIds=${kipIdsParam}`;

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

  useEffect(() => {
    fetchTimesheetData();
  }, [selectedDeptId, selectedDate, selectedKipIds]);

  // --- HANDLERS ---
  const handleRowChange = (empId: number, field: string, value: any) => {
    const newData = [...employees];
    const index = newData.findIndex((item) => item.employeeId === empId);
    if (index > -1) {
      newData[index] = { ...newData[index], [field]: value };
      setEmployees(newData);
    }
  };

  const setAllStatus = (codeStr: string) => {
    const targetCode = attendanceCodes.find((c) => c.code === codeStr);
    if (!targetCode) return;
    const newEmployees = employees.map((emp) => ({
      ...emp,
      attendanceCodeId: targetCode.id,
    }));
    setEmployees(newEmployees);
    message.success(`Đã thiết lập toàn bộ là ${codeStr}`);
  };

  // Hàm lưu dữ liệu chấm công ngày
  const handleSave = async () => {
    // BƯỚC 1: Lọc dữ liệu "sạch"
    // Chỉ lấy những nhân viên mà attendanceCodeId có giá trị (khác null và undefined)
    const validRecords = employees.filter(
      (e) => e.attendanceCodeId !== null && e.attendanceCodeId !== undefined
    );

    // BƯỚC 2: Kiểm tra nếu không có ai được chọn thì dừng luôn
    if (validRecords.length === 0) {
      message.warning(
        "Vui lòng chọn công cho ít nhất 1 nhân viên trước khi lưu!"
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        date: selectedDate.format("YYYY-MM-DD"),
        departmentId: selectedDeptId,
        // BƯỚC 3: Chỉ map những bản ghi hợp lệ đã lọc ở trên
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
        message.success(`Đã lưu thành công ${validRecords.length} nhân viên!`);
        // Gọi hàm tải lại dữ liệu để cập nhật trạng thái mới nhất từ server
        fetchTimesheetData();
      } else {
        const err = await res.json();
        message.error(err.error || "Lỗi khi lưu");
      }
    } catch (error) {
      message.error("Lỗi kết nối server");
    } finally {
      setSaving(false);
    }
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

  // --- TABLE COLUMNS ---
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
          placeholder="Chọn công"
          onChange={(val) =>
            handleRowChange(record.employeeId, "attendanceCodeId", val)
          }
          // 1. Truyền đầy đủ dữ liệu (item) vào options
          options={attendanceCodes.map((c) => ({
            value: c.id,
            label: `${c.code} - ${c.name}`,
            item: c, // <--- QUAN TRỌNG: Để lấy được màu ở bước sau
          }))}
          // 2. Hiển thị màu trong danh sách thả xuống
          optionRender={(option) => {
            const code = option.data.item;
            return (
              <Space>
                <Tag
                  color={code.color}
                  style={{
                    fontWeight: "bold",
                    minWidth: 40,
                    textAlign: "center",
                  }}
                >
                  {code.code}
                </Tag>
                {code.name}
              </Space>
            );
          }}
          // 3. Hiển thị màu khi đã chọn xong (trong ô input)
          labelRender={(props) => {
            const code = attendanceCodes.find((c) => c.id === props.value);
            if (!code) return props.label;
            return (
              <Tag
                color={code.color}
                style={{
                  fontWeight: "bold",
                  width: "100%",
                  textAlign: "center",
                  margin: 0,
                }}
              >
                {code.code} - {code.name}
              </Tag>
            );
          }}
        />
      ),
    },
    {
      title: "Ghi chú",
      dataIndex: "note",
      render: (text: string, record: TimesheetRow) => (
        <Input
          value={text}
          onChange={(e) =>
            handleRowChange(record.employeeId, "note", e.target.value)
          }
          placeholder="..."
        />
      ),
    },
  ];

  // --- LOGIC HIỂN THỊ UI ---
  const showKipSelect = isShiftFactory && !selectedDeptId && hasKipPermission;
  const showDeptSelect = !isShiftFactory || selectedKipIds.length === 0;

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
          {/* 1. NGÀY */}
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Ngày:</div>
            <DatePicker
              value={selectedDate}
              onChange={(date) => date && setSelectedDate(date)}
              format="DD/MM/YYYY"
              allowClear={false}
              style={{ width: 130 }}
            />
          </div>

          {/* 2. NHÀ MÁY */}
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Nhà máy:</div>
            <Select
              style={{ width: 180 }}
              placeholder="Chọn Nhà máy"
              value={selectedFactoryId}
              onChange={(val) => {
                setSelectedFactoryId(val);
                setSelectedDeptId(null);
                setSelectedKipIds([]);
                setEmployees([]); // Xóa bảng khi đổi nhà máy
              }}
            >
              {factories.map((f) => (
                <Select.Option key={f.id} value={f.id}>
                  {f.name}
                </Select.Option>
              ))}
            </Select>
          </div>

          {/* 3. Ô CHỌN KÍP */}
          {showKipSelect && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                Kíp (Sản xuất):
              </div>
              <Select
                mode="multiple"
                style={{ width: 220 }}
                placeholder="Chọn Kíp..."
                allowClear
                value={selectedKipIds}
                onChange={(val) => {
                  setSelectedKipIds(val);
                  if (val.length > 0) setSelectedDeptId(null);
                }}
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

          {/* 4. Ô CHỌN PHÒNG BAN */}
          {showDeptSelect && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {isShiftFactory ? "Phòng (Hành chính/Khác):" : "Phòng ban:"}
              </div>
              <Select
                style={{ width: 220 }}
                placeholder="Chọn Phòng ban"
                allowClear
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

          <div style={{ marginTop: 24 }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchTimesheetData}
              disabled={!selectedDeptId && selectedKipIds.length === 0}
            >
              Tải lại
            </Button>
          </div>
        </div>
      </Card>

      {/* HIỂN THỊ CẢNH BÁO */}
      {employees.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {timesheetStatus?.isSubmitted ? (
            <Alert
              message={`Đã chấm công (Cập nhật: ${timesheetStatus.lastUpdate})`}
              type="success"
              showIcon
            />
          ) : (
            <Alert
              message="Chưa có dữ liệu chấm công ngày này."
              type="info"
              showIcon
            />
          )}
        </div>
      )}

      {/* BẢNG DỮ LIỆU */}
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
              <Button size="small" onClick={() => setAllStatus("L")}>
                Nghỉ Lễ (L)
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
