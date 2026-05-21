"use client";

import React, { useEffect, useState } from "react";
import { Button, Card, Divider, Form, Input, message, Select, Typography } from "antd";
import { LockOutlined, UserOutlined, IdcardOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";

const { Title, Text } = Typography;

type RegisterFormValues = {
  fullName: string;
  username: string;
  password: string;
  confirmPassword: string;
  employeeCode?: string;
  factoryId: number;
  departmentId: number;
  kipId?: number;
};

type FactoryOption = {
  id: number;
  name: string;
};

type DepartmentOption = {
  id: number;
  name: string;
  isKip: boolean;
  factory?: FactoryOption;
};

type KipOption = {
  id: number;
  name: string;
  factoryId: number;
};

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [factories, setFactories] = useState<FactoryOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [kips, setKips] = useState<KipOption[]>([]);
  const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(null);
  const [selectedDeptIsKip, setSelectedDeptIsKip] = useState(false);
  const [form] = Form.useForm<RegisterFormValues>();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetch("/api/departments"), fetch("/api/kips")])
      .then(([deptRes, kipRes]) => {
        if (!deptRes.ok || !kipRes.ok) {
          throw new Error("Không thể tải danh sách công tác");
        }
        return Promise.all([deptRes.json(), kipRes.json()]);
      })
      .then(([deptData, kipData]) => {
        if (cancelled) return;

        const depts = deptData as DepartmentOption[];
        const facs = Array.from(
          new Map(
            depts
              .filter((dept) => dept.factory)
              .map((dept) => [dept.factory!.id, dept.factory!] as const),
          ).values(),
        );

        setFactories(facs);
        setDepartments(depts);
        setKips(kipData as KipOption[]);
      })
      .catch(() => {
        if (!cancelled) {
          message.error("Không thể tải danh sách nhà máy, phòng ban");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const onFinish = async (values: RegisterFormValues) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: values.fullName.trim(),
          username: values.username.trim().toLowerCase(),
          password: values.password,
          employeeCode: values.employeeCode?.trim() || undefined,
          departmentId: values.departmentId,
          kipId: values.kipId || null,
        }),
      });

      if (res.ok) {
        message.success("Đã gửi yêu cầu đăng ký.");
        router.push("/pending");
        return;
      }

      const data = await res.json().catch(() => ({}));
      message.error(data.error || "Không thể đăng ký tài khoản");
    } catch {
      message.error("Lỗi kết nối server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background:
          "linear-gradient(135deg, #f4f8fb 0%, #dcebf7 45%, #eef5e8 100%)",
      }}
    >
      <Card
        style={{
          width: "100%",
          maxWidth: 440,
          borderRadius: 8,
          boxShadow: "0 8px 24px rgba(22, 58, 82, 0.14)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 4 }}>
            PHÚ BÀI HRM
          </Title>
          <Text type="secondary">Đăng ký tài khoản</Text>
        </div>

        <Form
          form={form}
          name="register"
          layout="vertical"
          size="large"
          onFinish={onFinish}
          autoComplete="off"
        >
          <Form.Item
            name="fullName"
            label="Họ và tên"
            rules={[
              { required: true, message: "Vui lòng nhập họ và tên" },
              { min: 2, message: "Họ và tên phải từ 2 ký tự" },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="Nguyễn Văn A" />
          </Form.Item>

          <Form.Item
            name="username"
            label="Tên đăng nhập"
            extra="Chữ thường, số hoặc dấu gạch dưới, không khoảng trắng"
            normalize={(value) =>
              typeof value === "string" ? value.trim().toLowerCase() : value
            }
            rules={[
              { required: true, message: "Vui lòng nhập tên đăng nhập" },
              { min: 3, message: "Tên đăng nhập phải từ 3 ký tự" },
              {
                pattern: /^[a-z0-9_]+$/,
                message: "Tên đăng nhập chỉ gồm a-z, 0-9 và dấu gạch dưới",
              },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="nguyenvana" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Mật khẩu"
            rules={[
              { required: true, message: "Vui lòng nhập mật khẩu" },
              { min: 6, message: "Mật khẩu phải từ 6 ký tự" },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Tối thiểu 6 ký tự"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Xác nhận mật khẩu"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Vui lòng xác nhận mật khẩu" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Mật khẩu xác nhận không khớp"));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Nhập lại mật khẩu"
            />
          </Form.Item>

          <Form.Item
            name="employeeCode"
            label="Mã nhân viên"
            extra="Không bắt buộc, dùng để Admin duyệt nhanh hơn"
          >
            <Input prefix={<IdcardOutlined />} placeholder="NV001" allowClear />
          </Form.Item>

          <Divider titlePlacement="left" style={{ fontSize: 13 }}>
            Thông tin công tác
          </Divider>

          <Form.Item
            name="factoryId"
            label="Nhà máy"
            rules={[{ required: true, message: "Vui lòng chọn nhà máy" }]}
          >
            <Select
              placeholder="Chọn nhà máy"
              options={factories.map((factory) => ({
                value: factory.id,
                label: factory.name,
              }))}
              onChange={(value) => {
                setSelectedFactoryId(value);
                setSelectedDeptIsKip(false);
                form.setFieldsValue({ departmentId: undefined, kipId: undefined });
              }}
            />
          </Form.Item>

          <Form.Item
            name="departmentId"
            label="Phòng ban / Tổ"
            rules={[{ required: true, message: "Vui lòng chọn phòng ban" }]}
          >
            <Select
              placeholder="Chọn phòng ban"
              disabled={!selectedFactoryId}
              options={departments
                .filter((department) => department.factory?.id === selectedFactoryId)
                .map((department) => ({
                  value: department.id,
                  label: department.name,
                }))}
              onChange={(val) => {
                const dept = departments.find((d) => d.id === val);
                setSelectedDeptIsKip(dept?.isKip || false);
                form.setFieldsValue({ kipId: undefined });
              }}
            />
          </Form.Item>

          {/* Chỉ hiện khi phòng ban có isKip = true */}
          {selectedDeptIsKip && (
            <Form.Item name="kipId" label="Kíp">
              <Select
                placeholder="Chọn kíp (nếu có)"
                allowClear
                options={kips
                  .filter((k) => k.factoryId === selectedFactoryId)
                  .map((k) => ({ value: k.id, label: k.name }))}
              />
            </Form.Item>
          )}

          <Form.Item style={{ marginBottom: 12 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Gửi yêu cầu đăng ký
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: "center" }}>
          Đã có tài khoản? <Link href="/login">Đăng nhập</Link>
        </div>
      </Card>
    </div>
  );
}
