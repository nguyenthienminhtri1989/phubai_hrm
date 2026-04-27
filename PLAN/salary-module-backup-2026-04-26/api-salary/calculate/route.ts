import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateMonthlySalary } from '@/lib/salary/calculator'

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'HR_MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
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
        // Nếu đã CONFIRMED hoặc LOCKED thì bỏ qua
        const existing = await prisma.monthlySalary.findUnique({
          where: { employeeId_month_year: { employeeId, month, year } },
        })
        if (existing?.status === 'CONFIRMED' || existing?.status === 'LOCKED') {
          results.errors.push(`NV ${employeeId}: đã ${existing.status}, bỏ qua`)
          continue
        }

        const calc = await calculateMonthlySalary({
          employeeId,
          month,
          year,
          calculatedBy: session.user.username,
        })

        await prisma.monthlySalary.upsert({
          where: { employeeId_month_year: { employeeId, month, year } },
          update: { ...calc, status: 'DRAFT', calculatedBy: session.user.username },
          create: { ...calc, status: 'DRAFT', calculatedBy: session.user.username },
        })
        results.success++
      } catch (err: unknown) {
        results.failed++
        results.errors.push(`NV ${employeeId}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return NextResponse.json(results)
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
