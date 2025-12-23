"use client";

import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Table, Tag, DatePicker, Select, Card, Button, Breadcrumb } from "antd";
import { ReloadOutlined, HomeOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import Link from "next/link";

// Kiểu dữ liệu (giống API trả về)
interface DeptStat {
  key: number;
  departmentName: string;
  factoryName: string;
  totalStaff: number;
  absentCount: number;
  absentRate: string;
}

export default function DepartmentDashboardPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DeptStat[]>([]);

  // State bộ lọc
  const [selectedFactory, setSelectedFactory] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());
  const [factories, setFactories] = useState<any[]>([]);

  // 1. Load danh sách nhà máy để làm bộ lọc
  useEffect(() => {
    fetch("/api/factories")
      .then((res) => res.json())
      .then(setFactories)
      .catch(console.error);
  }, []);

  // 2. Hàm lấy dữ liệu thống kê
  const fetchData = async () => {
    setLoading(true);
    try {
      const dateStr = selectedDate.format("YYYY-MM-DD");
      let url = `/api/dashboard?date=${dateStr}`; // Gọi vào API dashboard cũ
      if (selectedFactory) url += `&factoryId=${selectedFactory}`;

      const res = await fetch(url);
      const result = await res.json();

      // API trả về { stats: [...] }, ta lấy phần stats
      if (result.stats) {
        setData(result.stats);
      }
    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
    } finally {
      setLoading(false);
    }
  };

  // Gọi API khi thay đổi bộ lọc
  useEffect(() => {
    fetchData();
  }, [selectedFactory, selectedDate]);

  // 3. Cấu hình cột bảng
  const columns = [
    {
      title: "STT",
      key: "index",
      width: 60,
      align: "center" as const,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: "Phòng ban / Tổ",
      dataIndex: "departmentName",
      key: "departmentName",
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
      title: "Tổng định biên",
      dataIndex: "totalStaff",
      key: "totalStaff",
      align: "center" as const,
      render: (val: number) => <b style={{ fontSize: 15 }}>{val}</b>,
    },
    {
      title: "Vắng mặt",
      dataIndex: "absentCount",
      key: "absentCount",
      align: "center" as const,
      render: (val: number) => {
        if (val === 0) return <span style={{ color: "#ccc" }}>-</span>;
        return (
          <Tag color="error" style={{ fontSize: 14, padding: "4px 10px" }}>
            {val} người
          </Tag>
        );
      },
    },
    {
      title: "Tỷ lệ vắng",
      dataIndex: "absentRate",
      key: "absentRate",
      align: "right" as const,
      render: (val: string) => {
        const rate = parseFloat(val);
        // Logic tô màu: >10% là Đỏ, >0% là Cam, 0% là Xanh
        let color = "green";
        if (rate > 0) color = "orange";
        if (rate > 10) color = "red";

        return <span style={{ color, fontWeight: "bold" }}>{val}%</span>;
      },
    },
  ];

  return (
    <AdminLayout>
      {/* Breadcrumb cho chuyên nghiệp */}
      <Breadcrumb style={{ marginBottom: 16 }}>
        <Breadcrumb.Item href="/dashboard">
          <HomeOutlined /> Tổng quan
        </Breadcrumb.Item>
        <Breadcrumb.Item>Chi tiết theo Phòng ban</Breadcrumb.Item>
      </Breadcrumb>

      <Card title="Tình hình nhân sự theo Phòng ban - Bộ phận" bordered={false}>
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
          pagination={false} // Tắt phân trang để xem toàn bộ danh sách (scannable)
          bordered
          rowKey="key"
          scroll={{ y: 600 }} // Cố định chiều cao, cuộn nếu dài
          summary={(pageData) => {
            // Tính tổng cộng ở chân bảng (Footer)
            let totalStaff = 0;
            let totalAbsent = 0;
            pageData.forEach(({ totalStaff: t, absentCount: a }) => {
              totalStaff += t;
              totalAbsent += a;
            });

            return (
              <Table.Summary fixed>
                <Table.Summary.Row
                  style={{ background: "#fafafa", fontWeight: "bold" }}
                >
                  <Table.Summary.Cell index={0} colSpan={2} align="right">
                    TỔNG CỘNG TOÀN NHÀ MÁY:
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="center">
                    {totalStaff}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="center">
                    <span style={{ color: "red" }}>{totalAbsent} người</span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    {totalStaff > 0
                      ? ((totalAbsent / totalStaff) * 100).toFixed(1)
                      : 0}
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
