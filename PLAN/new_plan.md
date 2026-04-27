# PLAN: MODULE TÍNH LƯƠNG — PHUBAI-HRM

> Tài liệu này dành cho **Claude Code** đọc và thực thi từng bước.  
> Đọc toàn bộ PLAN trước khi bắt đầu viết code. Không được bỏ qua bước nào.

---

## 1. TỔNG QUAN DỰ ÁN

**Hệ thống:** PHUBAI-HRM — Quản lý nhân sự & chấm công cho Công ty Cổ phần Sợi Phú Bài (~650 NV, 3 nhà máy).  
**Tech stack:** Next.js 15 App Router · TypeScript · Prisma + PostgreSQL · Ant Design · NextAuth v5 · ExcelJS · dayjs  
**Mục tiêu PLAN này:** Xây dựng hoàn chỉnh **Module Tính Lương** bao gồm Database schema, API, Business logic, và UI.

---

## 2. KIẾN TRÚC DỮ LIỆU — NHỮNG GÌ ĐÃ CÓ

```
File: prisma/schema.prisma (đã có sẵn, KHÔNG được xóa hay sửa các model cũ)

Model hiện có:
- Factory, Kip, Department (có trường isKip: Boolean)
- Employee (có: departmentId, kipId, timesheets, evaluations, overtimeRecords)
- AttendanceCode (có trường: code, factor, category)
- Timesheet (unique: [employeeId, date]) — nguồn dữ liệu chấm công
- MonthlyEvaluation (unique: [employeeId, month, year]) — xếp loại A/B/C
- OvertimeRecord (startTime, endTime, totalMinutes) — ghi nhận làm thêm giờ
- User, LockRule, LockRuleDepartment
```

**Các AttendanceCode quan trọng cần biết:**

- Full-day (factor=1): `X`, `XD`, `CT`, `LĐ`, `XL`, `LE`, `LD`, `F`, `R`, `L`, `ĐC`
- Half-day (factor=0.5): `X/2`
- Ca 3 (ca đêm): `X` có kíp = ca 3 — được xác định qua `Employee.kipId != null` VÀ `Department.isKip = true`
- Nghỉ Lễ/Phép có lương: `F`, `L`, `R`, `ĐC`
- Chủ nhật đi làm: dựa trên `dayjs(date).day() === 0`

---

## 3. SCHEMA CẦN BỔ SUNG (thêm vào cuối `prisma/schema.prisma`)

### Bước 3.1 — Thêm 2 model mới: SalaryGrade và JobCoefficientConfig

```prisma
// Thang bậc lương (từ file THANG_LƯƠNG_VÀ_HỆ_SỐ_CV.xlsx)
model SalaryGrade {
  id                  Int      @id @default(autoincrement())
  // Nhóm thang lương: "CN_SAN_XUAT" | "LAI_XE" | "CHUYEN_MON_DH" | "CHUYEN_MON_CD" | "QUAN_LY"
  gradeGroup          String
  gradeNumber         Int      // Bậc 1, 2, 3... 9 (hoặc 12)
  coefficient         Float    // Hệ số: 1.25, 1.33, 1.42...
  baseSalaryAmount    Float    // Mức lương tương ứng (VD: 5,175,000)
  minMonthsRequired   Int      @default(0) // Điều kiện tháng kinh nghiệm tối thiểu để lên bậc
  effectiveYear       Int      // Năm áp dụng (VD: 2026)
  note                String?

  @@unique([gradeGroup, gradeNumber, effectiveYear])
}

// Hệ số công việc theo chức danh (từ sheet "HS CV MỚI")
model JobCoefficientConfig {
  id           Int      @id @default(autoincrement())
  // Nhóm chức danh: "LANH_DAO" | "GIAM_DOC_TRUONG_PHONG" | "TO_TRUONG" | "CHUYEN_VIEN" | "CONG_NHAN"
  jobGroup     String
  jobTitle     String   // Tên chức danh: "Tổng Giám đốc", "Tổ trưởng cấp I"...
  coefficient  Float    // Hệ số CV: 200, 95, 35, 7.9...
  gradeMin     Int?     // Áp dụng từ bậc (null = tất cả)
  gradeMax     Int?     // Áp dụng đến bậc (null = tất cả)
  effectiveDate DateTime
  note         String?
}
```

### Bước 3.2 — Thêm 5 model module lương (đã thiết kế sẵn, copy nguyên vào schema)

