'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Table,
  Select,
  InputNumber,
  DatePicker,
  message,
  Button,
  Typography,
  Space,
  Tag,
  Spin,
  Tooltip,
} from 'antd'
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { Dayjs } from 'dayjs'

const { Title, Text } = Typography

// ---- Types ----

interface Department {
  id: number
  name: string
}

interface EmployeeInBonus {
  id: number
  code: string
  fullName: string
  department: { id: number; name: string; isKip: boolean }
}

interface PerformanceBonus {
  id: number
  employeeId: number
  month: number
  year: number
  performanceCoefficient: number
  productionCoefficient: number
  bonusFullAttendance: number
  bonusAdminWork: number
  bonusShift3: number
  shift3Days?: number
  employee: EmployeeInBonus
}

// Row được edit — có thêm _changed
interface EditRow extends PerformanceBonus {
  _changed: boolean
}

interface MonthlyEvaluation {
  employeeId: number
  grade: string | null
}

// ---- Helpers ----

const fetchAPI = async (url: string, opts?: RequestInit) => {
  const res = await fetch(url, opts)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? 'Lỗi không xác định')
  }
  return res.json()
}

const gradeColor = (grade: string | null | undefined) => {
  if (grade === 'A') return 'green'
  if (grade === 'B') return 'blue'
  if (grade === 'C') return 'orange'
  return 'default'
}

// ---- Editable InputNumber cell ----

function EditCell({
  value,
  onChange,
  step = 1,
  min = 0,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
}) {
  return (
    <InputNumber
      size="small"
      value={value}
      min={min}
      step={step}
      style={{ width: 100 }}
      onChange={(v) => onChange(v ?? 0)}
    />
  )
}

// ---- Page Component ----

