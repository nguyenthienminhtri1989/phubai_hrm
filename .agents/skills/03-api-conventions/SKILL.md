# SKILL-03: API ROUTES — MODULE TÍNH LƯƠNG

> Đọc SKILL-00 và SKILL-02 trước.
> Tất cả files trong `src/app/api/salary/`

## Template chuẩn cho mọi API route

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Chỉ ADMIN, HR_MANAGER, LEADER được GET module lương
  if (!['ADMIN','HR_MANAGER','LEADER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    // ... logic
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

// POST/PATCH/DELETE: chỉ ADMIN và HR_MANAGER
const canWrite = ['ADMIN','HR_MANAGER'].includes(session.user.role)
```

---

## Route 1: `src/app/api/salary/config/route.ts`

**GET** `?month=&year=` → trả về SalaryConfig của tháng đó (null nếu chưa có)  
**POST** body `{ month, year, regionMinWage, standardWorkDays, mealAllowanceSunday, shift3UnitPrice, employeeBhxhRate, employeeBhytRate, employeeBhtnRate, unionFeeRate, note }` → upsert

```typescript
// GET
const { searchParams } = new URL(request.url)
const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()))
const config = await prisma.salaryConfig.findUnique({ where: { month_year: { month, year } } })
return NextResponse.json(config)

// POST — dùng upsert
const body = await request.json()
const result = await prisma.salaryConfig.upsert({
  where: { month_year: { month: body.month, year: body.year } },
  update: body,
  create: body,
})
```

---

## Route 2: `src/app/api/salary/employee-info/route.ts`

**GET** `?employeeId=` hoặc `?departmentId=` → list EmployeeSalaryInfo, include Employee  
**POST** → tạo mới, tự động set `expiredDate` của bản cũ

```typescript
// POST logic quan trọng: đóng bản cũ trước
const { employeeId, effectiveDate, ...rest } = await request.json()

// Tìm bản đang active
const current = await prisma.employeeSalaryInfo.findFirst({
  where: { employeeId, expiredDate: null },
  orderBy: { effectiveDate: 'desc' },
})

await prisma.$transaction(async (tx) => {
  if (current) {
    await tx.employeeSalaryInfo.update({
      where: { id: current.id },
      data: { expiredDate: dayjs(effectiveDate).subtract(1, 'day').toDate() },
    })
  }
  await tx.employeeSalaryInfo.create({
    data: { employeeId, effectiveDate: new Date(effectiveDate), ...rest },
  })
})
```

## Route 3: `src/app/api/salary/employee-info/[id]/route.ts`

**PATCH** → update  
**DELETE** → chỉ ADMIN

---

## Route 4: `src/app/api/salary/performance/route.ts`

**GET** `?month=&year=&departmentId=` → list MonthlyPerformanceBonus join Employee  
**POST** body `{ employeeId, month, year, performanceCoefficient, productionCoefficient, shift3Days, bonusFullAttendance, bonusAdminWork, bonusShift3 }` → upsert

```typescript
const result = await prisma.monthlyPerformanceBonus.upsert({
  where: { employeeId_month_year: { employeeId, month, year } },
  update: { ...rest },
  create: { employeeId, month, year, ...rest },
})
```

---

## Route 5: `src/app/api/salary/advance/route.ts`

**GET** `?month=&year=&employeeId=`  
**POST** → tạo AdvancePayment, ghi `createdBy: session.user.username`

## Route 6: `src/app/api/salary/advance/[id]/route.ts`

**DELETE** → chỉ ADMIN và HR_MANAGER

---

## Route 7: `src/app/api/salary/calculate/route.ts` ⭐ QUAN TRỌNG NHẤT

```typescript
// POST body: { month: number, year: number, departmentId?: number, employeeIds?: number[] }
import { calculateMonthlySalary } from '@/lib/salary/calculator'

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN','HR_MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { month, year, departmentId, employeeIds } = await request.json()

  // Lấy danh sách NV cần tính
  let ids: number[] = employeeIds ?? []
  if (ids.length === 0) {
    const employees = await prisma.employee.findMany({
      where: {
        isActive: true,
        ...(departmentId ? { departmentId } : {}),
      },
      select: { id: true },
    })
    ids = employees.map(e => e.id)
  }

  const results = { success: 0, failed: 0, errors: [] as string[] }

  for (const employeeId of ids) {
    try {
      // Kiểm tra nếu đã CONFIRMED/LOCKED thì bỏ qua
      const existing = await prisma.monthlySalary.findUnique({
        where: { employeeId_month_year: { employeeId, month, year } },
      })
      if (existing?.status === 'CONFIRMED' || existing?.status === 'LOCKED') {
        results.errors.push(`NV ${employeeId}: đã ${existing.status}, bỏ qua`)
        continue
      }

      const calc = await calculateMonthlySalary({
        employeeId, month, year,
        calculatedBy: session.user.username,
      })

      await prisma.monthlySalary.upsert({
        where: { employeeId_month_year: { employeeId, month, year } },
        update: { ...calc, status: 'DRAFT', calculatedBy: session.user.username },
        create: { ...calc, status: 'DRAFT', calculatedBy: session.user.username },
      })
      results.success++
    } catch (err: any) {
      results.failed++
      results.errors.push(`NV ${employeeId}: ${err.message}`)
    }
  }

  return NextResponse.json(results)
}
```

---

## Route 8: `src/app/api/salary/monthly/route.ts`

**GET** `?month=&year=&departmentId=&status=&page=1&limit=50`

```typescript
const monthlySalaries = await prisma.monthlySalary.findMany({
  where: {
    month, year,
    ...(departmentId ? { employee: { departmentId } } : {}),
    ...(status ? { status } : {}),
  },
  include: {
    employee: { include: { department: true } },
    salaryInfo: true,
  },
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { employee: { fullName: 'asc' } },
})
```

## Route 9: `src/app/api/salary/monthly/[id]/route.ts`

**GET** → chi tiết 1 record, include employee + department  
**PATCH** body `{ status: 'CONFIRMED' | 'LOCKED' }` → cập nhật status, ghi `confirmedBy`

```typescript
// PATCH — validate transition
const { status } = await request.json()
const current = await prisma.monthlySalary.findUnique({ where: { id } })
if (current?.status === 'LOCKED') {
  return NextResponse.json({ error: 'Bảng lương đã khóa, không thể sửa' }, { status: 403 })
}
const updated = await prisma.monthlySalary.update({
  where: { id },
  data: {
    status,
    ...(status === 'CONFIRMED' ? { confirmedBy: session.user.username } : {}),
  },
})
```

---

## Route 10: `src/app/api/salary/export/route.ts`

**GET** `?month=&year=&departmentId=`

```typescript
import { exportSalaryExcel } from '@/lib/salary/excel-exporter'

const buffer = await exportSalaryExcel({ month, year, departmentId })
return new Response(buffer, {
  headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="bang-luong-${month}-${year}.xlsx"`,
  },
})
```
