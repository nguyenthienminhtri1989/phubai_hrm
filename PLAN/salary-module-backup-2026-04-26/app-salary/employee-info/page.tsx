'use client'

import { useState, useEffect } from 'react'
import {
  Table,
  Form,
  Modal,
  Select,
  InputNumber,
  DatePicker,
  message,
  Button,
  Typography,
  Space,
} from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { Dayjs } from 'dayjs'

const { Title } = Typography

interface Department {
  id: string
  name: string
}

interface Employee {
  id: string
  employeeCode: string
  fullName: string
  department: Department
}

interface EmployeeSalaryInfo {
  id: string
  employeeId: string
  employee: Employee
  baseSalary: number
  salaryCoefficient: number
  salaryGrade: number
  salaryLevel: number
  phoneAllowance: number
  transportAllowance: number
  effectiveDate: string
  note?: string
}

const fetchAPI = async (url: string, opts?: RequestInit) => {
  const res = await fetch(url, opts)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? 'Lỗi không xác định')
  }
  return res.json()
}

const formatVND = (v: number) => (v ?? 0).toLocaleString('vi-VN') + ' đ'

const moneyFormatter = (value: number | undefined) =>
  `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const moneyParser = (value: string | undefined) =>
  Number(value?.replace(/,/g, '') ?? 0)

export default function EmployeeInfoPage() {
  const [form] = Form.useForm()
  const [data, setData] = useState<EmployeeSalaryInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<EmployeeSalaryInfo | null>(null)
  const [departmentFilter, setDepartmentFilter] = useState<string | undefined>()
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  const fetchData = async (departmentId?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (departmentId) params.set('departmentId', departmentId)
      const result = await fetchAPI(`/api/salary/employee-info?${params}`)
      setData(result)
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Fetch departments & employees for filters/form
    fetchAPI('/api/departments').then(setDepartments).catch(() => {})
    fetchAPI('/api/employees').then(setEmployees).catch(() => {})
    fetchData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setSelectedRecord(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (record: EmployeeSalaryInfo) => {
    setSelectedRecord(record)
    form.setFieldsValue({
      ...record,
      employeeId: record.employeeId,
      effectiveDate: dayjs(record.effectiveDate),
    })
    setModalOpen(true)
  }

  const handleSubmit = async (values: EmployeeSalaryInfo & { effectiveDate: Dayjs }) => {
    setSaving(true)
    try {
      const payload = {
        ...values,
        effectiveDate: values.effectiveDate.format('YYYY-MM-DD'),
      }
      if (selectedRecord) {
        await fetchAPI(`/api/salary/employee-info/${selectedRecord.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        message.success('Cập nhật thành công')
      } else {
        await fetchAPI('/api/salary/employee-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        message.success('Thêm thành công')
      }
      setModalOpen(false)
      fetchData(departmentFilter)
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Lỗi khi lưu')
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnsType<EmployeeSalaryInfo> = [
    {
      title: 'Mã NV',
      key: 'employeeCode',
      width: 100,
      render: (_, r) => r.employee.employeeCode,
    },
    {
      title: 'Họ tên',
      key: 'fullName',
      render: (_, r) => r.employee.fullName,
    },
    {
      title: 'Phòng ban',
      key: 'department',
      render: (_, r) => r.employee.department.name,
    },
    {
      title: 'Mức lương',
      dataIndex: 'baseSalary',
      align: 'right',
      render: (v: number) => formatVND(v),
    },
    {
      title: 'Hệ số',
      dataIndex: 'salaryCoefficient',
      align: 'center',
      render: (v: number) => v?.toFixed(2),
    },
    {
      title: 'Bậc',
      dataIndex: 'salaryGrade',
      align: 'center',
    },
    {
      title: 'Cấp',
      dataIndex: 'salaryLevel',
      align: 'center',
    },
    {
      title: 'PC Điện thoại',
      dataIndex: 'phoneAllowance',
      align: 'right',
      render: (v: number) => formatVND(v),
    },
    {
      title: 'PC Đi lại',
      dataIndex: 'transportAllowance',
      align: 'right',
      render: (v: number) => formatVND(v),
    },
    {
      title: 'Hiệu lực từ',
      dataIndex: 'effectiveDate',
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => openEdit(record)}
        >
          Sửa
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          Thông tin lương nhân viên
        </Title>
        <Space>
          <Select
            placeholder="Lọc theo phòng ban"
            allowClear
            style={{ width: 220 }}
            onChange={(val) => {
              setDepartmentFilter(val)
              fetchData(val)
            }}
          >
            {departments.map((d) => (
              <Select.Option key={d.id} value={d.id}>
                {d.name}
              </Select.Option>
            ))}
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm mới
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        dataSource={data}
        columns={columns}
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1100 }}
        size="small"
      />

      <Modal
        title={selectedRecord ? 'Cập nhật thông tin lương' : 'Thêm thông tin lương'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={640}
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
              disabled={!!selectedRecord}
              placeholder="Tìm theo tên hoặc mã NV"
              optionFilterProp="label"
              options={employees.map((e) => ({
                value: e.id,
                label: `${e.employeeCode} — ${e.fullName}`,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="Mức lương cơ bản (đ)"
            name="baseSalary"
            rules={[{ required: true, message: 'Vui lòng nhập mức lương' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              formatter={moneyFormatter}
              parser={moneyParser}
              placeholder="Ví dụ: 5,000,000"
            />
          </Form.Item>

          <Form.Item label="Hệ số lương" name="salaryCoefficient">
            <InputNumber style={{ width: '100%' }} min={0} step={0.01} placeholder="1.00" />
          </Form.Item>

          <Form.Item label="Bậc" name="salaryGrade">
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>

          <Form.Item label="Cấp" name="salaryLevel">
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>

          <Form.Item label="Phụ cấp điện thoại (đ)" name="phoneAllowance">
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              formatter={moneyFormatter}
              parser={moneyParser}
              placeholder="0"
            />
          </Form.Item>

          <Form.Item label="Phụ cấp đi lại (đ)" name="transportAllowance">
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              formatter={moneyFormatter}
              parser={moneyParser}
              placeholder="0"
            />
          </Form.Item>

          <Form.Item
            label="Hiệu lực từ ngày"
            name="effectiveDate"
            rules={[{ required: true, message: 'Vui lòng chọn ngày' }]}
          >
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item label="Ghi chú" name="note">
            <Form.Item name="note" noStyle>
              <input
                style={{
                  width: '100%',
                  padding: '4px 11px',
                  border: '1px solid #d9d9d9',
                  borderRadius: 6,
                }}
                placeholder="Ghi chú (nếu có)"
              />
            </Form.Item>
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={saving}>
                {selectedRecord ? 'Cập nhật' : 'Thêm mới'}
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
