import { prisma } from '@/lib/prisma'
import dayjs from 'dayjs'

const FULL_DAY_CODES     = ['X','XD','CT','LĐ','XL','LE','LD','F','R','L','ĐC']
const HALF_DAY_CODES     = ['X/2']
const HOLIDAY_LEAVE_CODES = ['F','L','R','ĐC']

export interface AttendanceCount {
  actualWorkDays: number
  sundayWorkDays: number
  holidayLeaveDays: number
  overtimeMinutes: number
}

export async function countAttendanceForMonth(
  employeeId: number,
  month: number,
  year: number
): Promise<AttendanceCount> {
  const startOfMonth = dayjs(`${year}-${month}-01`).startOf('month').toDate()
  const endOfMonth   = dayjs(`${year}-${month}-01`).endOf('month').toDate()

  const timesheets = await prisma.timesheet.findMany({
    where: { employeeId, date: { gte: startOfMonth, lte: endOfMonth } },
    include: { attendanceCode: true },
  })

  let actualWorkDays   = 0
  let sundayWorkDays   = 0
  let holidayLeaveDays = 0

  for (const ts of timesheets) {
    const code     = ts.attendanceCode.code
    const isSunday = dayjs(ts.date).day() === 0

    if (FULL_DAY_CODES.includes(code)) {
      actualWorkDays += 1
      if (isSunday) sundayWorkDays += 1
      if (HOLIDAY_LEAVE_CODES.includes(code)) holidayLeaveDays += 1
    } else if (HALF_DAY_CODES.includes(code)) {
      actualWorkDays += 0.5
    }
  }

  // Tổng phút OT trong tháng
  const overtimeRecords = await prisma.overtimeRecord.findMany({
    where: { employeeId, startTime: { gte: startOfMonth, lte: endOfMonth } },
  })
  const overtimeMinutes = overtimeRecords.reduce((sum: number, r: { totalMinutes: number }) => sum + r.totalMinutes, 0)

  return { actualWorkDays, sundayWorkDays, holidayLeaveDays, overtimeMinutes }
}
