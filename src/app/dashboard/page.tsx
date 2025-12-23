"use client";

import React, { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import {
  Card,
  DatePicker,
  Row,
  Col,
  Statistic,
  Spin,
  Typography,
  Select,
  Empty,
} from "antd";
import {
  UsergroupAddOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const { Title } = Typography;

// --- MÀU SẮC BIỂU ĐỒ ---
const COLORS = {
  present: "#00C49F", // Xanh lá (Đi làm)
  absent: "#FF8042", // Cam (Vắng)
  missing: "#d9d9d9", // Xám (Chưa chấm)
};

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. Tải dữ liệu
  const fetchData = async () => {
    setLoading(true);
    try {
      const dateStr = selectedDate.format("YYYY-MM-DD");
      const res = await fetch(`/api/stats/daily?date=${dateStr}`);
      const data = await res.json();
      setRawData(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  // 2. Xử lý dữ liệu tổng hợp (Logic cốt lõi)
  const stats = useMemo(() => {
    // Định nghĩa các nhóm code
    const WORK_CODES = ["X", "XD", "CT", "LĐ", "XL", "LE", "LD"];
    // Các nhóm nghỉ để vẽ biểu đồ chi tiết
    const LEAVE_TYPES = {
      "Phép (100%)": ["F", "R", "L", "ĐC"],
      "Ốm/BHXH": ["Ô", "CÔ", "TS", "DS", "T", "CL"],
      "Không lương": ["RO"],
      "Vô lý do": ["O"],
    };

    // Helper đếm
    const getStatus = (emp: any) => {
      if (!emp.timesheets || emp.timesheets.length === 0) return "MISSING"; // Chưa chấm
      const code = emp.timesheets[0].attendanceCode.code;
      if (WORK_CODES.includes(code)) return "PRESENT"; // Đi làm
      return "ABSENT"; // Nghỉ
    };

    // A. Tổng hợp theo Nhà máy (Cho 3 cái Card)
    // Lấy danh sách nhà máy duy nhất
    const factoryMap = new Map();

    rawData.forEach((emp) => {
      const factoryId = emp.department?.factory?.id || 0;
      const factoryName = emp.department?.factory?.name || "Khác";

      if (!factoryMap.has(factoryId)) {
        factoryMap.set(factoryId, {
          id: factoryId,
          name: factoryName,
          total: 0,
          present: 0,
          absent: 0,
          missing: 0,
        });
      }

      const stat = factoryMap.get(factoryId);
      stat.total++;
      const status = getStatus(emp);
      if (status === "PRESENT") stat.present++;
      else if (status === "ABSENT") stat.absent++;
      else stat.missing++;
    });

    const factoryStats = Array.from(factoryMap.values());

    // B. Tổng hợp biểu đồ tròn (Toàn công ty)
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalMissing = 0;

    // C. Tổng hợp biểu đồ cột (Chi tiết lý do nghỉ)
    const absenceDetail: any = {
      "Phép (100%)": 0,
      "Ốm/BHXH": 0,
      "Không lương": 0,
      "Vô lý do": 0,
    };

    rawData.forEach((emp) => {
      const status = getStatus(emp);
      if (status === "PRESENT") totalPresent++;
      else if (status === "ABSENT") {
        totalAbsent++;
        // Phân loại nghỉ
        const code = emp.timesheets[0].attendanceCode.code;
        for (const [key, codes] of Object.entries(LEAVE_TYPES)) {
          if (codes.includes(code)) {
            absenceDetail[key]++;
            break;
          }
        }
      } else {
        totalMissing++;
      }
    });

    const pieData = [
      { name: "Đi làm", value: totalPresent, color: COLORS.present },
      { name: "Nghỉ", value: totalAbsent, color: COLORS.absent },
      { name: "Chưa chấm", value: totalMissing, color: COLORS.missing },
    ];

    // Chuyển object absenceDetail thành array cho Recharts
    const barData = Object.keys(absenceDetail).map((key) => ({
      name: key,
      value: absenceDetail[key],
    }));

    return { factoryStats, pieData, barData, totalEmployees: rawData.length };
  }, [rawData]);

  return (
    <AdminLayout>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          Dashboard Tổng quan
        </Title>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 600 }}>Ngày xem:</span>
          <DatePicker
            value={selectedDate}
            onChange={(d) => d && setSelectedDate(d)}
            format="DD/MM/YYYY"
            allowClear={false}
          />
        </div>
      </div>

      <Spin spinning={loading}>
        {/* 1. TOP CARDS - THỐNG KÊ THEO NHÀ MÁY */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {stats.factoryStats.map((f: any) => (
            <Col xs={24} sm={12} lg={8} key={f.id}>
              <Card
                title={f.name}
                headStyle={{ background: "#fafafa", fontWeight: "bold" }}
                hoverable
              >
                <Row gutter={16} style={{ textAlign: "center" }}>
                  <Col span={8}>
                    <Statistic
                      title="Tổng NV"
                      value={f.total}
                      valueStyle={{ fontSize: 18, fontWeight: "bold" }}
                      prefix={<UsergroupAddOutlined />}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Đi làm"
                      value={f.present}
                      valueStyle={{ color: "#3f8600", fontSize: 18 }}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Vắng"
                      value={f.absent}
                      valueStyle={{ color: "#cf1322", fontSize: 18 }}
                      prefix={<CloseCircleOutlined />}
                    />
                  </Col>
                </Row>
                {f.missing > 0 && (
                  <div
                    style={{
                      marginTop: 10,
                      textAlign: "center",
                      color: "#999",
                      fontSize: 12,
                    }}
                  >
                    ⚠️ Còn {f.missing} người chưa có dữ liệu chấm công
                  </div>
                )}
              </Card>
            </Col>
          ))}
        </Row>

        {/* 2. CHARTS SECTION */}
        {stats.totalEmployees > 0 ? (
          <Row gutter={[24, 24]}>
            {/* BIỂU ĐỒ TRÒN - TỶ LỆ ĐI LÀM */}
            <Col xs={24} lg={12}>
              <Card title="Tỷ lệ chuyên cần toàn công ty">
                <div style={{ width: "100%", height: 300 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={stats.pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) =>
                          // Thêm đoạn (percent || 0) để bảo đảm luôn là số
                          `${name} ${((percent || 0) * 100).toFixed(0)}%`
                        }
                      >
                        {stats.pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ReTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>

            {/* BIỂU ĐỒ CỘT - PHÂN TÍCH LÝ DO NGHỈ */}
            <Col xs={24} lg={12}>
              <Card title="Phân tích lý do vắng mặt">
                <div style={{ width: "100%", height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={stats.barData}
                      layout="vertical"
                      margin={{ left: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis dataKey="name" type="category" width={100} />
                      <ReTooltip />
                      <Bar
                        dataKey="value"
                        name="Số người"
                        fill="#8884d8"
                        barSize={30}
                      >
                        {stats.barData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              ["#2563eb", "#ca8a04", "#dc2626", "#000"][
                                index % 4
                              ]
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
          </Row>
        ) : (
          <Empty description="Chưa có dữ liệu" />
        )}
      </Spin>
    </AdminLayout>
  );
}