```prisma
model SalaryConfig {
  id                   Int      @id @default(autoincrement())
  month                Int
  year                 Int
  regionMinWage        Float    @default(4140000)  // Lương TT vùng: 4,140,000
  standardWorkDays     Int      @default(26)         // Ngày công chuẩn
  mealAllowanceSunday  Float    @default(0)          // Đơn giá ăn cơm CN
  shift3UnitPrice      Float    @default(0)          // Đơn giá phụ cấp ca 3/công
  companyBhxhRate      Float    @default(0.175)      // Công ty đóng BHXH 17.5%
  companyBhtnRate      Float    @default(0.01)       // Công ty đóng BHTN 1%
  companyBhytRate      Float    @default(0.03)       // Công ty đóng BHYT 3%
  employeeBhxhRate     Float    @default(0.08)       // NLĐ đóng BHXH 8%
  employeeBhtnRate     Float    @default(0.01)       // NLĐ đóng BHTN 1%
  employeeBhytRate     Float    @default(0.015)      // NLĐ đóng BHYT 1.5%
  unionFeeRate         Float    @default(0.01)       // Công đoàn phí 1%
  note                 String?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  @@unique([month, year])
}

model EmployeeSalaryInfo {
  id                   Int       @id @default(autoincrement())
  employeeId           Int
  employee             Employee  @relation("SalaryInfos", fields: [employeeId], references: [id], onDelete: Cascade)
  baseSalary           Float     // Mức lương cơ bản thỏa thuận
  salaryCoefficient    Float     // Hệ số lương
  salaryGrade          Int?      // Bậc lương (1..9)
  salaryLevel          Int?      // Cấp (cấp 1, cấp 2 trong cùng bậc)
  phoneAllowance       Float     @default(0)  // Phụ cấp điện thoại
  transportAllowance   Float     @default(0)  // Phụ cấp đi lại/xăng xe
  effectiveDate        DateTime
  expiredDate          DateTime?
  note                 String?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  monthlySalaries      MonthlySalary[]
}

model MonthlyPerformanceBonus {
  id                     Int      @id @default(autoincrement())
  employeeId             Int
  employee               Employee @relation("PerformanceBonuses", fields: [employeeId], references: [id], onDelete: Cascade)
  month                  Int
  year                   Int
  performanceCoefficient Float    @default(0)  // Hệ số kết quả công việc (VD: 361 điểm)
  productionCoefficient  Float    @default(0)  // Hệ số KQSX theo ca (chỉ khối SX)
  bonusFullAttendance    Float    @default(0)  // Thưởng đủ công
  bonusAdminWork         Float    @default(0)  // Thưởng công hành chính (chỉ khối HC)
  bonusShift3            Float    @default(0)  // Thưởng ca 3 (chỉ khối SX)
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
  @@unique([employeeId, month, year])
}

model AdvancePayment {
  id           Int      @id @default(autoincrement())
  employeeId   Int
  employee     Employee @relation("AdvancePayments", fields: [employeeId], references: [id], onDelete: Cascade)
  month        Int
  year         Int
  amount       Float
  note         String?
  createdBy    String?  // Username người tạo (khớp với User.username)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model MonthlySalary {
  id                     Int                  @id @default(autoincrement())
  employeeId             Int
  employee               Employee             @relation("MonthlySalaries", fields: [employeeId], references: [id], onDelete: Cascade)
  salaryInfoId           Int?
  salaryInfo             EmployeeSalaryInfo?  @relation(fields: [salaryInfoId], references: [id])
  month                  Int
  year                   Int
  // === Dữ liệu công từ Timesheet ===
  actualWorkDays         Float    @default(0)  // Tổng ngày công (full=1, half=0.5)
  shift3Days             Float    @default(0)  // Công ca 3 (chỉ khối SX)
  sundayWorkDays         Float    @default(0)  // Số CN đi làm (tính ăn cơm)
  holidayLeaveDays       Float    @default(0)  // Nghỉ Lễ/Phép có lương
  // === Các khoản thu nhập ===
  timeSalary             Float    @default(0)  // Lương thời gian
  overtimeSalary         Float    @default(0)  // Lương thêm giờ OT
  holidaySalary          Float    @default(0)  // Tiền nghỉ Lễ/Phép
  mealAllowance          Float    @default(0)  // Ăn cơm CN
  shift3Allowance        Float    @default(0)  // Phụ cấp ca 3 (khối SX)
  performanceSalary      Float    @default(0)  // Tổng lương cấp bậc công việc
  specialAllowance       Float    @default(0)  // PC đặc thù + điện thoại + đi lại
  totalIncome            Float    @default(0)  // Tổng thu nhập
  // === Các khoản khấu trừ ===
  advanceDeduction       Float    @default(0)  // Tạm ứng
  bhxhDeduction          Float    @default(0)  // BHXH NLĐ (8%)
  bhytDeduction          Float    @default(0)  // BHYT NLĐ (1.5%)
  bhtnDeduction          Float    @default(0)  // BHTN NLĐ (1%)
  unionFeeDeduction      Float    @default(0)  // Công đoàn phí (1%)
  mealDeduction          Float    @default(0)  // Trừ ăn cơm CN (đối trừ)
  incomeTaxDeduction     Float    @default(0)  // Thuế TNCN
  // === Kết quả ===
  netSalary              Float    @default(0)  // Thực nhận
  status                 SalaryStatus @default(DRAFT)
  note                   String?
  calculatedBy           String?  // Username người tính
  confirmedBy            String?  // Username người duyệt
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
  @@unique([employeeId, month, year])
}

enum SalaryStatus {
  DRAFT      // Đang tính, chưa duyệt
  CONFIRMED  // Đã duyệt bởi HR_MANAGER
  LOCKED     // Đã khóa, không được sửa
}
```

