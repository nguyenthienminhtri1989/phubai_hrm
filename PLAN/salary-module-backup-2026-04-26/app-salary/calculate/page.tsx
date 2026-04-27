'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Table,
  Select,
  DatePicker,
  message,
  Button,
  Typography,
  Space,
  Tag,
  Statistic,
  Row,
  Col,
  Card,
  Drawer,
  Descriptions,
  Modal,
  Spin,
  Divider,
} from 'antd'
import {
  ThunderboltOutlined,
  CheckCircleOutlined,
  FileExcelOutlined,
  EyeOutlined,
  CheckOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { Dayjs } from 'dayjs'

const { Title, Text } = Typography

// ---- Types ----

type SalaryStatus = 'DRAFT' | 'CONFIRMED' | 'LOCKED'

interface Department {
  id: number
  name: string
}

interface MonthlySalary {
  id: number
  employeeId: number
  month: number
  year: number
  employee: {
    id: number
    code: string
    fullName: string
    department: Department
  }

  // Ngày công
  actualWorkDays: number
  shift3Days: number
  sundayWorkDays: number
  holidayLeaveDays: number

  // Thu nhập
  timeSalary: number
  overtimeSalary: number
  holidaySalary: number
  mealAllowance: number
  shift3Allowance: number
  performanceSalary: number
  specialAllowance: number
  totalIncome: number

  // Khấu trừ
  advanceDeduction: number
  bhxhDeduction: number
  bhytDeduction: number
  bhtnDeduction: number
  unionFeeDeduction: number
  mealDeduction: number
  incomeTaxDeduction: number

  // Kết quả
  netSalary: number
  status: SalaryStatus
  calculatedBy: string | null
  confirmedBy: string | null
  note: string | null
}

interface CalculateResult {
  success: number
  failed: number
  errors: string[]
}

// ---- Helpers ----

const formatVND = (v: number | null | undefined): string =>
  v != null ? Math.round(v).toLocaleString('vi-VN') + ' đ' : '—'

const fetchAPI = async (url: string, opts?: RequestInit) => {
  const res = await fetch(url, opts)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? 'Lỗi không xác định')
  }
  return res.json()
}

const statusTagConfig: Record<SalaryStatus, { color: string; label: string }> = {
  DRAFT: { color: 'default', label: 'Chưa duyệt' },
  CONFIRMED: { color: 'green', label: 'Đã duyệt' },
  LOCKED: { color: 'red', label: 'Đã khóa' },
}

// ---- Statistic Card ----

function StatCard({
  title,
  value,
  prefix,
  suffix,
  color,
  loading,
}: {
  title: string
  value: number | string
  prefix?: React.ReactNode
  suffix?: string
  color?: string
  loading?: boolean
}) {
  return (
    <Card size="small" style={{ height: '100%' }}>
      <Spin spinning={!!loading}>
        <Statistic
          title={title}
          value={value}
          prefix={prefix}
          suffix={suffix}
          valueStyle={{ color, fontSize: 20, fontWeight: 600 }}
          formatter={
            typeof value === 'number'
              ? (v) => Math.round(Number(v)).toLocaleString('vi-VN')
              : undefined
          }
        />
      </Spin>
    </Card>
  )
}

// ---- Detail Drawer ----

