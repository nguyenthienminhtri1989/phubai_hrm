# SKILL-01: SCHEMA — MODULE TÍNH LƯƠNG

> Đọc SKILL-00 trước. File này chỉ chứa schema cần THÊM vào `prisma/schema.prisma`.
> **KHÔNG xóa hay sửa bất kỳ model nào đã có.**

## Bước 1 — Thêm vào cuối schema.prisma

```prisma
// ================================================================
// MODULE TÍNH LƯƠNG — PHUBAI-HRM
// ================================================================

// Thang bậc lương (dữ liệu từ file THANG_LƯƠNG_VÀ_HỆ_SỐ_CV.xlsx)
model SalaryGrade {
  id                Int      @id @default(autoincrement())
  // "CN_SAN_XUAT" | "LAI_XE" | "CHUYEN_MON_DH" | "CHUYEN_MON_CD" | "QUAN_LY"
  gradeGroup        String
  gradeNumber       Int      // Bậc 1..9 (hoặc 12)
  coefficient       Float    // Hệ số: 1.25, 1.33...
  baseSalaryAmount  Float    // Mức lương: 5,175,000...
  minMonthsRequired Int      @default(0)
  effectiveYear     Int
  note              String?
  @@unique([gradeGroup, gradeNumber, effectiveYear])
}

// Hệ số công việc theo chức danh (sheet "HS CV MỚI")
model JobCoefficientConfig {
  id            Int      @id @default(autoincrement())
  // "LANH_DAO" | "GIAM_DOC_TRUONG_PHONG" | "TO_TRUONG" | "CHUYEN_VIEN" | "CONG_NHAN"
  jobGroup      String
  jobTitle      String   // "Tổng Giám đốc", "Tổ trưởng cấp I"...
  coefficient   Float    // 200, 95, 35, 7.9...
  gradeMin      Int?
  gradeMax      Int?
  effectiveDate DateTime
  note          String?
}

// Cấu hình lương theo tháng/năm
model SalaryConfig {
  id                   Int      @id @default(autoincrement())
  month                Int
  year                 Int
  regionMinWage        Float    @default(4140000)
  standardWorkDays     Int      @default(26)
  mealAllowanceSunday  Float    @default(0)   // Đơn giá ăn cơm CN/ngày
  shift3UnitPrice      Float    @default(0)   // Đơn giá PC ca 3/công
  companyBhxhRate      Float    @default(0.175)
  companyBhtnRate      Float    @default(0.01)
  companyBhytRate      Float    @default(0.03)
  employeeBhxhRate     Float    @default(0.08)
  employeeBhtnRate     Float    @default(0.01)
  employeeBhytRate     Float    @default(0.015)
  unionFeeRate         Float    @default(0.01)
  note                 String?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  @@unique([month, year])
}

// Thông tin lương cá nhân — có lịch sử thay đổi
model EmployeeSalaryInfo {
  id                 Int       @id @default(autoincrement())
  employeeId         Int
  employee           Employee  @relation("SalaryInfos", fields: [employeeId], references: [id], onDelete: Cascade)
  baseSalary         Float     // Mức lương cơ bản thỏa thuận
  salaryCoefficient  Float     // Hệ số
  salaryGrade        Int?      // Bậc (1..9)
  salaryLevel        Int?      // Cấp trong bậc
  phoneAllowance     Float     @default(0)
  transportAllowance Float     @default(0)
  effectiveDate      DateTime
  expiredDate        DateTime? // null = đang áp dụng
  note               String?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  monthlySalaries    MonthlySalary[]
}

// Kết quả & thưởng tháng (nhập thủ công bởi HR_MANAGER)
model MonthlyPerformanceBonus {
  id                     Int      @id @default(autoincrement())
  employeeId             Int
  employee               Employee @relation("PerformanceBonuses", fields: [employeeId], references: [id], onDelete: Cascade)
  month                  Int
  year                   Int
  performanceCoefficient Float    @default(0)  // Hệ số KQ công việc
  productionCoefficient  Float    @default(0)  // HS KQSX theo ca (chỉ SX)
  shift3Days             Float    @default(0)  // Công ca 3 (nhập thủ công, chỉ SX)
  bonusFullAttendance    Float    @default(0)  // Thưởng đủ công
  bonusAdminWork         Float    @default(0)  // Thưởng HC (chỉ HC)
  bonusShift3            Float    @default(0)  // Thưởng ca 3 (chỉ SX)
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
  @@unique([employeeId, month, year])
}

// Tạm ứng lương
model AdvancePayment {
  id         Int      @id @default(autoincrement())
  employeeId Int
  employee   Employee @relation("AdvancePayments", fields: [employeeId], references: [id], onDelete: Cascade)
  month      Int
  year       Int
  amount     Float
  note       String?
  createdBy  String?  // User.username
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

// Bảng lương tháng — snapshot kết quả tính lương
model MonthlySalary {
  id                 Int                 @id @default(autoincrement())
  employeeId         Int
  employee           Employee            @relation("MonthlySalaries", fields: [employeeId], references: [id], onDelete: Cascade)
  salaryInfoId       Int?
  salaryInfo         EmployeeSalaryInfo? @relation(fields: [salaryInfoId], references: [id])
  month              Int
  year               Int
  // --- Công từ Timesheet ---
  actualWorkDays     Float @default(0)
  shift3Days         Float @default(0)
  sundayWorkDays     Float @default(0)
  holidayLeaveDays   Float @default(0)
  // --- Thu nhập ---
  timeSalary         Float @default(0)
  overtimeSalary     Float @default(0)
  holidaySalary      Float @default(0)
  mealAllowance      Float @default(0)
  shift3Allowance    Float @default(0)  // 0 nếu HC
  performanceSalary  Float @default(0)
  specialAllowance   Float @default(0)
  totalIncome        Float @default(0)
  // --- Khấu trừ ---
  advanceDeduction   Float @default(0)
  bhxhDeduction      Float @default(0)
  bhytDeduction      Float @default(0)
  bhtnDeduction      Float @default(0)
  unionFeeDeduction  Float @default(0)
  mealDeduction      Float @default(0)
  incomeTaxDeduction Float @default(0)  // Tạm set 0, tính sau
  netSalary          Float @default(0)
  status             SalaryStatus @default(DRAFT)
  note               String?
  calculatedBy       String?
  confirmedBy        String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  @@unique([employeeId, month, year])
}

enum SalaryStatus {
  DRAFT      // Đang tính
  CONFIRMED  // HR_MANAGER đã duyệt
  LOCKED     // Đã khóa, không sửa được
}
```

## Bước 2 — Thêm 4 relations vào model Employee (tìm model Employee, thêm trước dấu `}`)

```prisma
  // === Module lương ===
  salaryInfos        EmployeeSalaryInfo[]      @relation("SalaryInfos")
  performanceBonuses MonthlyPerformanceBonus[] @relation("PerformanceBonuses")
  advancePayments    AdvancePayment[]           @relation("AdvancePayments")
  monthlySalaries    MonthlySalary[]            @relation("MonthlySalaries")
```

## Bước 3 — Migration

```bash
npx prisma migrate dev --name add_salary_module
npx prisma generate
```

## Validate
```bash
npx prisma validate   # Phải không có lỗi
```
