'use client'

import { useState, useEffect } from 'react'
import {
  Form,
  InputNumber,
  DatePicker,
  Button,
  Row,
  Col,
  Card,
  message,
  Spin,
  Typography,
} from 'antd'
import dayjs, { Dayjs } from 'dayjs'

const { Title } = Typography

interface SalaryConfig {
  id?: string
  month: number
  year: number
  regionMinWage: number
  standardWorkDays: number
  mealAllowanceSunday: number
  shift3UnitPrice: number
  employeeBhxhRate: number
  employeeBhytRate: number
  employeeBhtnRate: number
  unionFeeRate: number
}

const fetchAPI = async (url: string, opts?: RequestInit) => {
  const res = await fetch(url, opts)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? 'Lỗi không xác định')
  }
  return res.json()
}

const moneyFormatter = (value: number | undefined) =>
  `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const moneyParser = (value: string | undefined) =>
  Number(value?.replace(/,/g, '') ?? 0)

export default function SalaryConfigPage() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs())

  const fetchConfig = async (month: Dayjs) => {
    setLoading(true)
    try {
      const data: SalaryConfig = await fetchAPI(
        `/api/salary/config?month=${month.month() + 1}&year=${month.year()}`
      )
      form.setFieldsValue({
        ...data,
        employeeBhxhRate: data.employeeBhxhRate * 100,
        employeeBhytRate: data.employeeBhytRate * 100,
        employeeBhtnRate: data.employeeBhtnRate * 100,
        unionFeeRate: data.unionFeeRate * 100,
      })
    } catch {
      // No config yet — reset to defaults
      form.resetFields()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig(selectedMonth)
  }, [selectedMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (values: SalaryConfig) => {
    setSaving(true)
    try {
      await fetchAPI('/api/salary/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          month: selectedMonth.month() + 1,
          year: selectedMonth.year(),
          employeeBhxhRate: values.employeeBhxhRate / 100,
          employeeBhytRate: values.employeeBhytRate / 100,
          employeeBhtnRate: values.employeeBhtnRate / 100,
          unionFeeRate: values.unionFeeRate / 100,
        }),
      })
      message.success('Lưu cấu hình thành công')
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Lỗi khi lưu')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          Cấu hình tham số lương
        </Title>
        <DatePicker.MonthPicker
          value={selectedMonth}
          onChange={(val) => val && setSelectedMonth(val)}
          format="MM/YYYY"
          allowClear={false}
        />
      </div>

      <Spin spinning={loading}>
        <Card>
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Row gutter={32}>
              {/* Cột trái */}
              <Col span={12}>
                <Form.Item
                  label="Lương tối thiểu vùng (đ)"
                  name="regionMinWage"
                  rules={[{ required: true, message: 'Vui lòng nhập' }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    formatter={moneyFormatter}
                    parser={moneyParser}
                    placeholder="Ví dụ: 4,680,000"
                  />
                </Form.Item>

                <Form.Item
                  label="Ngày công chuẩn"
                  name="standardWorkDays"
                  rules={[{ required: true, message: 'Vui lòng nhập' }]}
                >
                  <InputNumber style={{ width: '100%' }} min={1} max={31} placeholder="26" />
                </Form.Item>

                <Form.Item
                  label="Tiền ăn cơm Chủ Nhật (đ/ngày)"
                  name="mealAllowanceSunday"
                  rules={[{ required: true, message: 'Vui lòng nhập' }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    formatter={moneyFormatter}
                    parser={moneyParser}
                    placeholder="Ví dụ: 30,000"
                  />
                </Form.Item>

                <Form.Item
                  label="Đơn giá ca 3 (đ/ca)"
                  name="shift3UnitPrice"
                  rules={[{ required: true, message: 'Vui lòng nhập' }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    formatter={moneyFormatter}
                    parser={moneyParser}
                    placeholder="Ví dụ: 50,000"
                  />
                </Form.Item>
              </Col>

              {/* Cột phải */}
              <Col span={12}>
                <Form.Item
                  label="Tỷ lệ BHXH NLĐ đóng (%)"
                  name="employeeBhxhRate"
                  rules={[{ required: true, message: 'Vui lòng nhập' }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={100}
                    step={0.1}
                    placeholder="8"
                  />
                </Form.Item>

                <Form.Item
                  label="Tỷ lệ BHYT NLĐ đóng (%)"
                  name="employeeBhytRate"
                  rules={[{ required: true, message: 'Vui lòng nhập' }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={100}
                    step={0.1}
                    placeholder="1.5"
                  />
                </Form.Item>

                <Form.Item
                  label="Tỷ lệ BHTN NLĐ đóng (%)"
                  name="employeeBhtnRate"
                  rules={[{ required: true, message: 'Vui lòng nhập' }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={100}
                    step={0.1}
                    placeholder="1"
                  />
                </Form.Item>

                <Form.Item
                  label="Tỷ lệ Công đoàn phí (%)"
                  name="unionFeeRate"
                  rules={[{ required: true, message: 'Vui lòng nhập' }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={100}
                    step={0.1}
                    placeholder="1"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Button type="primary" htmlType="submit" loading={saving} size="large">
                Lưu cấu hình
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Spin>
    </div>
  )
}
