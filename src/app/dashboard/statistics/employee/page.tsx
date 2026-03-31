"use client";

import React, { useEffect, useState } from "react";
import { 
  Card, 
  Row, 
  Col, 
  Spin, 
  message, 
  Typography, 
  Statistic,
  DatePicker,
  Button,
  Space,
  Tag,
} from "antd";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TeamOutlined, FilterOutlined, ReloadOutlined } from "@ant-design/icons";
import AdminLayout from "@/components/AdminLayout";
import dayjs, { Dayjs } from "dayjs";

const { Title } = Typography;
const { RangePicker } = DatePicker;

const COLORS = ["#0088FE", "#FF8042", "#FFBB28"];
const BAR_COLORS = ["#1890ff", "#13c2c2", "#52c41a", "#faad14", "#f5222d", "#8c8c8c"];

interface ChartDataItem {
  name: string;
  value: number;
  [key: string]: unknown;
}

interface EmployeeStats {
  total: number;
  genderData: ChartDataItem[];
  ageData: ChartDataItem[];
  filterApplied?: boolean;
}

export default function EmployeeStatisticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [appliedRange, setAppliedRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);

  const fetchStats = async (fromDate?: string, toDate?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      const url = `/api/statistics/employee${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Không thể tải dữ liệu thống kê");
      }
      const data = await res.json();
      setStats(data);
    } catch (error: unknown) {
      const err = error as { message?: string };
      message.error(err.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleFilter = () => {
    const [from, to] = dateRange;
    setAppliedRange(dateRange);
    fetchStats(
      from ? from.format("YYYY-MM-DD") : undefined,
      to ? to.format("YYYY-MM-DD") : undefined
    );
  };

  const handleReset = () => {
    setDateRange([null, null]);
    setAppliedRange([null, null]);
    fetchStats();
  };

  const renderPieLabel = ({ name, percent }: { name?: string; percent?: number }) =>
    `${name ?? ""}: ${((percent ?? 0) * 100).toFixed(1)}%`;

  const isFiltered = appliedRange[0] !== null || appliedRange[1] !== null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header + Bộ lọc */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Title level={3} style={{ margin: 0 }}>Thống Kê Lao Động</Title>
          </div>

          {/* Filter card */}
          <Card bordered={false} className="shadow-sm" style={{ background: "#fafafa" }}>
            <Space wrap size="middle" align="center">
              <span style={{ fontWeight: 500, color: "#555" }}>
                <FilterOutlined style={{ marginRight: 6 }} />
                Lọc theo ngày vào làm:
              </span>
              <RangePicker
                value={dateRange}
                onChange={(dates) =>
                  setDateRange(dates ? [dates[0], dates[1]] : [null, null])
                }
                format="DD/MM/YYYY"
                placeholder={["Từ ngày", "Đến ngày"]}
                allowClear
                style={{ width: 280 }}
              />
              <Button
                type="primary"
                icon={<FilterOutlined />}
                onClick={handleFilter}
              >
                Lọc
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleReset}
                disabled={!isFiltered && !dateRange[0]}
              >
                Đặt lại
              </Button>
              {isFiltered && (
                <Tag color="blue" style={{ fontSize: 13 }}>
                  {appliedRange[0]?.format("DD/MM/YYYY")} – {appliedRange[1]?.format("DD/MM/YYYY")}
                </Tag>
              )}
            </Space>
          </Card>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
            <Spin size="large" tip="Đang tải dữ liệu thống kê..." />
          </div>
        ) : (
          <Row gutter={[16, 16]}>
            {/* Card Tổng số */}
            <Col span={24}>
              <Card bordered={false} className="shadow-sm">
                <Statistic
                  title={
                    isFiltered
                      ? `Tổng số lao động vào làm từ ${appliedRange[0]?.format("DD/MM/YYYY")} đến ${appliedRange[1]?.format("DD/MM/YYYY")}`
                      : "Tổng số lao động đang làm việc"
                  }
                  value={stats?.total || 0}
                  prefix={<TeamOutlined />}
                  valueStyle={{ color: "#3f8600", fontSize: 32, fontWeight: "bold" }}
                />
              </Card>
            </Col>

            {/* Biểu đồ Giới tính */}
            <Col xs={24} md={12}>
              <Card title="Phân bố theo Giới tính" bordered={false} className="shadow-sm" style={{ height: "400px" }}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats?.genderData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={renderPieLabel}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {stats?.genderData?.map((_entry: ChartDataItem, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value) => [`${value} người`, "Số lượng"]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>

            {/* Biểu đồ Độ tuổi */}
            <Col xs={24} md={12}>
              <Card title="Phân bố theo Nhóm tuổi" bordered={false} className="shadow-sm" style={{ height: "400px" }}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={stats?.ageData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <RechartsTooltip formatter={(value) => [`${value} người`, "Số lượng"]} />
                    <Bar dataKey="value" name="Số lượng">
                      {stats?.ageData?.map((_entry: ChartDataItem, index: number) => (
                        <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>
        )}
      </div>
    </AdminLayout>
  );
}
