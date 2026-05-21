"use client";

import React, { useEffect, useState } from "react";
import {
  Button,
  Modal,
  Form,
  Input,
  Upload,
  message,
  Empty,
  Spin,
  Image,
  Tag,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  NotificationOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useSession } from "next-auth/react";
import AdminLayout from "@/components/AdminLayout";
import dayjs from "dayjs";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Quản trị viên",
  HR_MANAGER: "Quản lý nhân sự",
  TIMEKEEPER: "Người chấm công",
  LEADER: "Ban lãnh đạo",
  STAFF: "Nhân viên",
};

interface Announcement {
  id: number;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  author: { fullName: string | null; role: string };
}

export default function AnnouncementsPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const canManage = ["ADMIN", "HR_MANAGER"].includes(role || "");

  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // File ảnh được chọn (chưa upload)
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/announcements?page=1&limit=50");
      const data = await res.json();
      if (res.ok) setList(data.items || []);
      else message.error(data.error || "Lỗi tải dữ liệu");
    } catch {
      message.error("Lỗi kết nối server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleChooseFile = (f: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      message.error("Chỉ chấp nhận JPG, PNG, WEBP");
      return false;
    }
    if (f.size > 5 * 1024 * 1024) {
      message.error("Ảnh tối đa 5MB");
      return false;
    }
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
    return false; // ngăn auto-upload của antd
  };

  const handleRemoveFile = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
  };

  const resetForm = () => {
    form.resetFields();
    handleRemoveFile();
  };

  const handleSubmit = async (values: { title: string; content: string }) => {
    setSubmitting(true);
    try {
      let imageUrl: string | null = null;

      // 1. Upload ảnh trước (nếu có)
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const upRes = await fetch("/api/announcements/upload", {
          method: "POST",
          body: fd,
        });
        const upData = await upRes.json();
        if (!upRes.ok) {
          message.error(upData.error || "Lỗi upload ảnh");
          setSubmitting(false);
          return;
        }
        imageUrl = upData.url;
      }

      // 2. Tạo thông báo
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || "Lỗi đăng thông báo");
        return;
      }

      message.success("Đăng thông báo thành công!");
      setOpen(false);
      resetForm();
      fetchList();
    } catch {
      message.error("Lỗi kết nối server");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: "Xác nhận xóa",
      content: "Bạn có chắc muốn xóa thông báo này không? Hành động này không thể hoàn tác.",
      okText: "Xóa",
      okType: "danger",
      cancelText: "Hủy",
      onOk: async () => {
        try {
          const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (!res.ok) {
            message.error(data.error || "Lỗi xóa");
            return;
          }
          message.success("Đã xóa thông báo");
          fetchList();
        } catch {
          message.error("Lỗi kết nối server");
        }
      },
    });
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            <NotificationOutlined style={{ color: "#f5222d", marginRight: 10 }} />
            Thông báo nội bộ
          </h1>
          {canManage && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setOpen(true)}
            >
              Đăng thông báo
            </Button>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : list.length === 0 ? (
          <Empty description="Chưa có thông báo nào" style={{ padding: 60 }} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {list.map((a) => (
              <div
                key={a.id}
                style={{
                  background: "#fff",
                  borderRadius: 8,
                  borderLeft: "4px solid #f5222d",
                  padding: 20,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                      📢 {a.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
                      {a.author?.fullName || "Ẩn danh"}{" "}
                      <Tag color="blue" style={{ marginLeft: 4, fontSize: 11 }}>
                        {ROLE_LABELS[a.author?.role] || a.author?.role}
                      </Tag>
                      · {dayjs(a.createdAt).format("HH:mm · DD/MM/YYYY")}
                    </div>
                    <div
                      style={{
                        whiteSpace: "pre-wrap",
                        fontSize: 14,
                        lineHeight: 1.6,
                        color: "#333",
                      }}
                    >
                      {a.content}
                    </div>
                    {a.imageUrl && (
                      <div style={{ marginTop: 12 }}>
                        <Image
                          src={a.imageUrl}
                          alt={a.title}
                          style={{
                            maxHeight: 400,
                            objectFit: "cover",
                            borderRadius: 6,
                          }}
                        />
                      </div>
                    )}
                  </div>
                  {canManage && (
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleDelete(a.id)}
                    >
                      Xóa
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal đăng */}
        <Modal
          title="Đăng thông báo mới"
          open={open}
          onCancel={() => {
            setOpen(false);
            resetForm();
          }}
          onOk={() => form.submit()}
          confirmLoading={submitting}
          okText="Đăng thông báo"
          cancelText="Hủy"
          width={600}
          destroyOnHidden
        >
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              name="title"
              label="Tiêu đề"
              rules={[
                { required: true, message: "Vui lòng nhập tiêu đề" },
                { min: 2, message: "Tiêu đề tối thiểu 2 ký tự" },
              ]}
            >
              <Input placeholder="VD: Thông báo nghỉ lễ 30/4" maxLength={200} />
            </Form.Item>

            <Form.Item
              name="content"
              label="Nội dung"
              rules={[
                { required: true, message: "Vui lòng nhập nội dung" },
                { min: 5, message: "Nội dung tối thiểu 5 ký tự" },
              ]}
            >
              <Input.TextArea rows={5} placeholder="Nhập nội dung thông báo..." />
            </Form.Item>

            <Form.Item label="Đính kèm ảnh (không bắt buộc)">
              <Upload
                accept="image/jpeg,image/png,image/webp"
                beforeUpload={handleChooseFile}
                showUploadList={false}
                maxCount={1}
              >
                <Button icon={<UploadOutlined />}>Chọn ảnh</Button>
              </Upload>
              <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                JPG/PNG/WEBP, tối đa 5MB
              </div>
              {preview && (
                <div style={{ marginTop: 12, position: "relative", display: "inline-block" }}>
                  <img
                    src={preview}
                    alt="preview"
                    style={{
                      maxHeight: 200,
                      maxWidth: "100%",
                      borderRadius: 6,
                      border: "1px solid #eee",
                    }}
                  />
                  <Button
                    size="small"
                    danger
                    style={{ position: "absolute", top: 6, right: 6 }}
                    onClick={handleRemoveFile}
                  >
                    Bỏ ảnh
                  </Button>
                </div>
              )}
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AdminLayout>
  );
}
