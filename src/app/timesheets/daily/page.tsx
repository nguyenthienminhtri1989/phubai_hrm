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
  CheckSquareOutlined,
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
}

interface TimesheetRow {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  attendanceCodeId: number | null;
  note: string;
  updatedAt?: string; // MỚI
}

export default function DailyTimesheetPage() {
  const { data: session } = useSession();
  // 2. Định nghĩa chế độ CHỈ XEM
  // Nếu là LEADER -> isViewOnly = true
  const isViewOnly = session?.user?.role === "LEADER";

  // --- STATE DỮ LIỆU ---
  const [departments, setDepartments] = useState<Department[]>([]);
  const [attendanceCodes, setAttendanceCodes] = useState<AttendanceCode[]>([]);
  const [employees, setEmployees] = useState<TimesheetRow[]>([]);

  // --- STATE BỘ LỌC ---
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(
    null
  ); // State mới: ID Nhà máy
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 1. Logic lọc phòng ban hiển thị trong Dropdown
  const availableDepartments = useMemo(() => {
    // Nếu chưa tải xong danh sách phòng hoặc chưa có session
    if (departments.length === 0 || !session) return [];

    const user = session.user;

    // Nếu là ADMIN hoặc HR_MANAGER hoặc LEADER -> Xem hết (Leader xem hết nhưng không sửa được)
    if (["ADMIN", "HR_MANAGER", "LEADER"].includes(user.role)) {
      return departments;
    }

    // Nếu là TIMEKEEPER -> Chỉ lấy phòng nằm trong danh sách được giao
    if (user.role === "TIMEKEEPER") {
      const allowedIds = user.managedDeptIds || []; // Lấy mảng ID từ session
      return departments.filter((d) => allowedIds.includes(d.id));
    }

    return [];
  }, [departments, session]);

  // THÊM LOGIC TÍNH TOÁN TRẠNG THÁI (Memo)
  // Kiểm tra xem trong danh sách nhân viên, đã có ai được chấm công chưa?
  const timesheetStatus = useMemo(() => {
    if (employees.length === 0) return null;

    // Tìm xem có bản ghi nào đã có ID chấm công không
    const hasData = employees.some((e) => e.attendanceCodeId !== null);

    // Nếu có, lấy thời gian cập nhật của người đầu tiên để hiển thị (tương đối)
    const lastUpdate = employees.find((e) => e.updatedAt)?.updatedAt;

    return {
      isSubmitted: hasData,
      lastUpdate: lastUpdate
        ? dayjs(lastUpdate).format("HH:mm - DD/MM/YYYY")
        : null,
    };
  }, [employees]);

  // 1. Tải danh mục hệ thống
  useEffect(() => {
    const fetchInitData = async () => {
      try {
        const [deptRes, codeRes] = await Promise.all([
          fetch("/api/departments"),
          fetch("/api/attendance-codes"),
        ]);
        setDepartments(await deptRes.json());
        setAttendanceCodes(await codeRes.json());
      } catch (error) {
        message.error("Lỗi tải danh mục hệ thống");
      }
    };
    fetchInitData();
  }, []);

  // --- LOGIC LỌC DỮ LIỆU (MỚI) ---

  // A. Trích xuất danh sách Nhà máy từ danh sách Phòng ban (để không phải gọi thêm API)
  const factories = useMemo(() => {
    const map = new Map();
    departments.forEach((dept) => {
      if (dept.factory) {
        map.set(dept.factory.id, dept.factory);
      }
    });
    return Array.from(map.values()) as Factory[];
  }, [departments]);

  // B. Lọc danh sách Phòng ban theo Nhà máy đã chọn
  // SỬA LỖI: Lọc từ 'availableDepartments' để đảm bảo quyền hạn, sau đó mới lọc theo factoryId
  const filteredDepartments = useMemo(() => {
    if (!selectedFactoryId) return [];
    return availableDepartments.filter(
      (d) => d.factory?.id === selectedFactoryId
    );
  }, [availableDepartments, selectedFactoryId]);

  // 2. Hàm tải bảng chấm công
  const fetchTimesheetData = async () => {
    if (!selectedDeptId) return;

    setLoading(true);
    try {
      const dateStr = selectedDate.format("YYYY-MM-DD");
      const res = await fetch(
        `/api/timesheets/daily?departmentId=${selectedDeptId}&date=${dateStr}`
      );
      const data = await res.json();

      setEmployees(data);
    } catch (error) {
      message.error("Lỗi tải dữ liệu chấm công");
    } finally {
      setLoading(false);
    }
  };

  // Trigger tải dữ liệu khi đổi Phòng ban hoặc Ngày
  useEffect(() => {
    fetchTimesheetData();
  }, [selectedDeptId, selectedDate]);

  // 3. XỬ LÝ TRÊN GIAO DIỆN
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

  const handleSave = async () => {
    const missing = employees.filter((e) => !e.attendanceCodeId);
    if (missing.length > 0) {
      message.warning(`Còn ${missing.length} nhân viên chưa chấm công!`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        date: selectedDate.format("YYYY-MM-DD"),
        records: employees.map((e) => ({
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
        message.success("Lưu dữ liệu thành công!");
      } else {
        message.error("Lỗi khi lưu");
      }
    } catch (error) {
      message.error("Lỗi kết nối server");
    } finally {
      setSaving(false);
    }
  };

  // CÁC CỘT TRONG BẢNG
  const columns = [
    {
      title: "STT",
      key: "index",
      width: 50,
      align: "center" as const,
      // render nhận vào (text, record, index)
      render: (_: any, __: any, index: number) => (
        <span style={{ color: "#888", fontWeight: 600 }}>{index + 1}</span>
      ),
    },
    {
      title: "Họ và tên",
      dataIndex: "fullName",
      width: 250,
    },
    {
      title: "Trạng thái",
      dataIndex: "attendanceCodeId",
      width: 250,
      render: (value: number, record: TimesheetRow) => (
        <Select
          value={value}
          allowClear // Cho phép xóa trắng
          style={{ width: "100%" }}
          placeholder="Chọn công"
          onChange={(val) =>
            handleRowChange(record.employeeId, "attendanceCodeId", val)
          }
          showSearch
          filterOption={(input, option) =>
            (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
          }
          options={attendanceCodes.map((c) => ({
            value: c.id,
            label: `${c.code} - ${c.name}`,
            item: c,
          }))}
          optionRender={(option) => {
            const code = option.data.item;
            return (
              <Space>
                <Tag
                  color={code.color}
                  style={{
                    fontWeight: "bold",
                    minWidth: 40,
                    textAlign: "center" as const,
                  }}
                >
                  {code.code}
                </Tag>
                {code.name}
              </Space>
            );
          }}
          labelRender={(props) => {
            const code = attendanceCodes.find((c) => c.id === props.value);
            if (!code) return props.label;
            return (
              <Tag
                color={code.color}
                style={{
                  fontWeight: "bold",
                  width: "100%",
                  textAlign: "center" as const,
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

  return (
    <AdminLayout>
      <div style={{ marginBottom: 24 }}>
        <Title level={3}>Chấm công hàng ngày</Title>
      </div>

      {/* --- CẬP NHẬT GIAO DIỆN BỘ LỌC --- */}
      <Card style={{ marginBottom: 16, background: "#f5f5f5" }} size="small">
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* 1. Chọn Ngày */}
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Ngày chấm công:
            </div>
            <DatePicker
              value={selectedDate}
              onChange={(date) => date && setSelectedDate(date)}
              format="DD/MM/YYYY"
              allowClear={false}
              style={{ width: 140 }}
            />
          </div>

          {/* 2. Chọn Nhà máy (Bộ lọc cấp 1) */}
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Nhà máy / Khối:
            </div>
            <Select
              style={{ width: 200 }}
              placeholder="Chọn Nhà máy"
              value={selectedFactoryId}
              onChange={(val) => {
                setSelectedFactoryId(val);
                setSelectedDeptId(null); // Reset phòng ban khi đổi nhà máy
                setEmployees([]); // Xóa bảng dữ liệu cũ
              }}
            >
              {factories.map((f) => (
                <Select.Option key={f.id} value={f.id}>
                  {f.name}
                </Select.Option>
              ))}
            </Select>
          </div>

          {/* 3. Chọn Phòng ban (Bộ lọc cấp 2 - Phụ thuộc cấp 1) */}
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Phòng ban:</div>
            <Select
              style={{ width: 250 }}
              placeholder={
                selectedFactoryId ? "Chọn phòng ban" : "<- Chọn nhà máy trước"
              }
              value={selectedDeptId}
              onChange={(val) => setSelectedDeptId(val)}
              disabled={!selectedFactoryId} // Khóa nếu chưa chọn nhà máy
              showSearch
              optionFilterProp="children"
            >
              {/* SỬA LỖI: Dùng filteredDepartments thay vì availableDepartments */}
              {filteredDepartments.map((d) => (
                <Select.Option key={d.id} value={d.id}>
                  {d.name}
                </Select.Option>
              ))}
            </Select>
          </div>

          {/* Nút tải lại */}
          <div style={{ marginTop: 24 }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchTimesheetData}
              disabled={!selectedDeptId}
            >
              Tải lại
            </Button>
          </div>
        </div>
      </Card>

      {/* --- THÊM PHẦN CẢNH BÁO TRẠNG THÁI Ở ĐÂY (Ngay trên nút Thao tác nhanh) --- */}
      {selectedDeptId && employees.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {timesheetStatus?.isSubmitted ? (
            <Alert
              title={
                <span style={{ fontWeight: 600 }}>
                  ✅ Dữ liệu ngày này ĐÃ ĐƯỢC CHẤM.
                </span>
              }
              description={`Bạn đang xem dữ liệu đã lưu. Cập nhật lần cuối lúc: ${
                timesheetStatus.lastUpdate || "?"
              }. Mọi thay đổi và bấm Lưu sẽ ghi đè lên dữ liệu cũ.`}
              type="success"
              showIcon
            />
          ) : (
            <Alert
              title="Chưa có dữ liệu chấm công."
              description="Ngày này chưa được chấm. Hãy nhập dữ liệu và bấm Lưu."
              type="info"
              showIcon
            />
          )}
        </div>
      )}

      {/* --- CÁC NÚT THAO TÁC NHANH --- */}
      {selectedDeptId && employees.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Space>
            <span style={{ fontWeight: 600, color: "#1677ff" }}>
              <FilterOutlined /> Thao tác nhanh:
            </span>
            <Button onClick={() => setAllStatus("X")}>Tất cả đi làm (X)</Button>
            <Button onClick={() => setAllStatus("L")}>
              Tất cả nghỉ lễ (L)
            </Button>
            {/* Bạn có thể thêm nút F hoặc XD ở đây nếu muốn */}
          </Space>

          {!isViewOnly && (
            <Button
              type="primary"
              size="large"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
              style={{
                minWidth: 150,
                boxShadow: "0 4px 14px 0 rgba(0,118,255,0.39)",
              }}
            >
              LƯU BẢNG CÔNG
            </Button>
          )}
        </div>
      )}

      {/* --- BẢNG DỮ LIỆU --- */}
      {!selectedDeptId ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 0",
            background: "#fff",
            borderRadius: 8,
            border: "1px dashed #d9d9d9",
            color: "#999",
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
          Vui lòng chọn <b>Nhà máy</b> và <b>Phòng ban</b> để bắt đầu chấm công.
        </div>
      ) : (
        <Table
          bordered
          dataSource={employees}
          columns={columns}
          rowKey="employeeId"
          loading={loading}
          pagination={false}
          scroll={{ y: 600 }}
          size="middle" // Làm bảng nhỏ gọn lại chút cho dễ nhìn nhiều dòng
        />
      )}
    </AdminLayout>
  );
}
