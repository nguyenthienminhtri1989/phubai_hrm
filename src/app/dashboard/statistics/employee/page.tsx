"use client";

import React, { useEffect, useState } from "react";
import { 
  Card, 
  Row, 
  Col, 
  Spin, 
  message, 
  Typography, 
  Statistic 
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
import { TeamOutlined } from "@ant-design/icons";
import AdminLayout from "@/components/AdminLayout";

const { Title } = Typography;

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
}

export default function EmployeeStatisticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<EmployeeStats | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/statistics/employee");
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

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "100px 0" }}>
        <Spin size="large" tip="Đang tải dữ liệu thống kê..." />
      </div>
    );
  }

  const renderPieLabel = ({ name, percent }: { name?: string; percent?: number }) =>
    `${name ?? ""}: ${((percent ?? 0) * 100).toFixed(1)}%`;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Title level={3} style={{ margin: 0 }}>Thống Kê Lao Động</Title>
        </div>

        <Row gutter={[16, 16]}>
          {/* Card Tổng số */}
          <Col span={24}>
            <Card bordered={false} className="shadow-sm">
              <Statistic
                title="Tổng số lao động đang làm việc"
                value={stats?.total || 0}
                prefix={<TeamOutlined />}
                valueStyle={{ color: "#3f8600", fontSize: 32, fontWeight: 'bold' }}
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
      </div>
    </AdminLayout>
  );
}