function DetailDrawer({
  record,
  open,
  onClose,
}: {
  record: MonthlySalary | null
  open: boolean
  onClose: () => void
}) {
  if (!record) return null

  const totalDeduction =
    record.advanceDeduction +
    record.bhxhDeduction +
    record.bhytDeduction +
    record.bhtnDeduction +
    record.unionFeeDeduction +
    record.incomeTaxDeduction

  return (
    <Drawer
      title={
        <Space>
          <EyeOutlined />
          <span>
            Chi tiết lương — {record.employee.fullName}
          </span>
          <Tag color={statusTagConfig[record.status].color}>
            {statusTagConfig[record.status].label}
          </Tag>
        </Space>
      }
      open={open}
      onClose={onClose}
      width={600}
      footer={null}
    >
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary">
          {record.employee.code} · {record.employee.department?.name} · Tháng{' '}
          {record.month}/{record.year}
        </Text>
      </div>

      {/* Ngày công */}
      <Divider>
        <Text strong>Ngày công</Text>
      </Divider>
      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label="Ngày công thực tế">
          {record.actualWorkDays}
        </Descriptions.Item>
        <Descriptions.Item label="Ngày nghỉ Lễ/Phép">
          {record.holidayLeaveDays}
        </Descriptions.Item>
        <Descriptions.Item label="Công ca 3">
          {record.shift3Days}
        </Descriptions.Item>
        <Descriptions.Item label="Số CN đi làm">
          {record.sundayWorkDays}
        </Descriptions.Item>
      </Descriptions>

      {/* Thu nhập */}
      <Divider>
        <Text strong style={{ color: '#389e0d' }}>
          Thu nhập
        </Text>
      </Divider>
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="Lương thời gian">
          {formatVND(record.timeSalary)}
        </Descriptions.Item>
        <Descriptions.Item label="Lương làm thêm giờ (OT)">
          {formatVND(record.overtimeSalary)}
        </Descriptions.Item>
        <Descriptions.Item label="Tiền nghỉ Lễ / Phép có lương">
          {formatVND(record.holidaySalary)}
        </Descriptions.Item>
        <Descriptions.Item label="Ăn cơm Chủ Nhật">
          {formatVND(record.mealAllowance)}
        </Descriptions.Item>
        <Descriptions.Item label="Phụ cấp ca 3">
          {formatVND(record.shift3Allowance)}
        </Descriptions.Item>
        <Descriptions.Item label="Lương cấp bậc công việc">
          {formatVND(record.performanceSalary)}
        </Descriptions.Item>
        <Descriptions.Item label="PC Đặc thù (ĐT + Đi lại)">
          {formatVND(record.specialAllowance)}
        </Descriptions.Item>
        <Descriptions.Item label={<Text strong>Tổng thu nhập</Text>}>
          <Text strong style={{ color: '#389e0d' }}>
            {formatVND(record.totalIncome)}
          </Text>
        </Descriptions.Item>
      </Descriptions>

      {/* Khấu trừ */}
      <Divider>
        <Text strong style={{ color: '#cf1322' }}>
          Khấu trừ
        </Text>
      </Divider>
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="Tạm ứng">
          {formatVND(record.advanceDeduction)}
        </Descriptions.Item>
        <Descriptions.Item label="BHXH (8%)">
          {formatVND(record.bhxhDeduction)}
        </Descriptions.Item>
        <Descriptions.Item label="BHYT (1.5%)">
          {formatVND(record.bhytDeduction)}
        </Descriptions.Item>
        <Descriptions.Item label="BHTN (1%)">
          {formatVND(record.bhtnDeduction)}
        </Descriptions.Item>
        <Descriptions.Item label="Công đoàn phí (1%)">
          {formatVND(record.unionFeeDeduction)}
        </Descriptions.Item>
        <Descriptions.Item label="Thuế TNCN">
          {formatVND(record.incomeTaxDeduction)}
        </Descriptions.Item>
        <Descriptions.Item label={<Text strong>Tổng khấu trừ</Text>}>
          <Text strong style={{ color: '#cf1322' }}>
            {formatVND(totalDeduction)}
          </Text>
        </Descriptions.Item>
      </Descriptions>

      {/* Thực nhận */}
      <div
        style={{
          marginTop: 24,
          padding: '16px 24px',
          background: '#f6ffed',
          border: '1px solid #b7eb8f',
          borderRadius: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text strong style={{ fontSize: 16 }}>
          THỰC NHẬN
        </Text>
        <Text strong style={{ fontSize: 22, color: '#237804' }}>
          {formatVND(record.netSalary)}
        </Text>
      </div>

      {record.calculatedBy && (
        <div style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Tính bởi: {record.calculatedBy}
            {record.confirmedBy && ` · Duyệt bởi: ${record.confirmedBy}`}
          </Text>
        </div>
      )}
    </Drawer>
  )
}

// ---- Page Component ----

export default function CalculatePage() {
  const [messageApi, contextHolder] = message.useMessage()

  // Filter / controls
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs())
  const [departmentId, setDepartmentId] = useState<number | undefined>()
  const [departments, setDepartments] = useState<Department[]>([])

  // Data
  const [results, setResults] = useState<MonthlySalary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  // UI
  const [calculating, setCalculating] = useState(false)
  const [tableLoading, setTableLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<MonthlySalary | null>(null)
  const [approvingIds, setApprovingIds] = useState<Set<number>>(new Set())
  const [approvingAll, setApprovingAll] = useState(false)

  // ---- Fetch helpers ----

  const fetchResults = useCallback(async (pg = 1) => {
    setTableLoading(true)
    try {
      const month = selectedMonth.month() + 1
      const year = selectedMonth.year()
      const params = new URLSearchParams({
        month: String(month),
        year: String(year),
        page: String(pg),
        limit: '50',
      })
      if (departmentId) params.set('departmentId', String(departmentId))
      const res = await fetchAPI(`/api/salary/monthly?${params}`)
      setResults(res.data ?? [])
      setTotal(res.total ?? 0)
      setPage(pg)
    } catch (err: unknown) {
      messageApi.error(err instanceof Error ? err.message : 'Lỗi tải bảng lương')
    } finally {
      setTableLoading(false)
    }
  }, [selectedMonth, departmentId, messageApi])

  useEffect(() => {
    fetchAPI('/api/departments').then(setDepartments).catch(() => {})
  }, [])

  useEffect(() => {
    fetchResults(1)
  }, [fetchResults])

  // ---- Statistics ----

  const stats = useMemo(() => {
    if (results.length === 0)
      return { count: 0, totalFund: 0, maxSalary: 0, minSalary: 0 }
    const salaries = results.map((r) => r.netSalary)
    return {
      count: total,
      totalFund: results.reduce((s, r) => s + r.netSalary, 0),
      maxSalary: Math.max(...salaries),
      minSalary: Math.min(...salaries),
    }
  }, [results, total])

  // ---- Calculate ----

  const handleCalculate = async () => {
    setCalculating(true)
    try {
      const month = selectedMonth.month() + 1
      const year = selectedMonth.year()
      const body: Record<string, unknown> = { month, year }
      if (departmentId) body.departmentId = departmentId

      const res: CalculateResult = await fetchAPI('/api/salary/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      messageApi.success(
        `Tính lương hoàn tất — Thành công: ${res.success}, Lỗi: ${res.failed}`
      )

      if (res.errors && res.errors.length > 0) {
        Modal.warning({
          title: `Có ${res.failed} lỗi khi tính lương`,
          content: (
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {res.errors.map((e, i) => (
                <div key={i} style={{ marginBottom: 4, fontSize: 13 }}>
                  <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 6 }} />
                  {e}
                </div>
              ))}
            </div>
          ),
          width: 520,
        })
      }

      fetchResults(1)
    } catch (err: unknown) {
      messageApi.error(err instanceof Error ? err.message : 'Lỗi khi tính lương')
    } finally {
      setCalculating(false)
    }
  }

  // ---- Approve single ----

  const handleApprove = async (record: MonthlySalary) => {
    setApprovingIds((prev) => new Set(prev).add(record.id))
    try {
      await fetchAPI(`/api/salary/monthly/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CONFIRMED' }),
      })
      messageApi.success(`Đã duyệt lương — ${record.employee.fullName}`)
      fetchResults(page)
    } catch (err: unknown) {
      messageApi.error(err instanceof Error ? err.message : 'Lỗi khi duyệt')
    } finally {
      setApprovingIds((prev) => {
        const next = new Set(prev)
        next.delete(record.id)
        return next
      })
    }
  }

  // ---- Approve all ----

  const handleApproveAll = async () => {
    const draftRecords = results.filter((r) => r.status === 'DRAFT')
    if (draftRecords.length === 0) {
      messageApi.info('Không có bản ghi DRAFT nào để duyệt')
      return
    }

    Modal.confirm({
      title: `Duyệt tất cả ${draftRecords.length} bản ghi?`,
      content: 'Tất cả bản lương đang DRAFT sẽ được duyệt. Bạn có chắc chắn?',
      okText: 'Duyệt tất cả',
      cancelText: 'Hủy',
      onOk: async () => {
        setApprovingAll(true)
        const hide = messageApi.loading('Đang duyệt...', 0)
        let ok = 0
        let fail = 0
        for (const r of draftRecords) {
          try {
            await fetchAPI(`/api/salary/monthly/${r.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'CONFIRMED' }),
            })
            ok++
          } catch {
            fail++
          }
        }
        hide()
        setApprovingAll(false)
        if (fail === 0) {
          messageApi.success(`Đã duyệt ${ok} bản ghi`)
        } else {
          messageApi.warning(`Thành công: ${ok}, Lỗi: ${fail}`)
        }
        fetchResults(page)
      },
    })
  }

  // ---- Export Excel ----

  const handleExport = () => {
    const month = selectedMonth.month() + 1
    const year = selectedMonth.year()
    const params = new URLSearchParams({
      month: String(month),
      year: String(year),
    })
    if (departmentId) params.set('departmentId', String(departmentId))
    window.location.href = `/api/salary/export?${params}`
  }

  // ---- Table columns ----

  const columns: ColumnsType<MonthlySalary> = [
    {
      title: 'STT',
      key: 'stt',
      width: 55,
      align: 'center',
      fixed: 'left',
      render: (_: unknown, __: MonthlySalary, i: number) => (page - 1) * 50 + i + 1,
    },
    {
      title: 'Mã NV',
      key: 'code',
      width: 90,
      fixed: 'left',
      render: (_: unknown, r: MonthlySalary) => <Text strong>{r.employee.code}</Text>,
    },
    {
      title: 'Họ tên',
      key: 'fullName',
      width: 180,
      fixed: 'left',
      render: (_: unknown, r: MonthlySalary) => r.employee.fullName,
    },
    {
      title: 'Phòng ban',
      key: 'dept',
      width: 140,
      render: (_: unknown, r: MonthlySalary) => r.employee.department?.name ?? '—',
    },
    {
      title: 'Ngày công',
      dataIndex: 'actualWorkDays',
      key: 'actualWorkDays',
      width: 100,
      align: 'center',
      render: (v: number) => v?.toFixed(1),
    },
    {
      title: 'Tổng thu nhập',
      dataIndex: 'totalIncome',
      key: 'totalIncome',
      align: 'right',
      width: 140,
      sorter: (a, b) => a.totalIncome - b.totalIncome,
      render: (v: number) => formatVND(v),
    },
    {
      title: 'Tổng khấu trừ',
      key: 'totalDeduction',
      align: 'right',
      width: 140,
      render: (_: unknown, r: MonthlySalary) => {
        const total =
          r.advanceDeduction +
          r.bhxhDeduction +
          r.bhytDeduction +
          r.bhtnDeduction +
          r.unionFeeDeduction +
          r.incomeTaxDeduction
        return formatVND(total)
      },
    },
    {
      title: 'Thực nhận',
      dataIndex: 'netSalary',
      key: 'netSalary',
      align: 'right',
      width: 140,
      sorter: (a, b) => a.netSalary - b.netSalary,
      render: (v: number) => (
        <Text strong style={{ color: '#237804' }}>
          {formatVND(v)}
        </Text>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      align: 'center',
      filters: [
        { text: 'Chưa duyệt', value: 'DRAFT' },
        { text: 'Đã duyệt', value: 'CONFIRMED' },
        { text: 'Đã khóa', value: 'LOCKED' },
      ],
      onFilter: (value: React.Key | boolean, record: MonthlySalary) =>
        record.status === value,
      render: (status: SalaryStatus) => (
        <Tag color={statusTagConfig[status].color}>
          {statusTagConfig[status].label}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 160,
      align: 'center',
      fixed: 'right',
      render: (_: unknown, record: MonthlySalary) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedRecord(record)
              setDrawerOpen(true)
            }}
          >
            Chi tiết
          </Button>
          {record.status === 'DRAFT' && (
            <Button
              size="small"
              type="primary"
              icon={<CheckOutlined />}
              loading={approvingIds.has(record.id)}
              onClick={() => handleApprove(record)}
            >
              Duyệt
            </Button>
          )}
        </Space>
      ),
    },
  ]

  // ---- Render ----

  return (
    <>
      {contextHolder}

      {/* ===== PHẦN 1: Controls ===== */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          Tính lương & Xem kết quả
        </Title>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <Space wrap size="middle">
          <Space>
            <Text type="secondary">Tháng:</Text>
            <DatePicker.MonthPicker
              value={selectedMonth}
              onChange={(val) => val && setSelectedMonth(val)}
              format="MM/YYYY"
              allowClear={false}
              size="middle"
            />
          </Space>
          <Space>
            <Text type="secondary">Phòng ban:</Text>
            <Select
              placeholder="Tất cả phòng ban"
              allowClear
              style={{ width: 240 }}
              value={departmentId}
              onChange={setDepartmentId}
              showSearch
              optionFilterProp="label"
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
            />
          </Space>
          <Button
            type="primary"
            size="middle"
            icon={<ThunderboltOutlined />}
            loading={calculating}
            onClick={handleCalculate}
            style={{ minWidth: 130 }}
          >
            {calculating ? 'Đang tính...' : 'Tính lương'}
          </Button>
        </Space>
      </Card>

      {/* ===== PHẦN 2: Statistic cards ===== */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Tổng NV đã tính lương"
            value={stats.count}
            suffix="người"
            color="#1677ff"
            loading={tableLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Tổng quỹ lương (thực nhận)"
            value={stats.totalFund}
            suffix=" đ"
            color="#237804"
            loading={tableLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Lương cao nhất"
            value={stats.maxSalary}
            suffix=" đ"
            color="#d46b08"
            loading={tableLoading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="Lương thấp nhất"
            value={stats.minSalary}
            suffix=" đ"
            color="#cf1322"
            loading={tableLoading}
          />
        </Col>
      </Row>

      {/* ===== PHẦN 3: Bảng kết quả ===== */}
      <Card>
        {/* Toolbar trên bảng */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text strong>
            Bảng lương tháng {selectedMonth.format('MM/YYYY')}
            {departmentId
              ? ` — ${departments.find((d) => d.id === departmentId)?.name ?? ''}`
              : ''}
          </Text>
          <Space>
            <Button
              icon={<CheckCircleOutlined />}
              onClick={handleApproveAll}
              loading={approvingAll}
              disabled={results.filter((r) => r.status === 'DRAFT').length === 0}
            >
              Duyệt tất cả (
              {results.filter((r) => r.status === 'DRAFT').length})
            </Button>
            <Button
              icon={<FileExcelOutlined />}
              onClick={handleExport}
              style={{ color: '#237804', borderColor: '#237804' }}
            >
              Xuất Excel
            </Button>
          </Space>
        </div>

        <Table
          rowKey="id"
          dataSource={results}
          columns={columns}
          loading={tableLoading}
          size="small"
          scroll={{ x: 1300 }}
          pagination={{
            current: page,
            pageSize: 50,
            total,
            showSizeChanger: false,
            showTotal: (t) => `Tổng ${t} bản ghi`,
            onChange: (pg) => fetchResults(pg),
          }}
        />
      </Card>

      {/* ===== DRAWER Chi tiết ===== */}
      <DetailDrawer
        record={selectedRecord}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  )
}
