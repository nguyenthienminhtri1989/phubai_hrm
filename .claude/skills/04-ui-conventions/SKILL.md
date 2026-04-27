# SKILL-04: UI PAGES — MODULE TÍNH LƯƠNG

> Đọc SKILL-00 trước. Tất cả pages trong `src/app/salary/`

## UI Conventions

```typescript
'use client'
import { useState, useEffect } from 'react'
import { Table, Form, Modal, Select, InputNumber, DatePicker,
         message, Button, Tag, Statistic, Spin, Drawer } from 'antd'

// Format tiền VNĐ
const formatVND = (v: number) => v?.toLocaleString('vi-VN') + ' đ'

// Fetch helper
const fetchAPI = async (url: string, opts?: RequestInit) => {
  const res = await fetch(url, opts)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? 'Lỗi không xác định')
  }
  return res.json()
}
```

---

## Page 1: `src/app/salary/layout.tsx`

```typescript
// Sub-navigation cho module lương
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/salary/calculate',    label: 'Tính lương' },
  { href: '/salary/performance',  label: 'Kết quả tháng' },
  { href: '/salary/advance',      label: 'Tạm ứng' },
  { href: '/salary/employee-info',label: 'Thông tin lương NV' },
  { href: '/salary/config',       label: 'Cấu hình' },
]
// Render horizontal tab bar với active state dựa vào usePathname()
// Wrap children bên dưới
```

---

## Page 2: `src/app/salary/config/page.tsx`

**Mục đích:** Cấu hình tham số lương theo tháng/năm

```typescript
// State: config object, loading, month/year selector (mặc định tháng hiện tại)

// Layout: DatePicker.MonthPicker ở trên cùng để chọn tháng
// Form 2 cột (Col span=12):
// Trái: regionMinWage, standardWorkDays, mealAllowanceSunday, shift3UnitPrice
// Phải: employeeBhxhRate(%), employeeBhytRate(%), employeeBhtnRate(%), unionFeeRate(%)
//       (InputNumber min=0 max=100 step=0.1, khi lưu chia 100)

// useEffect: fetch GET /api/salary/config?month=X&year=Y khi đổi tháng
// Submit: POST /api/salary/config với body đã nhân 100 → chia lại cho rates

// Component InputNumber cho tiền: formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
```

---

## Page 3: `src/app/salary/employee-info/page.tsx`

**Mục đích:** Quản lý thông tin lương từng NV

```typescript
// State: list[], loading, modalOpen, selectedRecord, departmentFilter

// Filter bar: Select chọn phòng ban → fetch GET /api/salary/employee-info?departmentId=X

// Table columns:
// [Mã NV, Họ tên, Phòng ban, Mức lương, Hệ số, Bậc/Cấp, PC ĐT, PC Đi lại, Hiệu lực từ, Thao tác]
// Render tiền: formatVND(record.baseSalary)

// Modal Form (tạo/sửa):
// - Select Employee (Search được, fetch /api/employees)
// - InputNumber baseSalary (formatter tiền)
// - InputNumber salaryCoefficient (step=0.01)
// - InputNumber salaryGrade, salaryLevel
// - InputNumber phoneAllowance, transportAllowance
// - DatePicker effectiveDate
// - Input note

// Submit: POST hoặc PATCH /api/salary/employee-info/[id]
```

---

## Page 4: `src/app/salary/performance/page.tsx`

**Mục đích:** Nhập hệ số & thưởng tháng cho từng NV

```typescript
// State: month/year filter, departmentId filter, data[], editingKey

// Quan trọng: fetch cùng lúc:
//   - GET /api/salary/performance?month=X&year=Y&departmentId=D
//   - GET /api/timesheets/monthly?... (để biết isKip của từng NV)
// Merge 2 dataset lại theo employeeId

// Table editable inline (Ant Design editable table pattern):
// Columns cố định: [Mã NV, Họ tên, Xếp loại (Tag từ MonthlyEvaluation)]
// Columns chung: [HS công việc*, Thưởng đủ công*]
// Columns chỉ SX (isKip=true): [Công ca 3*, HS sản xuất*, Thưởng ca 3*]
// Columns chỉ HC (isKip=false): [Thưởng HC*]
// (* = InputNumber editable)

// Nút "Lưu tất cả": loop qua changed rows, batch POST /api/salary/performance
// Hiển thị progress khi đang lưu: message.loading('Đang lưu...')
```

