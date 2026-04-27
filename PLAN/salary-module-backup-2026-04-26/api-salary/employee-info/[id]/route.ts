import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

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
    const body = await request.json()
    const updated = await prisma.employeeSalaryInfo.update({
      where: { id: parseInt(id) },
      data: body,
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const { id } = await props.params
    await prisma.employeeSalaryInfo.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