export default function PerformancePage() {
  const [messageApi, contextHolder] = message.useMessage()

  // Filter state
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs())
  const [departmentId, setDepartmentId] = useState<number | undefined>()

  // Data
  const [rows, setRows] = useState<EditRow[]>([])
  const [evaluations, setEvaluations] = useState<Map<number, string | null>>(new Map())
  const [departments, setDepartments] = useState<Department[]>([])

  // UI
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Track changes
  const changedRef = useRef<Map<number, Partial<PerformanceBonus>>>(new Map())

  // ---- Fetch ----

  const fetchData = useCallback(async () => {
    setLoading(true)
    changedRef.current.clear()
    try {
      const month = selectedMonth.month() + 1
      const year = selectedMonth.year()
      const params = new URLSearchParams({
        month: String(month),
        year: String(year),
      })
      if (departmentId) params.set('departmentId', String(departmentId))

      // Fetch performance + timesheets (monthly summary)
      const [bonuses, evals] = await Promise.all([
        fetchAPI(`/api/salary/performance?${params}`),
        fetchAPI(`/api/salary/performance?${params}&evaluationsOnly=1`).catch(() => []),
      ])

      // Map evaluations — API trả về mảng bonuses, grade từ MonthlyEvaluation
      // Lấy grade riêng từ timesheets monthly hoặc embed trong response
      const evalMap = new Map<number, string | null>()

      // Nếu bonuses đã kèm evaluation (embed), dùng luôn
      // Nếu không, fetchAPI riêng
      try {
        const evalParams = new URLSearchParams({
          month: String(month),
          year: String(year),
        })
        if (departmentId) evalParams.set('departmentId', String(departmentId))
        const evalData: MonthlyEvaluation[] = await fetchAPI(
          `/api/timesheets/monthly-eval?${evalParams}`
        ).catch(() => [])
        evalData.forEach((e) => evalMap.set(e.employeeId, e.grade))
      } catch {
        // ignore
      }

      // Fallback: parse luôn từ bonuses nếu có embedded grade
      bonuses.forEach((b: PerformanceBonus & { evaluation?: MonthlyEvaluation }) => {
        if (b.evaluation?.grade !== undefined) {
          evalMap.set(b.employeeId, b.evaluation.grade ?? null)
        }
      })

      void evals // suppress lint

      setEvaluations(evalMap)
      setRows(bonuses.map((b: PerformanceBonus) => ({ ...b, _changed: false })))
    } catch (err: unknown) {
      messageApi.error(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [selectedMonth, departmentId, messageApi])

  useEffect(() => {
    fetchAPI('/api/departments').then(setDepartments).catch(() => {})
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ---- Edit cell handler ----

  const handleCellChange = (
    employeeId: number,
    field: keyof PerformanceBonus,
    value: number
  ) => {
    setRows((prev) =>
      prev.map((r) =>
        r.employeeId === employeeId ? { ...r, [field]: value, _changed: true } : r
      )
    )
    const prev = changedRef.current.get(employeeId) ?? {}
    changedRef.current.set(employeeId, { ...prev, [field]: value })
  }

  // ---- Save all changed rows ----

  const handleSaveAll = async () => {
    const changedRows = rows.filter((r) => r._changed)
    if (changedRows.length === 0) {
      messageApi.info('Không có thay đổi nào để lưu')
      return
    }

    setSaving(true)
    const month = selectedMonth.month() + 1
    const year = selectedMonth.year()
    const hide = messageApi.loading(`Đang lưu ${changedRows.length} dòng...`, 0)

    let successCount = 0
    let failCount = 0

    for (const row of changedRows) {
      try {
        await fetchAPI('/api/salary/performance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId: row.employeeId,
            month,
            year,
            performanceCoefficient: row.performanceCoefficient,
            productionCoefficient: row.productionCoefficient,
            bonusFullAttendance: row.bonusFullAttendance,
            bonusAdminWork: row.bonusAdminWork,
            bonusShift3: row.bonusShift3,
          }),
        })
        successCount++
      } catch {
        failCount++
      }
    }

    hide()
    setSaving(false)

    if (failCount === 0) {
      messageApi.success(`Đã lưu ${successCount} dòng thành công`)
    } else {
      messageApi.warning(`Thành công: ${successCount}, Lỗi: ${failCount}`)
    }

    fetchData()
  }

  // ---- Table columns ----

  const columns: ColumnsType<EditRow> = [
    {
      title: 'STT',
      key: 'stt',
      width: 55,
      align: 'center',
      fixed: 'left',
      render: (_: unknown, __: EditRow, i: number) => i + 1,
    },
    {
      title: 'Mã NV',
      key: 'code',
      width: 90,
      fixed: 'left',
      render: (_: unknown, r: EditRow) => <Text strong>{r.employee.code}</Text>,
    },
    {
      title: 'Họ tên',
      key: 'fullName',
      width: 180,
      fixed: 'left',
      render: (_: unknown, r: EditRow) => r.employee.fullName,
    },
    {
      title: 'Phòng ban',
      key: 'dept',
      width: 140,
      render: (_: unknown, r: EditRow) => (
        <Tag color={r.employee.department?.isKip ? 'purple' : 'cyan'}>
          {r.employee.department?.name ?? '—'}
        </Tag>
      ),
    },
    {
      title: 'Xếp loại',
      key: 'grade',
      width: 90,
      align: 'center',
      render: (_: unknown, r: EditRow) => {
        const grade = evaluations.get(r.employeeId) ?? null
        return grade ? (
          <Tag color={gradeColor(grade)}>{grade}</Tag>
        ) : (
          <Text type="secondary">—</Text>
        )
      },
    },
    {
      title: (
        <Tooltip title="Hệ số kết quả công việc (điểm KPI)">
          HS Công việc
        </Tooltip>
      ),
      key: 'performanceCoefficient',
      width: 130,
      align: 'center',
      render: (_: unknown, r: EditRow) => (
        <EditCell
          value={r.performanceCoefficient}
          step={0.1}
          onChange={(v) => handleCellChange(r.employeeId, 'performanceCoefficient', v)}
        />
      ),
    },
    {
      title: (
        <Tooltip title="Thưởng đủ công (áp dụng tất cả NV)">
          Thưởng đủ công
        </Tooltip>
      ),
      key: 'bonusFullAttendance',
      width: 140,
      align: 'center',
      render: (_: unknown, r: EditRow) => (
        <EditCell
          value={r.bonusFullAttendance}
          step={10000}
          onChange={(v) => handleCellChange(r.employeeId, 'bonusFullAttendance', v)}
        />
      ),
    },
    // Khối HC
    {
      title: (
        <Tooltip title="Thưởng hành chính — chỉ khối HC (isKip=false)">
          Thưởng HC
        </Tooltip>
      ),
      key: 'bonusAdminWork',
      width: 130,
      align: 'center',
      render: (_: unknown, r: EditRow) =>
        r.employee.department?.isKip ? (
          <Text type="secondary">—</Text>
        ) : (
          <EditCell
            value={r.bonusAdminWork}
            step={10000}
            onChange={(v) => handleCellChange(r.employeeId, 'bonusAdminWork', v)}
          />
        ),
    },
    // Khối SX — productionCoefficient
    {
      title: (
        <Tooltip title="Hệ số KQSX theo ca — chỉ khối SX (isKip=true)">
          HS Sản xuất
        </Tooltip>
      ),
      key: 'productionCoefficient',
      width: 130,
      align: 'center',
      render: (_: unknown, r: EditRow) =>
        !r.employee.department?.isKip ? (
          <Text type="secondary">—</Text>
        ) : (
          <EditCell
            value={r.productionCoefficient}
            step={0.1}
            onChange={(v) => handleCellChange(r.employeeId, 'productionCoefficient', v)}
          />
        ),
    },
    // Khối SX — bonusShift3
    {
      title: (
        <Tooltip title="Thưởng ca 3 — chỉ khối SX (isKip=true)">
          Thưởng ca 3
        </Tooltip>
      ),
      key: 'bonusShift3',
      width: 130,
      align: 'center',
      render: (_: unknown, r: EditRow) =>
        !r.employee.department?.isKip ? (
          <Text type="secondary">—</Text>
        ) : (
          <EditCell
            value={r.bonusShift3}
            step={10000}
            onChange={(v) => handleCellChange(r.employeeId, 'bonusShift3', v)}
          />
        ),
    },
    {
      title: '',
      key: 'changed',
      width: 50,
      align: 'center',
      render: (_: unknown, r: EditRow) =>
        r._changed ? (
          <Tooltip title="Có thay đổi chưa lưu">
            <span style={{ color: '#faad14', fontWeight: 700 }}>●</span>
          </Tooltip>
        ) : null,
    },
  ]

  // ---- Render ----

  return (
    <>
      {contextHolder}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          Nhập kết quả tháng
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            Tải lại
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSaveAll}
            loading={saving}
          >
            Lưu tất cả ({rows.filter((r) => r._changed).length})
          </Button>
        </Space>
      </div>

      {/* Filter bar */}
      <Space style={{ marginBottom: 16 }} wrap>
        <DatePicker.MonthPicker
          value={selectedMonth}
          onChange={(val) => val && setSelectedMonth(val)}
          format="MM/YYYY"
          allowClear={false}
        />
        <Select
          placeholder="Lọc theo phòng ban"
          allowClear
          style={{ width: 240 }}
          value={departmentId}
          onChange={setDepartmentId}
          showSearch
          optionFilterProp="label"
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
        />
      </Space>

      {/* Legend */}
      <div style={{ marginBottom: 12 }}>
        <Space size="large">
          <Space size={4}>
            <Tag color="purple">SX</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Khối sản xuất — có cột HS SX & Thưởng ca 3
            </Text>
          </Space>
          <Space size={4}>
            <Tag color="cyan">HC</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Khối hành chính — có cột Thưởng HC
            </Text>
          </Space>
          <Space size={4}>
            <span style={{ color: '#faad14', fontWeight: 700 }}>●</span>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Có thay đổi chưa lưu
            </Text>
          </Space>
        </Space>
      </div>

      {/* Table */}
      <Spin spinning={loading}>
        <Table
          rowKey="employeeId"
          dataSource={rows}
          columns={columns}
          loading={false}
          size="small"
          scroll={{ x: 1100 }}
          pagination={{
            pageSize: 30,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} nhân viên`,
          }}
          rowClassName={(r: EditRow) =>
            r._changed ? 'row-changed' : ''
          }
        />
      </Spin>

      <style>{`
        .row-changed {
          background-color: #fffbe6 !important;
        }
        .row-changed td {
          background-color: #fffbe6 !important;
        }
      `}</style>
    </>
  )
}