---

## Page 5: `src/app/salary/advance/page.tsx`

**Mục đích:** Quản lý tạm ứng lương

```typescript
// State: month/year filter, departmentId filter, data[], modalOpen

// Table columns: [Mã NV, Họ tên, Phòng ban, Số tiền, Ghi chú, Ngày tạo, Người tạo, Xóa]
// Render tiền: formatVND(record.amount)
// Xóa: chỉ ADMIN, DELETE /api/salary/advance/[id] + confirm('Xác nhận xóa?')

// Modal thêm tạm ứng:
// - Select Employee (search)
// - InputNumber amount (formatter tiền VNĐ)
// - Textarea note
// Submit: POST /api/salary/advance
```

---

## Page 6: `src/app/salary/calculate/page.tsx` ⭐ TRANG CHÍNH

**Mục đích:** Tính lương và xem kết quả

```typescript
// State: month/year, departmentId, calculating, results[], statsLoading, detailDrawerOpen, selectedRecord

// === PHẦN 1: Controls ===
// [DatePicker.MonthPicker] [Select phòng ban (optional)] [Button "Tính lương" + loading]
// Click "Tính lương":
//   1. setCalculating(true)
//   2. POST /api/salary/calculate với { month, year, departmentId }
//   3. Hiện kết quả: message.success(`Thành công: ${res.success}, Lỗi: ${res.failed}`)
//   4. Nếu có errors: Modal.warning với list lỗi
//   5. Reload bảng kết quả

// === PHẦN 2: Statistic cards (4 cards, layout Row+Col) ===
// - Tổng NV đã tính
// - Tổng quỹ lương (formatVND)
// - Lương cao nhất
// - Lương thấp nhất

// === PHẦN 3: Bảng kết quả ===
// Fetch GET /api/salary/monthly?month=X&year=Y&departmentId=D khi filter thay đổi
// Columns:
//   STT | Mã NV | Họ tên | Phòng ban | Ngày công | Tổng thu nhập | Tổng KT | Thực nhận | Status | Thao tác
// Status Tag: DRAFT=default, CONFIRMED=green, LOCKED=red
// Thao tác:
//   - [Xem chi tiết] → mở Drawer
//   - [Duyệt] (nếu DRAFT + role HR_MANAGER/ADMIN) → PATCH status=CONFIRMED
// Dưới bảng: [Duyệt tất cả] [Xuất Excel → window.location = /api/salary/export?...]

// === DRAWER Chi tiết ===
// Hiện đầy đủ breakdown:
// Section "Thu nhập": Lương TG, OT, Nghỉ Lễ/Phép, Ăn cơm CN, PC Ca 3, Lương cấp bậc CV, PC Đặc thù
// Section "Khấu trừ": Tạm ứng, BHXH, BHYT, BHTN, CĐ phí, Thuế TNCN
// Total row: Thực nhận (bold, lớn)
// Dùng Descriptions component của Ant Design (layout="vertical", column=2)
```

---

## Tích hợp Sidebar (`src/components/AdminLayout.tsx`)

Tìm mảng menu items, thêm vào:

```typescript
// Import: import { DollarOutlined } from '@ant-design/icons'
{
  key: 'salary',
  icon: <DollarOutlined />,
  label: 'Tiền lương',
  // Chỉ hiện nếu role là ADMIN hoặc HR_MANAGER
  children: [
    { key: '/salary/calculate',     label: 'Tính lương' },
    { key: '/salary/performance',   label: 'Kết quả tháng' },
    { key: '/salary/advance',       label: 'Tạm ứng' },
    { key: '/salary/employee-info', label: 'Thông tin lương NV' },
    { key: '/salary/config',        label: 'Cấu hình lương' },
  ],
}
```
