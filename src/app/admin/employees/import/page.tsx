"use client";
import React, { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation"; // Dùng để chuyển trang
import { Upload, Button, message, Card, Typography, Result } from "antd";
import { UploadOutlined, FileExcelOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

export default function ImportEmployeeInfoPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // --- [MỚI] KIỂM TRA QUYỀN ADMIN ---
  if (status === "loading") return <p>Đang tải...</p>;
  
  // Nếu chưa đăng nhập hoặc không phải ADMIN -> Chặn ngay
  if (!session || session.user.role !== "ADMIN") {
      return (
        <AdminLayout>
           <Result
              status="403"
              title="403"
              subTitle="Xin lỗi, chỉ Quản trị viên (Admin) mới có quyền truy cập trang này."
              extra={<Button type="primary" onClick={() => router.push("/")}>Về trang chủ</Button>}
           />
        </AdminLayout>
      );
  }
  // ----------------------------------

  const handleUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/employees/import-info", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        message.success(data.message);
        onSuccess("Ok");
      } else {
        message.error(data.error);
        onError({ error: data.error });
      }
    } catch (err) {
      message.error("Lỗi kết nối server");
      onError({ error: err });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <Title level={3}>Cập nhật thông tin bổ sung</Title>
      <Card style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ textAlign: "center", padding: 20 }}>
          <div style={{ marginBottom: 20 }}>
            <FileExcelOutlined style={{ fontSize: 48, color: "#217346" }} />
          </div>
          <Text type="secondary" style={{ display: "block", marginBottom: 20 }}>
            Upload file Excel chứa thông tin bổ sung (Ngày vào, CCCD, Số TK...).
            <br />Hệ thống sẽ tự động cập nhật dựa trên <b>Mã Nhân Viên</b>.
          </Text>

          <Upload
            customRequest={handleUpload}
            showUploadList={false}
            accept=".xlsx, .xls"
          >
            <Button 
                type="primary" 
                icon={<UploadOutlined />} 
                loading={loading}
                size="large"
            >
              Chọn file Excel để cập nhật
            </Button>
          </Upload>
        </div>
        
        <div style={{marginTop: 20, background: "#f5f5f5", padding: 10, borderRadius: 4}}>
            <b>Lưu ý cấu trúc file Excel:</b>
            <ul>
                <li>Cột A: Mã Nhân Viên (Bắt buộc để đối chiếu)</li>
                <li>Cột B: Tên (Chỉ để nhìn, không cập nhật)</li>
                <li>Cột C: Ngày vào làm</li>
                <li>Cột D: Số CCCD</li>
                <li>Cột E: Ngày cấp</li>
                <li>Cột F: Nơi cấp</li>
                <li>Cột G: Số tài khoản</li>
                <li>Cột H: Mã số thuế</li>
            </ul>
        </div>
      </Card>
    </AdminLayout>
  );
}