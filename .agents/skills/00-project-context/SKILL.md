# SKILL-00: PROJECT CONTEXT — PHUBAI-HRM

## Stack
Next.js 15 App Router · TypeScript · Prisma + PostgreSQL · Ant Design · NextAuth v5 · ExcelJS · dayjs

## Conventions bắt buộc
- API params: `const { id } = await props.params` (params là Promise trong Next.js 15)
- API auth: `const session = await auth()` — 401 nếu null
- API error: `NextResponse.json({ error: "..." }, { status: xxx })`
- UI pages: luôn có `'use client'`
- Tiền VNĐ: `Math.round()` — không để float
- Format hiển thị: `value.toLocaleString('vi-VN')`

## Roles & quyền module lương
| Role | Quyền |
|---|---|
| ADMIN | Toàn quyền |
| HR_MANAGER | CRUD lương, tính lương, duyệt |
| LEADER | Chỉ GET (xem) |
| TIMEKEEPER | Không vào module lương |

## 2 khối nhân viên — QUAN TRỌNG
```typescript
// Xác định qua Department.isKip
const isProductionWorker = employee.department.isKip === true
```
- `isKip = false` → Khối HC: KHÔNG có ca 3, thưởng ca 3, HS sản xuất
- `isKip = true`  → Khối SX: CÓ ca 3, thưởng ca 3, HS sản xuất theo ca

## AttendanceCode quan trọng
```typescript
const FULL_DAY_CODES    = ['X','XD','CT','LĐ','XL','LE','LD','F','R','L','ĐC'] // factor=1
const HALF_DAY_CODES    = ['X/2']                                                // factor=0.5
const HOLIDAY_LEAVE_CODES = ['F','L','R','ĐC']                                   // nghỉ có lương
// Ca 3 / CN: check bằng dayjs(date).day() === 0 (Chủ nhật)
// shift3Days: nhập thủ công trong MonthlyPerformanceBonus — không tự động từ Timesheet
```
