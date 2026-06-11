"use client";

import React, { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useSession } from "next-auth/react";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
  type TableProps,
} from "antd";
import {
  FilterOutlined,
  ReloadOutlined,
  SearchOutlined,
  SwapOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

interface Factory {
  id: number;
  code?: string;
  name: string;
}

interface Department {
  id: number;
  code: string;
  name: string;
  isKip: boolean;
  factory?: Factory;
  factoryId?: number;
}

interface Kip {
  id: number;
  name: string;
  factoryId: number;
  factory?: Factory;
}

interface Employee {
  id: number;
  code: string;
  fullName: string;
  position?: string | null;
  department?: Department;
  kip?: Kip | null;
}

interface DeptOption {
  value: string;
  label: string;
  type: "SECTION" | "DEPT";
  isKip: boolean;
}

const MATRIX_FACTORY_IDS = [1, 2, 3];
const TRANSFER_ROLES = ["ADMIN", "HR_MANAGER", "TIMEKEEPER", "STAFF"];

function getFactoryId(department?: Department) {
  return department?.factory?.id || department?.factoryId || null;
}

function getKipNumber(text?: string | null) {
  return text?.match(/\d+/)?.[0] || null;
}

function getSectionName(name: string) {
  return name
    .replace(/(kip|kíp|ca)\s*\d+.*$/gi, "")
    .replace(/-+.*$/gi, "")
    .trim();
}

function buildDeptOptions(departments: Department[], factoryId: number | null) {
  if (!factoryId) return [];

  const isMatrix = MATRIX_FACTORY_IDS.includes(factoryId);
  const options: DeptOption[] = [];
  const processedSections = new Set<string>();

  departments
    .filter((department) => getFactoryId(department) === factoryId)
    .forEach((department) => {
      const matrixRegex = new RegExp(`^${factoryId}([a-zA-Z]+)(\\d+)$`);
      const match = department.code?.match(matrixRegex);

      if (isMatrix && department.isKip && match) {
        const sectionCode = match[1];
        if (!processedSections.has(sectionCode)) {
          options.push({
            value: `SECTION:${sectionCode}`,
            label: getSectionName(department.name),
            type: "SECTION",
            isKip: true,
          });
          processedSections.add(sectionCode);
        }
        return;
      }

      options.push({
        value: `DEPT:${department.id}`,
        label: department.name,
        type: "DEPT",
        isKip: Boolean(department.isKip),
      });
    });

  return options.sort((a, b) => a.label.localeCompare(b.label));
}

function resolveDepartmentIds(
  departments: Department[],
  kips: Kip[],
  factoryId: number | null,
  deptValues: string[],
  kipIds: number[],
) {
  if (!factoryId || deptValues.length === 0) return [];

  const targetKipNumbers = kips
    .filter((kip) => kipIds.includes(kip.id))
    .map((kip) => getKipNumber(kip.name))
    .filter(Boolean) as string[];

  const ids: number[] = [];

  deptValues.forEach((value) => {
    if (value.startsWith("DEPT:")) {
      const id = Number(value.split(":")[1]);
      if (Number.isInteger(id)) ids.push(id);
      return;
    }

    if (value.startsWith("SECTION:")) {
      const sectionCode = value.split(":")[1];
      const sectionRegex = new RegExp(`^${factoryId}${sectionCode}(\\d+)$`);

      departments.forEach((department) => {
        if (!department.isKip || getFactoryId(department) !== factoryId) return;
        const match = department.code?.match(sectionRegex);
        if (!match) return;

        const deptKipNumber = match[1];
        if (targetKipNumbers.length === 0 || targetKipNumbers.includes(deptKipNumber)) {
          ids.push(department.id);
        }
      });
    }
  });

  return Array.from(new Set(ids));
}

function resolveTargetDepartmentId(
  departments: Department[],
  kips: Kip[],
  factoryId: number | null,
  deptValue: string | null,
  kipId: number | null,
) {
  if (!factoryId || !deptValue) return null;

  if (deptValue.startsWith("DEPT:")) {
    const id = Number(deptValue.split(":")[1]);
    return Number.isInteger(id) ? id : null;
  }

  if (!deptValue.startsWith("SECTION:") || !kipId) return null;

  const sectionCode = deptValue.split(":")[1];
  const selectedKipNumber = getKipNumber(kips.find((kip) => kip.id === kipId)?.name);
  if (!selectedKipNumber) return null;

  const sectionRegex = new RegExp(`^${factoryId}${sectionCode}${selectedKipNumber}$`);
  return (
    departments.find(
      (department) =>
        department.isKip &&
        getFactoryId(department) === factoryId &&
        sectionRegex.test(department.code || ""),
    )?.id || null
  );
}

export default function EmployeeTransfersPage() {
  const { data: session } = useSession();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [kips, setKips] = useState<Kip[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [sourceFactoryId, setSourceFactoryId] = useState<number | null>(null);
  const [sourceDeptValues, setSourceDeptValues] = useState<string[]>([]);
  const [sourceKipIds, setSourceKipIds] = useState<number[]>([]);
  const [searchText, setSearchText] = useState("");

  const [targetFactoryId, setTargetFactoryId] = useState<number | null>(null);
  const [targetDeptValue, setTargetDeptValue] = useState<string | null>(null);
  const [targetKipId, setTargetKipId] = useState<number | null>(null);

  const canUsePage = TRANSFER_ROLES.includes(session?.user?.role || "");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/employees/transfers");
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        message.error(data.error || "Không thể tải dữ liệu điều chuyển");
        return;
      }

      setDepartments(data.departments || []);
      setKips(data.kips || []);
      setEmployees(data.employees || []);
      setSelectedRowKeys([]);
    } catch {
      message.error("Lỗi kết nối server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canUsePage) fetchData();
  }, [canUsePage]);

  const factories = useMemo(() => {
    const map = new Map<number, Factory>();
    departments.forEach((department) => {
      if (department.factory) map.set(department.factory.id, department.factory);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [departments]);

  const sourceDeptOptions = useMemo(
    () => buildDeptOptions(departments, sourceFactoryId),
    [departments, sourceFactoryId],
  );

  const targetDeptOptions = useMemo(
    () => buildDeptOptions(departments, targetFactoryId),
    [departments, targetFactoryId],
  );

  const sourceDepartmentIds = useMemo(
    () => resolveDepartmentIds(departments, kips, sourceFactoryId, sourceDeptValues, sourceKipIds),
    [departments, kips, sourceFactoryId, sourceDeptValues, sourceKipIds],
  );

  const selectedTargetOption = useMemo(
    () => targetDeptOptions.find((option) => option.value === targetDeptValue),
    [targetDeptOptions, targetDeptValue],
  );

  const targetDepartmentId = useMemo(
    () => resolveTargetDepartmentId(departments, kips, targetFactoryId, targetDeptValue, targetKipId),
    [departments, kips, targetFactoryId, targetDeptValue, targetKipId],
  );

  const filteredEmployees = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return employees.filter((employee) => {
      const employeeFactoryId = getFactoryId(employee.department);
      const matchFactory = sourceFactoryId ? employeeFactoryId === sourceFactoryId : true;
      const matchDepartment =
        sourceDepartmentIds.length > 0
          ? sourceDepartmentIds.includes(employee.department?.id || 0)
          : true;
      const matchKip =
        sourceKipIds.length > 0 ? sourceKipIds.includes(employee.kip?.id || 0) : true;
      const matchKeyword = keyword
        ? employee.fullName.toLowerCase().includes(keyword) ||
          employee.code.toLowerCase().includes(keyword)
        : true;

      return matchFactory && matchDepartment && matchKip && matchKeyword;
    });
  }, [employees, sourceFactoryId, sourceDepartmentIds, sourceKipIds, searchText]);

  const targetKipRequired = Boolean(selectedTargetOption?.isKip);

  const handleTransfer = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning("Vui lòng chọn nhân viên cần điều chuyển");
      return;
    }

    if (!targetDepartmentId) {
      message.warning("Vui lòng chọn đầy đủ nơi chuyển đến");
      return;
    }

    if (targetKipRequired && !targetKipId) {
      message.warning("Bộ phận theo kíp bắt buộc chọn kíp đích");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/employees/transfers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIds: selectedRowKeys.map(Number),
          targetDepartmentId,
          targetKipId: targetKipRequired ? targetKipId : null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        message.error(data.error || "Không thể điều chuyển");
        return;
      }

      message.success(`Đã điều chuyển ${data.count || selectedRowKeys.length} nhân viên`);
      setSelectedRowKeys([]);
      fetchData();
    } catch {
      message.error("Lỗi kết nối server");
    } finally {
      setSubmitting(false);
    }
  };

  const columns: TableProps<Employee>["columns"] = [
    {
      title: "Mã NV",
      dataIndex: "code",
      key: "code",
      width: 100,
      render: (code: string) => <b>{code}</b>,
    },
    {
      title: "Họ tên",
      dataIndex: "fullName",
      key: "fullName",
      width: 220,
    },
    {
      title: "Bộ phận hiện tại",
      key: "department",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.department?.name || "-"}</span>
          <Text type="secondary">{record.department?.factory?.name || "-"}</Text>
        </Space>
      ),
    },
    {
      title: "Kíp",
      key: "kip",
      width: 130,
      render: (_, record) => (
        <Tag color={record.kip ? "blue" : "default"}>{record.kip?.name || "Không kíp"}</Tag>
      ),
    },
    {
      title: "Chức vụ",
      dataIndex: "position",
      key: "position",
      width: 140,
      render: (value: string | null) => value || "-",
    },
  ];

  if (!canUsePage) {
    return (
      <AdminLayout>
        <Alert type="error" message="Bạn không có quyền truy cập trang điều chuyển." />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Điều chuyển nhân viên</h2>
          <Text type="secondary">
            Cập nhật bộ phận và kíp hiện tại để nhân viên xuất hiện đúng danh sách chấm công.
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
          Tải lại
        </Button>
      </div>

      <Card size="small" style={{ marginBottom: 16, background: "#f5f5f5" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600 }}>
            <FilterOutlined /> Nguồn:
          </span>
          <Input
            placeholder="Tìm tên hoặc mã NV..."
            prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
            style={{ width: 220 }}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            allowClear
          />
          <Select
            style={{ width: 190 }}
            placeholder="Nhà máy nguồn"
            value={sourceFactoryId}
            onChange={(value) => {
              setSourceFactoryId(value);
              setSourceDeptValues([]);
              setSourceKipIds([]);
              setSelectedRowKeys([]);
            }}
            options={factories.map((factory) => ({ value: factory.id, label: factory.name }))}
            allowClear
          />
          <Select
            mode="multiple"
            style={{ width: 320 }}
            placeholder="Tổ / Bộ phận nguồn"
            value={sourceDeptValues}
            onChange={(values) => {
              setSourceDeptValues(values);
              setSelectedRowKeys([]);
            }}
            options={sourceDeptOptions}
            disabled={!sourceFactoryId}
            showSearch
            optionFilterProp="label"
            maxTagCount="responsive"
            allowClear
            optionRender={(option) => {
              const deptOption = sourceDeptOptions.find((item) => item.value === option.value);
              return (
                <Space>
                  <span>{option.label as string}</span>
                  {deptOption?.isKip && <Tag color="blue">Ca kíp</Tag>}
                </Space>
              );
            }}
          />
          <Select
            mode="multiple"
            style={{ width: 180 }}
            placeholder="Kíp nguồn"
            value={sourceKipIds}
            onChange={(values) => {
              setSourceKipIds(values);
              setSelectedRowKeys([]);
            }}
            options={kips
              .filter((kip) => kip.factoryId === sourceFactoryId)
              .map((kip) => ({ value: kip.id, label: kip.name }))}
            disabled={!sourceFactoryId}
            allowClear
            maxTagCount="responsive"
          />
          <Button
            danger
            icon={<FilterOutlined />}
            disabled={!sourceFactoryId && !searchText}
            onClick={() => {
              setSourceFactoryId(null);
              setSourceDeptValues([]);
              setSourceKipIds([]);
              setSearchText("");
              setSelectedRowKeys([]);
            }}
          />
        </div>
      </Card>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Form layout="vertical">
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <Form.Item label="Nhà máy đích" style={{ width: 220, marginBottom: 0 }}>
              <Select
                placeholder="Chọn nhà máy"
                value={targetFactoryId}
                onChange={(value) => {
                  setTargetFactoryId(value);
                  setTargetDeptValue(null);
                  setTargetKipId(null);
                }}
                options={factories.map((factory) => ({ value: factory.id, label: factory.name }))}
              />
            </Form.Item>

            <Form.Item label="Tổ / Bộ phận đích" style={{ width: 340, marginBottom: 0 }}>
              <Select
                placeholder="Chọn tổ hoặc bộ phận"
                value={targetDeptValue}
                onChange={(value) => {
                  setTargetDeptValue(value);
                  setTargetKipId(null);
                }}
                options={targetDeptOptions}
                disabled={!targetFactoryId}
                showSearch
                optionFilterProp="label"
                optionRender={(option) => {
                  const deptOption = targetDeptOptions.find((item) => item.value === option.value);
                  return (
                    <Space>
                      <span>{option.label as string}</span>
                      {deptOption?.isKip && <Tag color="blue">Ca kíp</Tag>}
                    </Space>
                  );
                }}
              />
            </Form.Item>

            <Form.Item label="Kíp đích" style={{ width: 190, marginBottom: 0 }}>
              <Select
                placeholder={targetKipRequired ? "Chọn kíp" : "Không áp dụng"}
                value={targetKipId}
                onChange={setTargetKipId}
                disabled={!targetFactoryId || !targetKipRequired}
                options={kips
                  .filter((kip) => kip.factoryId === targetFactoryId)
                  .map((kip) => ({ value: kip.id, label: kip.name }))}
                allowClear
              />
            </Form.Item>

            <Button
              type="primary"
              icon={<SwapOutlined />}
              loading={submitting}
              disabled={selectedRowKeys.length === 0 || !targetDepartmentId}
              onClick={handleTransfer}
            >
              Điều chuyển ({selectedRowKeys.length})
            </Button>
          </div>
        </Form>
      </Card>

      <Table
        rowKey="id"
        loading={loading}
        bordered
        columns={columns}
        dataSource={filteredEmployees}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />
    </AdminLayout>
  );
}
