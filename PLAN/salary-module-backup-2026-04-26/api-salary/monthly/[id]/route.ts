import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'HR_MANAGER', 'LEADER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const { id } = await props.params
    const record = await prisma.monthlySalary.findUnique({
      where: { id: parseInt(id) },
      include: {
        employee: { include: { department: true } },
        salaryInfo: true,
      },
    })
    if (!record) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })
    return NextResponse.json(record)
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'HR_MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const { id } = await props.params
    const { status } = await request.json()

    const current = await prisma.monthlySalary.findUnique({ where: { id: parseInt(id) } })
    if (!current) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })
    if (current.status === 'LOCKED') {
      return NextResponse.json({ error: 'Bảng lương đã khóa, không thể sửa' }, { status: 403 })
    }

    const updated = await prisma.monthlySalary.update({
      where: { id: parseInt(id) },
      data: {
        status,
        ...(status === 'CONFIRMED' ? { confirmedBy: session.user.username } : {}),
      },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
