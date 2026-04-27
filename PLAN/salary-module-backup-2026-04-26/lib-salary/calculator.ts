import { prisma } from '@/lib/prisma'
import dayjs from 'dayjs'
import { countAttendanceForMonth } from './attendance-counter'

export interface MonthlySalaryResult {
  employeeId: number
  salaryInfoId: number | null
  month: number
  year: number
  // Công
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
  netSalary: number
}

export async function calculateMonthlySalary(params: {
  employeeId: number
  month: number
  year: number
  calculatedBy: string
}): Promise<MonthlySalaryResult> {
  const { employeeId, month, year } = params

  const firstDay = dayjs(`${year}-${month}-01`).startOf('month').toDate()
  const lastDay  = dayjs(`${year}-${month}-01`).endOf('month').toDate()

  // --- 1. Lấy dữ liệu ---
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { department: true },
  })
  if (!employee) throw new Error(`Không tìm thấy nhân viên ID=${employeeId}`)

  const config = await prisma.salaryConfig.findUnique({
    where: { month_year: { month, year } },
  })
  if (!config) throw new Error(`Chưa cấu hình lương tháng ${month}/${year}`)

  // Lấy SalaryInfo đang có hiệu lực trong tháng
  const salaryInfo = await prisma.employeeSalaryInfo.findFirst({
    where: {
      employeeId,
      effectiveDate: { lte: lastDay },
      OR: [{ expiredDate: null }, { expiredDate: { gte: firstDay } }],
    },
    orderBy: { effectiveDate: 'desc' },
  })
  if (!salaryInfo) throw new Error(`Chưa có thông tin lương cho NV ID=${employeeId}`)

  const perfBonus = await prisma.monthlyPerformanceBonus.findUnique({
    where: { employeeId_month_year: { employeeId, month, year } },
  })
  const evaluation = await prisma.monthlyEvaluation.findUnique({
    where: { employeeId_month_year: { employeeId, month, year } },
  })
  const advances = await prisma.advancePayment.findMany({
    where: { employeeId, month, year },
  })

  const attendance = await countAttendanceForMonth(employeeId, month, year)
  const isProductionWorker = employee.department.isKip

  // shift3Days từ MonthlyPerformanceBonus (nhập thủ công)
  const shift3Days = isProductionWorker ? (perfBonus?.shift3Days ?? 0) : 0

  // --- 2. Tính lương thời gian ---
  const timeSalary = Math.round(
    salaryInfo.baseSalary * (attendance.actualWorkDays / config.standardWorkDays)
  )

  // --- 3. Lương OT ---
  // Đơn giá 1 giờ ngày thường × 1.5
  const hourlyRate = salaryInfo.baseSalary / config.standardWorkDays / 8
  const overtimeSalary = Math.round(hourlyRate * (attendance.overtimeMinutes / 60) * 1.5)

  // --- 4. Lương nghỉ Lễ/Phép ---
  const holidaySalary = Math.round(
    salaryInfo.baseSalary * (attendance.holidayLeaveDays / config.standardWorkDays)
  )

  // --- 5. Ăn cơm CN ---
  const mealAllowance = Math.round(attendance.sundayWorkDays * config.mealAllowanceSunday)

  // --- 6. Phụ cấp ca 3 (chỉ SX) ---
  const shift3Allowance = isProductionWorker
    ? Math.round(shift3Days * config.shift3UnitPrice)
    : 0

  // --- 7. Lương cấp bậc công việc ---
  // % xếp loại: A=100%, B=80%, C=60% (mặc định 100% nếu chưa xếp loại)
  const gradeRateMap: Record<string, number> = { A: 1.0, B: 0.8, C: 0.6 }
  const gradeRate = gradeRateMap[evaluation?.grade ?? 'A'] ?? 1.0

  const perfSalaryBase = Math.round((perfBonus?.performanceCoefficient ?? 0) * gradeRate)
  const productionBonus = isProductionWorker
    ? Math.round(perfBonus?.productionCoefficient ?? 0)
    : 0
  const shift3Bonus = isProductionWorker ? Math.round(perfBonus?.bonusShift3 ?? 0) : 0
  const adminBonus  = !isProductionWorker ? Math.round(perfBonus?.bonusAdminWork ?? 0) : 0
  const fullAttendBonus = Math.round(perfBonus?.bonusFullAttendance ?? 0)

  const performanceSalary =
    perfSalaryBase + productionBonus + shift3Bonus + adminBonus + fullAttendBonus

  // --- 8. Phụ cấp đặc thù ---
  const specialAllowance = Math.round(
    (salaryInfo.phoneAllowance ?? 0) + (salaryInfo.transportAllowance ?? 0)
  )

  // --- 9. Tổng thu nhập ---
  const totalIncome =
    timeSalary + overtimeSalary + holidaySalary + mealAllowance +
    shift3Allowance + performanceSalary + specialAllowance

  // --- 10. Khấu trừ ---
  // Lương làm căn cứ đóng BH = baseSalary
  const bhBase = salaryInfo.baseSalary
  const bhxhDeduction  = Math.round(bhBase * config.employeeBhxhRate)
  const bhytDeduction  = Math.round(bhBase * config.employeeBhytRate)
  const bhtnDeduction  = Math.round(bhBase * config.employeeBhtnRate)
  const unionFeeDeduction = Math.round(bhBase * config.unionFeeRate)
  const advanceDeduction  = advances.reduce((sum: number, a: { amount: number }) => sum + a.amount, 0)
  const mealDeduction     = mealAllowance  // Cộng rồi trừ lại
  const incomeTaxDeduction = 0             // TODO: tính theo biểu thuế sau

  // --- 11. Thực nhận ---
  const netSalary = Math.round(
    totalIncome - advanceDeduction - bhxhDeduction - bhytDeduction -
    bhtnDeduction - unionFeeDeduction - mealDeduction - incomeTaxDeduction
  )

  return {
    employeeId,
    salaryInfoId: salaryInfo.id,
    month,
    year,
    actualWorkDays: attendance.actualWorkDays,
    shift3Days,
    sundayWorkDays: attendance.sundayWorkDays,
    holidayLeaveDays: attendance.holidayLeaveDays,
    timeSalary, overtimeSalary, holidaySalary,
    mealAllowance, shift3Allowance, performanceSalary, specialAllowance,
    totalIncome,
    advanceDeduction, bhxhDeduction, bhytDeduction, bhtnDeduction,
    unionFeeDeduction, mealDeduction, incomeTaxDeduction,
    netSalary,
  }
}
