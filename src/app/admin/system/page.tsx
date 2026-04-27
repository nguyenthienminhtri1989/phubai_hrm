"use client";

import React, { useState } from "react";
import {
  Card,
  Button,
  Upload,
  Typography,
  Space,
  Alert,
  Divider,
  Tag,
  Modal,
  Progress,
  List,
} from "antd";
import {
  CloudDownloadOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import type { UploadFile, UploadProps } from "antd";
import saveAs from "file-saver";
import { message } from "antd";

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

export default function SystemPage() {
  // --- STATE BACKUP ---
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);

  // --- STATE RESTORE ---
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);

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

  // ============================================================
  // RESTORE
  // ============================================================
  const uploadProps: UploadProps = {
    name: "file",
    multiple: false,
    accept: ".sql",
    fileList,
    beforeUpload: (file) => {
      if (!file.name.endsWith(".sql")) {
        message.error("Chỉ chấp nhận file .sql!");
        return Upload.LIST_IGNORE;
      }
      setSelectedFile(file);
      setFileList([
        {
          uid: "-1",
          name: file.name,
          status: "done",
          size: file.size,
        },
      ]);
      return false; // Không upload tự động
    },
    onRemove: () => {
      setSelectedFile(null);
      setFileList([]);
    },
  };

  const handleRestoreConfirm = () => {
    if (!selectedFile) {
      message.warning("Vui lòng chọn file SQL trước!");
      return;
    }
    setRestoreConfirmOpen(true);
  };

  const handleRestoreExecute = async () => {
    if (!selectedFile) return;
    setRestoreConfirmOpen(false);
    setRestoreLoading(true);
    const hide = message.loading("Đang khôi phục cơ sở dữ liệu...", 0);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch("/api/system/restore", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi server khi restore");

      message.success("✅ Khôi phục dữ liệu thành công! Trang sẽ tải lại sau 2 giây.");
      setSelectedFile(null);
      setFileList([]);
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      message.error("❌ Lỗi khôi phục: " + error.message);
    } finally {
      hide();
      setRestoreLoading(false);
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
            Sao lưu và khôi phục cơ sở dữ liệu PostgreSQL — Chỉ dành cho Quản trị viên
          </Text>
        </div>

        <Alert
          message="Lưu ý quan trọng"
          description="Hãy thực hiện Backup định kỳ trước khi import dữ liệu hoặc thay đổi cấu hình hệ thống. Chức năng Restore sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại."
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

        <Divider />

        {/* ===================== RESTORE SECTION ===================== */}
        <Card
          title={
            <Space>
              <CloudUploadOutlined style={{ color: "#fa8c16", fontSize: 18 }} />
              <span>Khôi phục cơ sở dữ liệu (Restore)</span>
              <Tag color="orange">psql</Tag>
            </Space>
          }
          bordered
        >
          <Space direction="vertical" style={{ width: "100%" }} size="middle">
            <Alert
              message="⚠️ CẢNH BÁO: Restore sẽ ghi đè toàn bộ dữ liệu hiện tại!"
              description="Đảm bảo bạn đã có bản backup mới nhất trước khi thực hiện thao tác này. Quá trình không thể hoàn tác."
              type="error"
              showIcon
            />

            <Dragger {...uploadProps} style={{ padding: "12px 0" }}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">
                Kéo thả file .sql vào đây hoặc click để chọn
              </p>
              <p className="ant-upload-hint">
                Chỉ chấp nhận file .sql từ pg_dump
              </p>
            </Dragger>

            {selectedFile && (
              <Alert
                message={`Đã chọn file: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`}
                type="info"
                showIcon
              />
            )}

            <Button
              danger
              size="large"
              icon={<CloudUploadOutlined />}
              loading={restoreLoading}
              onClick={handleRestoreConfirm}
              disabled={!selectedFile}
              style={{ width: "100%", height: 48 }}
            >
              {restoreLoading ? "Đang khôi phục..." : "Khôi phục từ file đã chọn"}
            </Button>
          </Space>
        </Card>
      </Space>

      {/* MODAL XÁC NHẬN RESTORE */}
      <Modal
        title={
          <Space>
            <WarningOutlined style={{ color: "#ff4d4f" }} />
            <span>Xác nhận khôi phục dữ liệu</span>
          </Space>
        }
        open={restoreConfirmOpen}
        onOk={handleRestoreExecute}
        onCancel={() => setRestoreConfirmOpen(false)}
        okText="Đồng ý, tiến hành Restore"
        cancelText="Hủy bỏ"
        okButtonProps={{ danger: true }}
      >
        <Paragraph>
          Bạn sắp khôi phục cơ sở dữ liệu từ file:
        </Paragraph>
        <Paragraph strong style={{ color: "#1677ff" }}>
          📄 {selectedFile?.name}
        </Paragraph>
        <Paragraph type="danger">
          ⚠️ Thao tác này sẽ <strong>GHI ĐÈ TOÀN BỘ</strong> dữ liệu hiện tại và không thể hoàn tác. Bạn có chắc chắn muốn tiếp tục?
        </Paragraph>
      </Modal>
    </div>
  );
}
