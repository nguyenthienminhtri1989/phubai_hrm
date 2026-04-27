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
    const status       = searchParams.get('status') ?? undefined
    const page         = parseInt(searchParams.get('page')  ?? '1')
    const limit        = parseInt(searchParams.get('limit') ?? '50')

    const [total, monthlySalaries] = await prisma.$transaction([
      prisma.monthlySalary.count({
        where: {
          month,
          year,
          ...(departmentId ? { employee: { departmentId } } : {}),
          ...(status ? { status: status as 'DRAFT' | 'CONFIRMED' | 'LOCKED' } : {}),
        },
      }),
      prisma.monthlySalary.findMany({
        where: {
          month,
          year,
          ...(departmentId ? { employee: { departmentId } } : {}),
          ...(status ? { status: status as 'DRAFT' | 'CONFIRMED' | 'LOCKED' } : {}),
        },
        include: {
          employee: { include: { department: true } },
          salaryInfo: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { employee: { fullName: 'asc' } },
      }),
    ])

    return NextResponse.json({ data: monthlySalaries, total, page, limit })
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