### Bước 3.3 — Cập nhật model Employee (thêm 4 relations, KHÔNG xóa gì cũ)

Thêm vào cuối block Employee, trước dấu `}`:

```prisma
  salaryInfos          EmployeeSalaryInfo[]      @relation("SalaryInfos")
  performanceBonuses   MonthlyPerformanceBonus[] @relation("PerformanceBonuses")
  advancePayments      AdvancePayment[]           @relation("AdvancePayments")
  monthlySalaries      MonthlySalary[]            @relation("MonthlySalaries")
```

### Bước 3.4 — Chạy migration

```bash
npx prisma migrate dev --name add_salary_module
npx prisma generate
```

---

## 4. BUSINESS LOGIC CỐT LÕI — ĐỌC KỸ TRƯỚC KHI CODE

### 4.1. Phân biệt 2 khối nhân viên

```typescript
// Xác định khối qua Department.isKip
const isProductionWorker = employee.department.isKip === true;
```

| Khoản                                 | Khối HC (isKip=false) | Khối SX (isKip=true) |
| ------------------------------------- | --------------------- | -------------------- |
| Lương thời gian                       | ✅                    | ✅                   |
| Lương cấp bậc CV                      | ✅                    | ✅                   |
| Thưởng đủ công                        | ✅                    | ✅                   |
| PC xăng xe / ĐT                       | ✅                    | ✅                   |
| Thưởng HC (bonusAdminWork)            | ✅                    | ❌                   |
| PC ca 3 (shift3Allowance)             | ❌                    | ✅                   |
| Thưởng ca 3 (bonusShift3)             | ❌                    | ✅                   |
| HS sản xuất theo ca (productionCoeff) | ❌                    | ✅                   |

### 4.2. Logic đếm công từ Timesheet

```typescript
// Lấy tất cả timesheet của NV trong tháng, join với AttendanceCode
const timesheets = await prisma.timesheet.findMany({
  where: { employeeId, date: { gte: startOfMonth, lte: endOfMonth } },
  include: { attendanceCode: true },
});

// Full-day codes (factor = 1)
const FULL_DAY_CODES = [
  "X",
  "XD",
  "CT",
  "LĐ",
  "XL",
  "LE",
  "LD",
  "F",
  "R",
  "L",
  "ĐC",
];
// Half-day codes (factor = 0.5)
const HALF_DAY_CODES = ["X/2"];
// Nghỉ Lễ/Phép có lương (để tính holidaySalary riêng)
const HOLIDAY_LEAVE_CODES = ["F", "L", "R", "ĐC"];

let actualWorkDays = 0;
let shift3Days = 0;
let sundayWorkDays = 0;
let holidayLeaveDays = 0;

for (const ts of timesheets) {
  const code = ts.attendanceCode.code;
  const date = dayjs(ts.date);
  const isSunday = date.day() === 0;

  if (FULL_DAY_CODES.includes(code)) {
    actualWorkDays += 1;
    if (isSunday) sundayWorkDays += 1;
    if (HOLIDAY_LEAVE_CODES.includes(code)) holidayLeaveDays += 1;
  } else if (HALF_DAY_CODES.includes(code)) {
    actualWorkDays += 0.5;
  }
}

// Shift 3 (ca đêm): chỉ áp dụng nếu isProductionWorker
// Lấy từ MonthlyPerformanceBonus.shift3Days HOẶC tính từ Timesheet nếu có trường riêng
// Hiện tại: lấy từ MonthlyPerformanceBonus được nhập thủ công bởi HR_MANAGER
```

### 4.3. Công thức tính lương — Chi tiết

