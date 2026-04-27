import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import dayjs from 'dayjs'

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'HR_MANAGER', 'LEADER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const employeeId   = searchParams.get('employeeId')   ? parseInt(searchParams.get('employeeId')!)   : undefined
    const departmentId = searchParams.get('departmentId') ? parseInt(searchParams.get('departmentId')!) : undefined

    const infos = await prisma.employeeSalaryInfo.findMany({
      where: {
        ...(employeeId   ? { employeeId }                        : {}),
        ...(departmentId ? { employee: { departmentId } }        : {}),
      },
      include: {
        employee: { include: { department: true } },
      },
      orderBy: { effectiveDate: 'desc' },
    })
    return NextResponse.json(infos)
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
    const { employeeId, effectiveDate, ...rest } = await request.json()

    // Tìm bản đang active (expiredDate = null)
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

    return NextResponse.json({ success: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
