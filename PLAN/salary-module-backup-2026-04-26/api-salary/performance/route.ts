import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'HR_MANAGER', 'LEADER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const month        = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
    const year         = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()))
    const departmentId = searchParams.get('departmentId') ? parseInt(searchParams.get('departmentId')!) : undefined

    const bonuses = await prisma.monthlyPerformanceBonus.findMany({
      where: {
        month,
        year,
        ...(departmentId ? { employee: { departmentId } } : {}),
      },
      include: {
        employee: { include: { department: true } },
      },
      orderBy: { employee: { fullName: 'asc' } },
    })
    return NextResponse.json(bonuses)
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'HR_MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const { employeeId, month, year, ...rest } = await request.json()
    const result = await prisma.monthlyPerformanceBonus.upsert({
      where: { employeeId_month_year: { employeeId, month, year } },
      update: { ...rest },
      create: { employeeId, month, year, ...rest },
    })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