```typescript
// ===== BƯỚC 1: Lấy dữ liệu đầu vào =====
const config = await prisma.salaryConfig.findUnique({
  where: { month_year: { month, year } },
});
const salaryInfo = await prisma.employeeSalaryInfo.findFirst({
  where: {
    employeeId,
    effectiveDate: { lte: lastDayOfMonth },
    OR: [{ expiredDate: null }, { expiredDate: { gte: firstDayOfMonth } }],
  },
  orderBy: { effectiveDate: "desc" },
});
const perfBonus = await prisma.monthlyPerformanceBonus.findUnique({
  where: { employeeId_month_year: { employeeId, month, year } },
});
const advances = await prisma.advancePayment.findMany({
  where: { employeeId, month, year },
});
const evaluation = await prisma.monthlyEvaluation.findUnique({
  where: { employeeId_month_year: { employeeId, month, year } },
});

// ===== BƯỚC 2: Tính lương thời gian =====
// timeSalary = baseSalary × (actualWorkDays / standardWorkDays)
const timeSalary =
  salaryInfo.baseSalary * (actualWorkDays / config.standardWorkDays);

// ===== BƯỚC 3: Ăn cơm CN & Phụ cấp ca 3 =====
const mealAllowance = sundayWorkDays * config.mealAllowanceSunday;
// shift3Allowance: chỉ khối SX
const shift3Allowance = isProductionWorker
  ? (perfBonus?.shift3Days ?? 0) * config.shift3UnitPrice
  : 0;

// ===== BƯỚC 4: Lương cấp bậc công việc (performanceSalary) =====
// = (performanceCoefficient × tiền/điểm × % xếp loại) + bonusShift3 + bonusFullAttendance + bonusAdminWork + productionCoeff × đơn giá + PC xăng xe
// Lưu ý: performanceSalary được nhập/tính thủ công từ bảng MonthlyPerformanceBonus
// Công thức rút gọn từ Excel:
const gradeRating =
  evaluation?.grade === "A" ? 1.0 : evaluation?.grade === "B" ? 0.8 : 0.6;
const performanceSalaryBase =
  (perfBonus?.performanceCoefficient ?? 0) * gradeRating;
const productionSalary = isProductionWorker
  ? (perfBonus?.productionCoefficient ?? 0)
  : 0;
const performanceSalary =
  performanceSalaryBase +
  productionSalary +
  (isProductionWorker ? (perfBonus?.bonusShift3 ?? 0) : 0) +
  (perfBonus?.bonusFullAttendance ?? 0) +
  (!isProductionWorker ? (perfBonus?.bonusAdminWork ?? 0) : 0);

// ===== BƯỚC 5: Phụ cấp đặc thù =====
const specialAllowance =
  (salaryInfo?.phoneAllowance ?? 0) + (salaryInfo?.transportAllowance ?? 0);

// ===== BƯỚC 6: Tổng thu nhập =====
const totalIncome =
  timeSalary +
  overtimeSalary +
  holidaySalary +
  mealAllowance +
  shift3Allowance +
  performanceSalary +
  specialAllowance;

// ===== BƯỚC 7: Khấu trừ =====
// Lương làm căn cứ đóng BH = baseSalary (không phải tổng thu nhập)
const bhSalaryBase = salaryInfo.baseSalary;
const bhxhDeduction = bhSalaryBase * config.employeeBhxhRate; // 8%
const bhytDeduction = bhSalaryBase * config.employeeBhytRate; // 1.5%
const bhtnDeduction = bhSalaryBase * config.employeeBhtnRate; // 1%
const unionFeeDeduction = bhSalaryBase * config.unionFeeRate; // 1%
const advanceDeduction = advances.reduce((sum, a) => sum + a.amount, 0);
const mealDeduction = mealAllowance; // Ăn cơm CN: cộng vào rồi trừ lại = 0 net (hoặc giữ nguyên tùy cấu hình)

// ===== BƯỚC 8: Thực nhận =====
const netSalary =
  totalIncome -
  advanceDeduction -
  bhxhDeduction -
  bhytDeduction -
  bhtnDeduction -
  unionFeeDeduction -
  incomeTaxDeduction;
```

---

## 5. CẤU TRÚC FILE CẦN TẠO

```
src/
├── app/
│   ├── api/
│   │   └── salary/
│   │       ├── config/
│   │       │   └── route.ts              # GET/POST SalaryConfig
│   │       ├── employee-info/
│   │       │   ├── route.ts              # GET/POST EmployeeSalaryInfo
│   │       │   └── [id]/route.ts         # PATCH/DELETE
│   │       ├── performance/
│   │       │   ├── route.ts              # GET/POST MonthlyPerformanceBonus
│   │       │   └── [id]/route.ts         # PATCH
│   │       ├── advance/
│   │       │   ├── route.ts              # GET/POST AdvancePayment
│   │       │   └── [id]/route.ts         # DELETE
│   │       ├── calculate/
│   │       │   └── route.ts              # POST — engine tính lương
│   │       ├── monthly/
│   │       │   ├── route.ts              # GET (danh sách bảng lương)
│   │       │   └── [id]/route.ts         # PATCH (confirm/lock), GET chi tiết
│   │       └── export/
│   │           └── route.ts              # GET — xuất Excel bảng lương
│   │
│   └── salary/
│       ├── layout.tsx                    # Layout riêng module lương
│       ├── config/page.tsx               # Cấu hình lương (SalaryConfig)
│       ├── employee-info/page.tsx        # Nhập thông tin lương NV
│       ├── performance/page.tsx          # Nhập kết quả tháng
│       ├── advance/page.tsx              # Quản lý tạm ứng
│       ├── calculate/page.tsx            # Trang tính lương + xem kết quả
│       └── export/page.tsx               # Xuất Excel bảng lương
│
└── lib/
    └── salary/
        ├── calculator.ts                 # Pure function tính lương (tách riêng, dễ test)
        ├── attendance-counter.ts         # Logic đếm công từ Timesheet
        └── excel-exporter.ts            # ExcelJS export bảng lương
```

