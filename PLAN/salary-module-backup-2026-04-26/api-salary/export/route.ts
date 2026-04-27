import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { exportSalaryExcel } from '@/lib/salary/excel-exporter'

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

    const buffer = await exportSalaryExcel({ month, year, departmentId })
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="bang-luong-${month}-${year}.xlsx"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 })
  }
}
