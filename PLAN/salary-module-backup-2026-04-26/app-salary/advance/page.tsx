'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Table,
  Form,
  Modal,
  Select,
  InputNumber,
  message,
  Button,
  Typography,
  Space,
  DatePicker,
  Popconfirm,
  Row,
  Col,
  Card,
  Statistic,
  Tag,
  Input,
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { Dayjs } from 'dayjs'

const { Title, Text } = Typography
const { TextArea } = Input

// ---- Types ----

interface Department {
  id: number
  name: string
}

interface Employee {
  id: number
  code: string
  fullName: string
  department?: { id: number; name: string }
}

interface AdvanceRecord {
  id: number
  employeeId: number
  employee: {
    id: number
    code: string
    fullName: string
    department?: { name: string }
  }
  amount: number
  note: string | null
  month: number
  year: number
  createdAt: string
  createdBy: string | null
}

// ---- Helpers ----

const formatVND = (v: number | null | undefined): string =>
  v != null ? v.toLocaleString('vi-VN') + ' đ' : '—'

const moneyFormatter = (value: number | undefined) =>
  `${value ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const moneyParser = (value: string | undefined): number =>
  Number(value?.replace(/,/g, '') ?? 0)

const fetchAPI = async (url: string, opts?: RequestInit) => {
  const res = await fetch(url, opts)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? 'Lỗi không xác định')
  }
  return res.json()
}

// ---- Page Component ----

export default function AdvancePage() {
  const [form] = Form.useForm()
  const [messageApi, contextHolder] = message.useMessage()

  // Filter state
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs())
  const [departmentId, setDepartmentId] = useState<number | undefined>()

  // Data state
  const [data, setData] = useState<AdvanceRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])

  // UI state
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // ---- Fetch ----

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        month: String(selectedMonth.month() + 1),
        year: String(selectedMonth.year()),
      })
      if (departmentId) params.set('departmentId', String(departmentId))
      const result = await fetchAPI(`/api/salary/advance?${params}`)
      setData(result)
    } catch (err: unknown) {
      messageApi.error(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [selectedMonth, departmentId, messageApi])

  useEffect(() => {
    fetchAPI('/api/departments').then(setDepartments).catch(() => {})
    fetchAPI('/api/employees').then(setEmployees).catch(() => {})
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ---- Actions ----

  const handleDelete = async (id: number) => {
    try {
      await fetchAPI(`/api/salary/advance/${id}`, { method: 'DELETE' })
      messageApi.success('Đã xóa tạm ứng')
      fetchData()
    } catch (err: unknown) {
      messageApi.error(err instanceof Error ? err.message : 'Lỗi khi xóa')
    }
  }

  const handleSubmit = async (values: {
    employeeId: number
    amount: number
    note?: string
  }) => {
    setSaving(true)
    try {
      await fetchAPI('/api/salary/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: values.employeeId,
          amount: Math.round(values.amount),
          note: values.note ?? null,
          month: selectedMonth.month() + 1,
          year: selectedMonth.year(),
        }),
      })
      messageApi.success('Thêm tạm ứng thành công')
      setModalOpen(false)
      form.resetFields()
      fetchData()
    } catch (err: unknown) {
      messageApi.error(err instanceof Error ? err.message : 'Lỗi khi lưu')
    } finally {
      setSaving(false)
    }
  }

  // ---- Statistics ----

  const totalAmount = data.reduce((sum, r) => sum + r.amount, 0)

  // ---- Table columns ----

  const columns: ColumnsType<AdvanceRecord> = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      render: (_: unknown, __: AdvanceRecord, index: number) => index + 1,
    },
    {
      title: 'Mã NV',
      key: 'code',
      width: 100,
      render: (_: unknown, r: AdvanceRecord) => (
        <Text strong>{r.employee.code}</Text>
      ),
    },
    {
      title: 'Họ tên',
      key: 'fullName',
      render: (_: unknown, r: AdvanceRecord) => r.employee.fullName,
    },
    {
      title: 'Phòng ban',
      key: 'department',
      render: (_: unknown, r: AdvanceRecord) =>
        r.employee.department?.name ? (
          <Tag color="blue">{r.employee.department.name}</Tag>
        ) : (
          '—'
        ),
    },
    {
      title: 'Số tiền tạm ứng',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v: number) => (
        <Text strong style={{ color: '#cf1322' }}>
          {formatVND(v)}
        </Text>
      ),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'note',
      key: 'note',
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 130,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Người tạo',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 130,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Xóa',
      key: 'delete',
      width: 80,
      align: 'center',
      render: (_: unknown, record: AdvanceRecord) => (
        <Popconfirm
          title="Xác nhận xóa?"
          description="Bạn có chắc chắn muốn xóa khoản tạm ứng này?"
          okText="Xóa"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
          onConfirm={() => handleDelete(record.id)}
        >
          <Button
            size="small"
            danger
            type="text"
            icon={<DeleteOutlined />}
            title="Xóa tạm ứng"
          />
        </Popconfirm>
      ),
    },
  ]

  // ---- Render ----

  return (
    <>
      {contextHolder}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          Quản lý tạm ứng lương
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.resetFields()
            setModalOpen(true)
          }}
        >
          Thêm tạm ứng
        </Button>
      </div>

      {/* Bộ lọc */}
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
          onChange={(val) => setDepartmentId(val)}
          optionFilterProp="label"
          showSearch
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
        />
      </Space>

      {/* Thống kê */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="Tháng / Năm"
              value={selectedMonth.format('MM/YYYY')}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="Số khoản tạm ứng"
              value={data.length}
              suffix="khoản"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="Tổng tiền tạm ứng"
              value={totalAmount}
              formatter={(v) => `${Number(v).toLocaleString('vi-VN')} đ`}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Bảng dữ liệu */}
      <Table
        rowKey="id"
        dataSource={data}
        columns={columns}
        loading={loading}
        size="small"
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `Tổng ${total} bản ghi`,
        }}
        scroll={{ x: 1000 }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={4}>
                <Text strong>Tổng cộng</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right">
                <Text strong style={{ color: '#cf1322' }}>
                  {formatVND(totalAmount)}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} colSpan={4} />
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />

      {/* Modal thêm tạm ứng */}
      <Modal
        title={`Thêm tạm ứng — Tháng ${selectedMonth.format('MM/YYYY')}`}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={saving}
        width={480}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
          <Form.Item
            label="Nhân viên"
            name="employeeId"
            rules={[{ required: true, message: 'Vui lòng chọn nhân viên' }]}
          >
            <Select
              showSearch
              placeholder="Tìm theo tên hoặc mã NV"
              optionFilterProp="label"
              options={employees.map((e) => ({
                value: e.id,
                label: `${e.code} — ${e.fullName}${e.department ? ` (${e.department.name})` : ''}`,
              }))}
              notFoundContent="Không tìm thấy nhân viên"
            />
          </Form.Item>

          <Form.Item
            label="Số tiền tạm ứng (đ)"
            name="amount"
            rules={[
              { required: true, message: 'Vui lòng nhập số tiền' },
              { type: 'number', min: 1, message: 'Số tiền phải lớn hơn 0' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              formatter={moneyFormatter}
              parser={moneyParser}
              placeholder="Ví dụ: 1,000,000"
              addonAfter="đ"
            />
          </Form.Item>

          <Form.Item label="Ghi chú" name="note">
            <TextArea
              rows={3}
              placeholder="Lý do tạm ứng (nếu có)"
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