---

## 6. CHI TIẾT TỪNG BƯỚC THỰC HIỆN

---

### PHASE 1 — DATABASE & MIGRATION

**Task 1.1:** Mở file `prisma/schema.prisma`, thêm vào cuối:

- Model `SalaryGrade` (spec ở mục 3.1)
- Model `JobCoefficientConfig` (spec ở mục 3.1)
- 5 model lương: `SalaryConfig`, `EmployeeSalaryInfo`, `MonthlyPerformanceBonus`, `AdvancePayment`, `MonthlySalary` (spec ở mục 3.2)
- Enum `SalaryStatus`

**Task 1.2:** Thêm 4 relations vào model `Employee` hiện có (spec ở mục 3.3). **Không xóa bất kỳ relation nào cũ.**

**Task 1.3:** Chạy migration:

```bash
npx prisma migrate dev --name add_salary_module
npx prisma generate
```

Nếu migration lỗi do conflict: kiểm tra xem Employee đã có 4 relations kia chưa (tránh duplicate).

---

### PHASE 2 — BUSINESS LOGIC (lib/salary/)

**Task 2.1: `src/lib/salary/attendance-counter.ts`**

Export function:

```typescript
export async function countAttendanceForMonth(
  employeeId: number,
  month: number,
  year: number,
): Promise<{
  actualWorkDays: number;
  shift3Days: number; // Lấy từ MonthlyPerformanceBonus (nhập thủ công)
  sundayWorkDays: number;
  holidayLeaveDays: number;
  overtimeMinutes: number; // Từ OvertimeRecord
}>;
```

Logic:

- Tính `startOfMonth` và `endOfMonth` bằng dayjs
- Query `Timesheet` với `include: { attendanceCode: true }`
- Loop qua từng timesheet, dùng `dayjs(ts.date).day() === 0` để check CN
- Dùng `AttendanceCode.factor` để cộng công (factor=1 → +1, factor=0.5 → +0.5)
- Identify `HOLIDAY_LEAVE_CODES` để tính riêng `holidayLeaveDays`
- Query `OvertimeRecord` cùng tháng để lấy `overtimeMinutes`

**Task 2.2: `src/lib/salary/calculator.ts`**

Export function chính:

```typescript
export async function calculateMonthlySalary(params: {
  employeeId: number;
  month: number;
  year: number;
  calculatedBy: string;
}): Promise<MonthlySalaryResult>;
```

Trong function này:

1. Gọi `countAttendanceForMonth()` để lấy công
2. Query `EmployeeSalaryInfo` — lấy bản có `effectiveDate <= lastDay` và `expiredDate` null hoặc `>= firstDay`, sort desc, lấy bản đầu tiên
3. Query `SalaryConfig` theo month/year — nếu không có thì throw lỗi rõ ràng: `"Chưa cấu hình lương tháng ${month}/${year}"`
4. Query `MonthlyPerformanceBonus`, `MonthlyEvaluation`, `AdvancePayment`
5. Query `Employee` với `include: { department: true }` để lấy `department.isKip`
6. Tính toán theo công thức mục 4.3
7. Return object `MonthlySalaryResult` với đầy đủ các trường

**Lưu ý quan trọng:**

- Tất cả phép tính tiền: `Math.round(value)` về đơn vị VNĐ nguyên
- `overtimeSalary` tính từ `overtimeMinutes`: `(baseSalary / standardWorkDays / 8) × (totalMinutes/60) × 1.5` (hệ số OT ngày thường)
- Nếu `isProductionWorker = false`: set `shift3Allowance = 0`, `bonusShift3 = 0`, `productionCoefficient = 0`
- Nếu không có `EmployeeSalaryInfo`: throw lỗi `"Chưa có thông tin lương của nhân viên này"`
- Hàm này là **pure calculation** — KHÔNG ghi vào database. Việc ghi sẽ do API `/calculate` route đảm nhiệm.

**Task 2.3: `src/lib/salary/excel-exporter.ts`**

Export function:

```typescript
export async function exportSalaryExcel(params: {
  month: number;
  year: number;
  departmentId?: number;
  factoryId?: number;
}): Promise<Buffer>;
```

Dùng `exceljs`. Cấu trúc file Excel xuất ra (khớp với file mẫu `cong-thuc-tinh-luong.xlsx`):

