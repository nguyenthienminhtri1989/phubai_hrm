"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Alert,
  Button,
  Empty,
  Input,
  Modal,
  Select,
  Skeleton,
  Tag,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  HomeOutlined,
  ReloadOutlined,
  SearchOutlined,
  SwapOutlined,
  UserOutlined,
} from "@ant-design/icons";

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

type ScreenState = "source" | "target";

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

export default function MobileEmployeeTransfersPage() {
  const { data: session } = useSession();
  const [screen, setScreen] = useState<ScreenState>("source");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [kips, setKips] = useState<Kip[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

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
      setSelectedIds([]);
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

  const selectedEmployees = useMemo(
    () => employees.filter((employee) => selectedIds.includes(employee.id)),
    [employees, selectedIds],
  );

  const targetKipRequired = Boolean(selectedTargetOption?.isKip);
  const canTransfer = selectedIds.length > 0 && Boolean(targetDepartmentId);

  const resetSource = () => {
    setSourceFactoryId(null);
    setSourceDeptValues([]);
    setSourceKipIds([]);
    setSearchText("");
    setSelectedIds([]);
  };

  const toggleEmployee = (employeeId: number) => {
    setSelectedIds((current) =>
      current.includes(employeeId)
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId],
    );
  };

  const handleTransfer = async () => {
    if (selectedIds.length === 0) {
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
          employeeIds: selectedIds,
          targetDepartmentId,
          targetKipId: targetKipRequired ? targetKipId : null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        message.error(data.error || "Không thể điều chuyển");
        return;
      }

      message.success(`Đã điều chuyển ${data.count || selectedIds.length} nhân viên`);
      setSelectedIds([]);
      setScreen("source");
      fetchData();
    } catch {
      message.error("Lỗi kết nối server");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmTransfer = () => {
    Modal.confirm({
      title: "Xác nhận điều chuyển",
      content: `Điều chuyển ${selectedIds.length} nhân viên sang nơi đã chọn?`,
      okText: "Điều chuyển",
      cancelText: "Hủy",
      onOk: handleTransfer,
    });
  };

  const pageStyle: React.CSSProperties = {
    maxWidth: 480,
    margin: "0 auto",
    minHeight: "100vh",
    background: "#f5f5f5",
    display: "flex",
    flexDirection: "column",
  };

  const headerButtonStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.2)",
    border: "none",
    color: "#fff",
    width: 32,
    height: 32,
    flexShrink: 0,
  };

  if (!canUsePage) {
    return (
      <div style={pageStyle}>
        <div style={{ padding: 12 }}>
          <Alert type="error" message="Bạn không có quyền truy cập trang điều chuyển." />
        </div>
      </div>
    );
  }

  if (screen === "target") {
    return (
      <div style={pageStyle}>
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "linear-gradient(135deg, #1677ff 0%, #0958d9 100%)",
            color: "#fff",
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          <Button
            icon={<ArrowLeftOutlined />}
            size="small"
            onClick={() => setScreen("source")}
            style={headerButtonStyle}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Nơi chuyển đến</div>
            <div style={{ fontSize: 11, opacity: 0.82 }}>{selectedIds.length} nhân viên đã chọn</div>
          </div>
          <Link href="/mobile">
            <Button icon={<HomeOutlined />} size="small" style={headerButtonStyle} />
          </Link>
        </div>

        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#8c8c8c", marginBottom: 10 }}>
              Nhân viên
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {selectedEmployees.slice(0, 5).map((employee) => (
                <div key={employee.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <CheckCircleOutlined style={{ color: "#52c41a", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {employee.fullName}
                    </div>
                    <div style={{ color: "#8c8c8c", fontSize: 12 }}>
                      {employee.code} · {employee.department?.name || "-"}
                    </div>
                  </div>
                </div>
              ))}
              {selectedEmployees.length > 5 && (
                <div style={{ color: "#8c8c8c", fontSize: 12 }}>
                  Và {selectedEmployees.length - 5} nhân viên khác
                </div>
              )}
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#8c8c8c", marginBottom: 10 }}>
              Chọn điểm đến
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Select
                size="large"
                placeholder="Nhà máy đích"
                value={targetFactoryId}
                onChange={(value) => {
                  setTargetFactoryId(value);
                  setTargetDeptValue(null);
                  setTargetKipId(null);
                }}
                options={factories.map((factory) => ({ value: factory.id, label: factory.name }))}
              />
              <Select
                size="large"
                placeholder="Tổ / Bộ phận đích"
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span>{option.label as string}</span>
                      {deptOption?.isKip && <Tag color="blue">Ca kíp</Tag>}
                    </div>
                  );
                }}
              />
              <Select
                size="large"
                placeholder={targetKipRequired ? "Kíp đích" : "Không áp dụng kíp"}
                value={targetKipId}
                onChange={setTargetKipId}
                disabled={!targetFactoryId || !targetKipRequired}
                options={kips
                  .filter((kip) => kip.factoryId === targetFactoryId)
                  .map((kip) => ({ value: kip.id, label: kip.name }))}
                allowClear
              />
            </div>
          </div>
        </div>

        <div
          style={{
            position: "sticky",
            bottom: 0,
            padding: 12,
            background: "rgba(245,245,245,0.96)",
            borderTop: "1px solid #e8e8e8",
          }}
        >
          <Button
            type="primary"
            size="large"
            block
            icon={<SwapOutlined />}
            loading={submitting}
            disabled={!canTransfer}
            onClick={confirmTransfer}
            style={{ height: 48, borderRadius: 10, fontWeight: 700 }}
          >
            Điều chuyển ({selectedIds.length})
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "linear-gradient(135deg, #1677ff 0%, #0958d9 100%)",
          color: "#fff",
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Điều chuyển nhân viên</div>
          <div style={{ fontSize: 11, opacity: 0.82 }}>{filteredEmployees.length} nhân viên</div>
        </div>
        <Button
          icon={<ReloadOutlined />}
          size="small"
          onClick={fetchData}
          loading={loading}
          style={headerButtonStyle}
        />
        <Link href="/mobile">
          <Button icon={<HomeOutlined />} size="small" style={headerButtonStyle} />
        </Link>
      </div>

      <div style={{ padding: 12 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Input
              size="large"
              placeholder="Tìm tên hoặc mã NV..."
              prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              allowClear
            />
            <Select
              size="large"
              placeholder="Nhà máy nguồn"
              value={sourceFactoryId}
              onChange={(value) => {
                setSourceFactoryId(value);
                setSourceDeptValues([]);
                setSourceKipIds([]);
                setSelectedIds([]);
              }}
              options={factories.map((factory) => ({ value: factory.id, label: factory.name }))}
              allowClear
            />
            <Select
              mode="multiple"
              size="large"
              placeholder="Tổ / Bộ phận nguồn"
              value={sourceDeptValues}
              onChange={(values) => {
                setSourceDeptValues(values);
                setSelectedIds([]);
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{option.label as string}</span>
                    {deptOption?.isKip && <Tag color="blue">Ca kíp</Tag>}
                  </div>
                );
              }}
            />
            <Select
              mode="multiple"
              size="large"
              placeholder="Kíp nguồn"
              value={sourceKipIds}
              onChange={(values) => {
                setSourceKipIds(values);
                setSelectedIds([]);
              }}
              options={kips
                .filter((kip) => kip.factoryId === sourceFactoryId)
                .map((kip) => ({ value: kip.id, label: kip.name }))}
              disabled={!sourceFactoryId}
              allowClear
              maxTagCount="responsive"
            />
          </div>
          <Button
            block
            disabled={!sourceFactoryId && !searchText}
            onClick={resetSource}
            style={{ marginTop: 10, borderRadius: 10 }}
          >
            Xóa lọc
          </Button>
        </div>

        {loading ? (
          [...Array(6)].map((_, index) => (
            <div key={index} style={{ background: "#fff", borderRadius: 10, padding: 14, marginBottom: 8 }}>
              <Skeleton active avatar paragraph={{ rows: 1 }} />
            </div>
          ))
        ) : filteredEmployees.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 10, padding: 32, textAlign: "center" }}>
            <Empty description="Không có nhân viên" />
          </div>
        ) : (
          filteredEmployees.map((employee) => {
            const selected = selectedIds.includes(employee.id);
            return (
              <button
                key={employee.id}
                onClick={() => toggleEmployee(employee.id)}
                style={{
                  width: "100%",
                  background: selected ? "#e6f4ff" : "#fff",
                  borderRadius: 10,
                  padding: "12px 14px",
                  border: selected ? "1px solid #1677ff" : "1px solid #f0f0f0",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 8,
                  minHeight: 64,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: selected ? "#1677ff" : "#f0f5ff",
                    color: selected ? "#fff" : "#1677ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  {selected ? <CheckCircleOutlined /> : <UserOutlined />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {employee.fullName}
                  </div>
                  <div style={{ fontSize: 12, color: "#8c8c8c", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {employee.code} · {employee.department?.name || "-"}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <Tag color={employee.kip ? "blue" : "default"} style={{ margin: 0 }}>
                      {employee.kip?.name || "Không kíp"}
                    </Tag>
                    {employee.position && <Tag style={{ margin: 0 }}>{employee.position}</Tag>}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div
        style={{
          position: "sticky",
          bottom: 0,
          padding: 12,
          background: "rgba(245,245,245,0.96)",
          borderTop: "1px solid #e8e8e8",
        }}
      >
        <Button
          type="primary"
          size="large"
          block
          icon={<SwapOutlined />}
          disabled={selectedIds.length === 0}
          onClick={() => setScreen("target")}
          style={{ height: 48, borderRadius: 10, fontWeight: 700 }}
        >
          Chọn nơi đến ({selectedIds.length})
        </Button>
      </div>
    </div>
  );
}
