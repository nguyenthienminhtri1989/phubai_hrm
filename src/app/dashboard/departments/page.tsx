"use client";

import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Table, Tag, DatePicker, Select, Card, Button, Breadcrumb } from "antd";
import {
  ReloadOutlined,
  HomeOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

interface DeptStat {
  key: number;
  departmentName: string;
  factoryName: string;
  totalStaff: number;
  absentCount: number;
  absentRate: string;
  timekeepingCount: number;
  percent: number;
  status: "PENDING" | "PROCESSING" | "DONE";
}

export default function DepartmentDashboardPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DeptStat[]>([]);

  // State bộ lọc
  const [selectedFactory, setSelectedFactory] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());
  const [factories, setFactories] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/factories")
      .then((res) => res.json())
      .then(setFactories)
      .catch(console.error);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const dateStr = selectedDate.format("YYYY-MM-DD");
      let url = `/api/dashboard?date=${dateStr}`;
      if (selectedFactory) url += `&factoryId=${selectedFactory}`;

      const res = await fetch(url);
      const result = await res.json();

      if (result.stats) {
        setData(result.stats);
      }
    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedFactory, selectedDate]);

  // --- CẤU HÌNH CỘT (Đã bỏ cột Tiến độ) ---
  const columns = [
    {
      title: "STT",
      key: "index",
      width: 50,
      align: "center" as const,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: "Phòng ban / Tổ",
      dataIndex: "departmentName",
      key: "departmentName",
      width: 280, // Tăng chiều rộng một chút cho thoải mái
      render: (text: string, record: DeptStat) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{text}</div>
          <div style={{ fontSize: 12, color: "#888" }}>
            {record.factoryName}
          </div>
        </div>
      ),
    },
    {
      title: "Tổng NS",
      dataIndex: "totalStaff",
      key: "totalStaff",
      align: "center" as const,
      width: 90,
      render: (val: number) => <b style={{ fontSize: 15 }}>{val}</b>,
    },
    {
      title: "Trạng thái",
      key: "status",
      align: "center" as const,
      width: 150,
      render: (_: any, record: DeptStat) => {
        if (record.status === "DONE") {
          return (
            <Tag icon={<CheckCircleOutlined />} color="success">
              Hoàn thành
            </Tag>
          );
        }
        if (record.status === "PROCESSING") {
          // Hiển thị thêm số lượng đã chấm để rõ hơn
          return (
            <Tag icon={<SyncOutlined spin />} color="processing">
              Đang chấm ({record.timekeepingCount}/{record.totalStaff})
            </Tag>
          );
        }
        return (
          <Tag icon={<ClockCircleOutlined />} color="red">
            Chưa chấm
          </Tag>
        );
      },
    },
    {
      title: "Vắng",
      dataIndex: "absentCount",
      key: "absentCount",
      align: "center" as const,
      width: 90,
      render: (val: number) => {
        if (val === 0) return <span style={{ color: "#ccc" }}>-</span>;
        return (
          <Tag color="error" style={{ fontSize: 14, padding: "4px 10px" }}>
            {val}
          </Tag>
        );
      },
    },
    {
      title: "% Vắng",
      dataIndex: "absentRate",
      key: "absentRate",
      align: "right" as const,
      width: 100,
      render: (val: string) => {
        const rate = parseFloat(val);
        let color = "green";
        if (rate > 0) color = "orange";
        if (rate > 10) color = "red";
        return <span style={{ color, fontWeight: "bold" }}>{val}%</span>;
      },
    },
  ];

  return (
    <AdminLayout>
      <Breadcrumb style={{ marginBottom: 16 }}>
        <Breadcrumb.Item href="/dashboard">
          <HomeOutlined /> Tổng quan
        </Breadcrumb.Item>
        <Breadcrumb.Item>Chi tiết theo Phòng ban</Breadcrumb.Item>
      </Breadcrumb>

      <Card title="Tình hình nhân sự theo Bộ phận" bordered={false}>
        {/* THANH BỘ LỌC */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontWeight: 500, marginBottom: 5 }}>Chọn ngày:</div>
            <DatePicker
              value={selectedDate}
              onChange={(val) => val && setSelectedDate(val)}
              allowClear={false}
              format="DD/MM/YYYY"
              style={{ width: 150 }}
            />
          </div>

          <div>
            <div style={{ fontWeight: 500, marginBottom: 5 }}>Nhà máy:</div>
            <Select
              placeholder="Tất cả nhà máy"
              style={{ width: 200 }}
              allowClear
              options={factories.map((f) => ({ label: f.name, value: f.id }))}
              onChange={setSelectedFactory}
            />
          </div>

          <div style={{ display: "flex", alignItems: "end" }}>
            <Button icon={<ReloadOutlined />} onClick={fetchData}>
              Làm mới
            </Button>
          </div>
        </div>

        {/* BẢNG DỮ LIỆU */}
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={false}
          bordered
          rowKey="key"
          scroll={{ y: 600 }}
          summary={(pageData) => {
            let totalStaff = 0;
            let totalAbsent = 0;
            let totalChecked = 0;

            pageData.forEach((item) => {
              totalStaff += item.totalStaff;
              totalAbsent += item.absentCount;
              totalChecked += item.timekeepingCount;
            });

            return (
              <Table.Summary fixed>
                <Table.Summary.Row
                  style={{ background: "#fafafa", fontWeight: "bold" }}
                >
                  {/* Cột STT + Tên bộ phận */}
                  <Table.Summary.Cell index={0} colSpan={2} align="right">
                    TỔNG CỘNG:
                  </Table.Summary.Cell>

                  {/* Cột Tổng NS */}
                  <Table.Summary.Cell index={1} align="center">
                    {totalStaff}
                  </Table.Summary.Cell>

                  {/* Cột Trạng thái (Tổng hợp) */}
                  <Table.Summary.Cell index={2} align="center">
                    <span style={{ color: "#1890ff" }}>
                      {totalChecked}/{totalStaff} đã chấm
                    </span>
                  </Table.Summary.Cell>

                  {/* Cột Vắng */}
                  <Table.Summary.Cell index={3} align="center">
                    <span style={{ color: "red" }}>{totalAbsent}</span>
                  </Table.Summary.Cell>

                  {/* Cột % Vắng */}
                  <Table.Summary.Cell index={4} align="right">
                    {totalStaff > 0
                      ? ((totalAbsent / totalStaff) * 100).toFixed(1)
                      : 0}{" "}
                    %
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Card>
    </AdminLayout>
  );
}
