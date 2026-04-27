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
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
    const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()))
    const config = await prisma.salaryConfig.findUnique({
      where: { month_year: { month, year } },
    })
    return NextResponse.json(config)
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
    const result = await prisma.salaryConfig.upsert({
      where: { month_year: { month: body.month, year: body.year } },
      update: body,
      create: body,
    })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
