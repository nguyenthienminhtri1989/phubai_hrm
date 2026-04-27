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
    const month      = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
    const year       = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()))
    const employeeId = searchParams.get('employeeId') ? parseInt(searchParams.get('employeeId')!) : undefined

    const advances = await prisma.advancePayment.findMany({
      where: {
        month,
        year,
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: { select: { id: true, code: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(advances)
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
    const body = await request.json()
    const result = await prisma.advancePayment.create({
      data: {
        ...body,
        createdBy: session.user.username,
      },
    })
    return NextResponse.json(result, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