- **Header:** "DANH SÁCH DỰ KIẾN CHI TIẾT TIỀN LƯƠNG THÁNG X NĂM XXXX"
- **Cột trái:** STT, Mã NV, Tên NV, Mức lương, Hệ số
- **Cột giữa:** Ngày công, Tiền lương TG, OT, Nghỉ Lễ/Phép, Ăn cơm CN, PC ca 3
- **Cột BH:** BHXH NLĐ, BHYT NLĐ
- **Cột tổng hợp:** Tổng thu nhập, Tạm ứng, BHXH, BHYT, BHTN, CĐ phí, Thuế TNCN, **Thực nhận**
- **Format số:** `#,##0` (có dấu phẩy ngăn cách nghìn)
- **Freeze panes:** cố định 3 cột đầu (STT, Mã NV, Tên NV)
- **Border:** tất cả ô có dữ liệu đều có border thin

---

### PHASE 3 — API ROUTES

Convention toàn bộ API routes:

- Dùng `export async function GET/POST/PATCH/DELETE(request: Request, props: { params: Promise<{id: string}> })`
- Auth check: `const session = await auth()` — throw 401 nếu không có session
- Permission: ADMIN và HR_MANAGER được thao tác, LEADER chỉ GET, TIMEKEEPER không được vào module lương
- Error: luôn return `NextResponse.json({ error: "..." }, { status: xxx })`
- Wrap DB calls trong try/catch

**Task 3.1: `src/app/api/salary/config/route.ts`**

- `GET`: lấy SalaryConfig theo query `?month=&year=`. Nếu không truyền → lấy tháng hiện tại
- `POST`: tạo mới hoặc upsert SalaryConfig. Body: `{ month, year, regionMinWage, standardWorkDays, ... }`

**Task 3.2: `src/app/api/salary/employee-info/route.ts`**

- `GET`: query `?employeeId=` hoặc `?departmentId=` — trả về list EmployeeSalaryInfo, include Employee
- `POST`: tạo EmployeeSalaryInfo mới. Trước khi tạo, check xem có bản đang active (`expiredDate = null`) không, nếu có thì set `expiredDate` của bản cũ = `effectiveDate - 1 ngày`

**Task 3.3: `src/app/api/salary/employee-info/[id]/route.ts`**

- `PATCH`: cập nhật EmployeeSalaryInfo
- `DELETE`: xóa (chỉ ADMIN)

**Task 3.4: `src/app/api/salary/performance/route.ts`**

- `GET`: query `?month=&year=&departmentId=` — trả về list MonthlyPerformanceBonus kèm Employee info
- `POST`: upsert MonthlyPerformanceBonus. Dùng `prisma.monthlyPerformanceBonus.upsert` với unique `[employeeId, month, year]`

**Task 3.5: `src/app/api/salary/advance/route.ts`**

- `GET`: query `?month=&year=&employeeId=`
- `POST`: tạo AdvancePayment. Ghi `createdBy` từ session.user.username

**Task 3.6: `src/app/api/salary/calculate/route.ts`** ⭐ QUAN TRỌNG NHẤT

```typescript
// POST body: { month: number, year: number, departmentId?: number, employeeIds?: number[] }
export async function POST(request: Request) {
  // 1. Auth check — chỉ ADMIN và HR_MANAGER
  // 2. Parse body
  // 3. Lấy danh sách employeeIds cần tính:
  //    - Nếu truyền employeeIds → dùng luôn
  //    - Nếu truyền departmentId → lấy tất cả Employee active trong dept đó
  //    - Nếu không truyền gì → lấy tất cả Employee isActive=true
  // 4. Với mỗi employeeId:
  //    a. Gọi calculateMonthlySalary()
  //    b. Dùng prisma.monthlySalary.upsert() lưu kết quả
  //    c. Ghi nhận lỗi nếu có (tiếp tục xử lý NV tiếp theo, không dừng hẳn)
  // 5. Return { success: number, failed: number, errors: [...] }
}
```

**Task 3.7: `src/app/api/salary/monthly/route.ts`**

- `GET`: query `?month=&year=&departmentId=&status=` — trả về list MonthlySalary, include Employee + Department
- Hỗ trợ phân trang: `?page=1&limit=50`

**Task 3.8: `src/app/api/salary/monthly/[id]/route.ts`**

- `GET`: chi tiết 1 MonthlySalary, include đầy đủ relations
- `PATCH`: cập nhật status (DRAFT→CONFIRMED, CONFIRMED→LOCKED). Ghi `confirmedBy` khi CONFIRMED

**Task 3.9: `src/app/api/salary/export/route.ts`**

