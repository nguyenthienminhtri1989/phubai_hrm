"use client";

import React, { useState } from "react";
import {
  Card,
  Button,
  Typography,
  Space,
  Alert,
  Tag,
  Progress,
  List,
} from "antd";
import {
  CloudDownloadOutlined,
  DatabaseOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import saveAs from "file-saver";
import { message } from "antd";

const { Title, Text } = Typography;

export default function SystemPage() {
  // --- STATE BACKUP ---
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);

  // ============================================================
  // BACKUP
  // ============================================================
  const handleBackup = async () => {
    setBackupLoading(true);
    setBackupProgress(10);
    const hide = message.loading("Đang tạo bản backup cơ sở dữ liệu...", 0);
    try {
      setBackupProgress(30);
      const res = await fetch("/api/system/backup");
      setBackupProgress(70);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Lỗi server khi tạo backup");
      }

      const blob = await res.blob();

      // Kiểm tra kích thước file - nếu quá nhỏ thì có thể bị lỗi
      if (blob.size < 100) {
        throw new Error("File backup có vẻ rỗng (dưới 100 bytes). Vui lòng kiểm tra log server.");
      }

      const dateStr = new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", "_")
        .replace(/:/g, "-");
      const filename = `backup_phubai_hrm_${dateStr}.sql`;
      saveAs(blob, filename);

      setBackupProgress(100);
      const now = new Date().toLocaleString("vi-VN");
      setLastBackupTime(now);
      message.success(
        `✅ Backup thành công! File: ${filename} (${(blob.size / 1024).toFixed(1)} KB)`
      );
    } catch (error: any) {
      message.error("❌ " + error.message);
      setBackupProgress(0);
    } finally {
      hide();
      setBackupLoading(false);
      setTimeout(() => setBackupProgress(0), 2000);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* HEADER */}
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            <DatabaseOutlined /> Quản lý hệ thống
          </Title>
          <Text type="secondary">
            Sao lưu cơ sở dữ liệu PostgreSQL — Chỉ dành cho Quản trị viên
          </Text>
        </div>

        <Alert
          message="Lưu ý quan trọng"
          description="Hãy thực hiện Backup định kỳ trước khi import dữ liệu hoặc thay đổi cấu hình hệ thống. Việc khôi phục (restore) cơ sở dữ liệu phải được thực hiện thủ công trực tiếp trên server bởi quản trị viên — không thực hiện qua giao diện phần mềm để tránh rủi ro mất/hỏng dữ liệu và bảo mật."
          type="warning"
          showIcon
          icon={<WarningOutlined />}
        />

        {/* ===================== BACKUP SECTION ===================== */}
        <Card
          title={
            <Space>
              <CloudDownloadOutlined style={{ color: "#1677ff", fontSize: 18 }} />
              <span>Sao lưu cơ sở dữ liệu (Backup)</span>
              <Tag color="blue">pg_dump</Tag>
            </Space>
          }
          bordered
        >
          <Space direction="vertical" style={{ width: "100%" }} size="middle">
            <List
              size="small"
              dataSource={[
                "Xuất toàn bộ dữ liệu ra file .sql (định dạng plain text SQL)",
                "Sử dụng pg_dump — công cụ sao lưu chính thức của PostgreSQL 17",
                "File được tải về máy tính của bạn ngay lập tức",
              ]}
              renderItem={(item) => (
                <List.Item>
                  <CheckCircleOutlined style={{ color: "#52c41a", marginRight: 8 }} />
                  {item}
                </List.Item>
              )}
            />

            {backupProgress > 0 && backupProgress < 100 && (
              <Progress percent={backupProgress} status="active" />
            )}
            {backupProgress === 100 && (
              <Progress percent={100} status="success" />
            )}

            {lastBackupTime && (
              <Alert
                message={`Backup gần nhất: ${lastBackupTime}`}
                type="success"
                showIcon
              />
            )}

            <Button
              type="primary"
              size="large"
              icon={<CloudDownloadOutlined />}
              loading={backupLoading}
              onClick={handleBackup}
              style={{ width: "100%", height: 48 }}
            >
              {backupLoading ? "Đang tạo backup..." : "Tải xuống Backup (.sql)"}
            </Button>
          </Space>
        </Card>

      </Space>
    </div>
  );
}