- `GET`: query `?month=&year=&departmentId=&factoryId=`
- Gọi `exportSalaryExcel()` từ lib
- Return `new Response(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="bang-luong-${month}-${year}.xlsx"` } })`

---

### PHASE 4 — UI PAGES

Convention UI:

- Tất cả pages đều có `'use client'` (vì dùng hooks)
- Dùng Ant Design components: `Table`, `Form`, `Modal`, `Select`, `DatePicker`, `InputNumber`, `message`, `Button`, `Tag`, `Statistic`
- Gọi API qua `fetch` trong `useEffect` hoặc event handler
- Tất cả số tiền: format bằng `new Intl.NumberFormat('vi-VN').format(value)` hoặc `value.toLocaleString('vi-VN')`
- Loading state: dùng `useState<boolean>` + Ant Design `Spin` hoặc `Table loading`

**Task 4.1: `src/app/salary/config/page.tsx`** — Cấu hình lương

Layout: Form 2 cột

- Bên trái: các trường cơ bản (month/year picker, regionMinWage, standardWorkDays, mealAllowanceSunday, shift3UnitPrice)
- Bên phải: tỷ lệ BH dạng InputNumber với suffix `%` (chia 100 khi lưu, nhân 100 khi hiển thị)
- Nút "Lưu cấu hình" → POST /api/salary/config
- Khi load trang: tự động fetch config tháng hiện tại

**Task 4.2: `src/app/salary/employee-info/page.tsx`** — Thông tin lương NV

Layout: Filter bar (chọn phòng ban) + Table

- Table columns: Mã NV, Họ tên, Phòng ban, Mức lương, Hệ số, Bậc, Phụ cấp ĐT, Phụ cấp đi lại, Hiệu lực, Thao tác
- Nút "Thêm/Sửa" → mở Modal Form
- Modal Form fields: chọn Employee (Select với search), baseSalary (InputNumber), salaryCoefficient, salaryGrade, salaryLevel, phoneAllowance, transportAllowance, effectiveDate (DatePicker), note

**Task 4.3: `src/app/salary/performance/page.tsx`** — Nhập kết quả tháng

Layout: Filter bar (chọn tháng/năm + phòng ban) + Table có thể edit inline

- Table columns: Mã NV, Họ tên, Xếp loại (tag A/B/C từ MonthlyEvaluation), HS công việc, HS sản xuất (chỉ hiện nếu isKip), Thưởng đủ công, Thưởng HC / Thưởng ca 3, Công ca 3 (chỉ hiện nếu isKip)
- Mỗi ô số liệu là `InputNumber` có thể edit thẳng trên bảng
- Nút "Lưu tất cả" → batch POST/PATCH /api/salary/performance
- **Lưu ý:** Hiển thị cột "Xếp loại" lấy từ `MonthlyEvaluation` (đã có sẵn), KHÔNG nhập ở đây. Chỉ nhập các hệ số tiền.

**Task 4.4: `src/app/salary/advance/page.tsx`** — Tạm ứng lương

Layout: Filter bar (tháng/năm + phòng ban) + Table + Form thêm tạm ứng

- Table columns: Mã NV, Họ tên, Phòng ban, Số tiền tạm ứng, Ghi chú, Ngày tạo, Người tạo, Thao tác (Xóa)
- Nút "Thêm tạm ứng" → Modal với: chọn Employee, nhập amount (InputNumber format VNĐ), note

**Task 4.5: `src/app/salary/calculate/page.tsx`** — Tính lương & xem kết quả ⭐ TRANG CHÍNH

Layout: 3 phần

**Phần 1 — Điều khiển tính lương:**

```
[Chọn tháng/năm] [Chọn phòng ban (optional)] [Nút "Tính lương"]
```

- Nút "Tính lương" → gọi POST /api/salary/calculate → hiện progress/result
- Sau khi tính xong: tự động refresh bảng kết quả bên dưới

**Phần 2 — Thống kê tóm tắt (4 Statistic cards):**

- Tổng NV đã tính lương
- Tổng quỹ lương (sum netSalary)
- Lương cao nhất / thấp nhất

**Phần 3 — Bảng kết quả MonthlySalary:**

- Columns: STT, Mã NV, Họ tên, Phòng ban, Ngày công, Tổng thu nhập, Tổng khấu trừ, **Thực nhận**, Trạng thái (Tag: DRAFT/CONFIRMED/LOCKED), Thao tác
- Thao tác: nút "Duyệt" (DRAFT→CONFIRMED), nút "Xem chi tiết" → mở Drawer chi tiết
- Drawer chi tiết: hiển thị đầy đủ breakdown tất cả các khoản thu nhập và khấu trừ
- Nút "Duyệt tất cả" → batch PATCH status=CONFIRMED cho tất cả DRAFT
- Nút "Xuất Excel" → GET /api/salary/export với params hiện tại

**Task 4.6: `src/app/salary/layout.tsx`** — Layout module lương

```typescript
// Sidebar sub-menu hoặc breadcrumb navigation
// Các link: Cấu hình | Thông tin lương NV | Kết quả tháng | Tạm ứng | Tính lương
// Permission check: chỉ ADMIN và HR_MANAGER mới vào được, LEADER chỉ vào trang calculate (view only)
```

---

### PHASE 5 — TÍCH HỢP VÀO ADMINLAYOUT

**Task 5.1:** Mở `src/components/AdminLayout.tsx`, thêm menu item "Tiền lương" vào sidebar:

```typescript
{
  key: '/salary/calculate',
  icon: <DollarOutlined />,
  label: 'Tiền lương',
  children: [
    { key: '/salary/calculate', label: 'Tính lương' },
    { key: '/salary/employee-info', label: 'Thông tin lương NV' },
    { key: '/salary/performance', label: 'Kết quả tháng' },
    { key: '/salary/advance', label: 'Tạm ứng' },
    { key: '/salary/config', label: 'Cấu hình lương' },
  ]
}
```

Chỉ hiện menu này với role ADMIN và HR_MANAGER (LEADER hiện nút riêng view-only nếu cần).

---

## 7. KIỂM TRA & VALIDATION

Sau khi code xong từng Phase, chạy kiểm tra:

### Phase 1 checklist:

- [ ] `npx prisma validate` không có lỗi
- [ ] Migration chạy thành công
- [ ] `npx prisma studio` — thấy 7 bảng mới (SalaryGrade, JobCoefficientConfig, SalaryConfig, EmployeeSalaryInfo, MonthlyPerformanceBonus, AdvancePayment, MonthlySalary)

### Phase 2 checklist:

- [ ] `calculator.ts` — test thủ công với employeeId có data mẫu, kết quả timeSalary khớp công thức
- [ ] Trường hợp biên: NV không có SalaryInfo → lỗi có thông báo rõ ràng
- [ ] Trường hợp biên: NV isKip=false → shift3Allowance và bonusShift3 = 0

### Phase 3 checklist:

- [ ] `POST /api/salary/calculate` với một employeeId cụ thể → trả về `{ success: 1, failed: 0 }`
- [ ] Check database: MonthlySalary record được tạo đúng
- [ ] `GET /api/salary/export` → download được file xlsx không lỗi

### Phase 4 checklist:

- [ ] Trang `/salary/calculate` render không lỗi
- [ ] Click "Tính lương" → loading → hiện kết quả
- [ ] Nút "Xuất Excel" → download file

---

## 8. LƯU Ý QUAN TRỌNG (ĐỪNG BỎ QUA)

1. **Không sửa các model cũ** trong schema. Chỉ THÊM, không xóa hay đổi tên field.

2. **Named relations bắt buộc** cho Employee: dùng `@relation("SalaryInfos")`, `@relation("PerformanceBonuses")`, `@relation("AdvancePayments")`, `@relation("MonthlySalaries")` để tránh Prisma nhầm lẫn với các relation khác.

3. **`params` là Promise** trong Next.js 15: luôn dùng `const { id } = await props.params` thay vì `props.params.id`.

4. **Format số tiền**: tất cả phép tính phải `Math.round()` về số nguyên VNĐ. Không để float.

5. **Logic ca 3**: `shift3Days` hiện tại được nhập thủ công trong `MonthlyPerformanceBonus` bởi HR. Không tự động tính từ Timesheet (vì ca 3 không có mã công riêng biệt trong AttendanceCode hiện tại).

6. **Thuế TNCN**: Trong PLAN này set `incomeTaxDeduction = 0` (tính thủ công sau). Nếu muốn tự động: cần thêm bảng `TaxBracket` riêng — để scope sau.

7. **Upsert vs Insert**: API `/calculate` dùng `upsert` để có thể tính lại nhiều lần mà không bị duplicate. Khi MonthlySalary đã CONFIRMED hoặc LOCKED → throw lỗi 403.

8. **ExcelJS encoding**: khi trả về file xlsx qua API route, dùng `workbook.xlsx.writeBuffer()` trả về `ArrayBuffer`, convert sang `Buffer` cho Response.

---

## 9. THỨ TỰ THỰC HIỆN ĐỀ XUẤT

```
Phase 1 (Schema + Migration)  →  Phase 2 (Business Logic)  →  Phase 3 (APIs)  →  Phase 4 (UI)  →  Phase 5 (Tích hợp)
```

Trong Phase 3, thứ tự ưu tiên:

1. `/api/salary/config` (cần có config trước khi tính)
2. `/api/salary/employee-info` (cần có info NV)
3. `/api/salary/performance` (nhập kết quả tháng)
4. `/api/salary/advance` (nhập tạm ứng)
5. `/api/salary/calculate` ⭐ (engine chính)
6. `/api/salary/monthly` (đọc kết quả)
7. `/api/salary/export` (xuất Excel)

---

_End of PLAN — Phubai HRM Salary Module_
_Được tạo dựa trên phân tích: PROJECT_OVERVIEW.md + cong-thuc-tinh-luong.xlsx + THANG_LƯƠNG_VÀ_HỆ_SỐ_CV.xlsx + schema.prisma_
