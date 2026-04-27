'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AdminLayout from '@/components/AdminLayout'

const NAV_ITEMS = [
  { href: '/salary/calculate',     label: 'Tính lương' },
  { href: '/salary/performance',   label: 'Kết quả tháng' },
  { href: '/salary/advance',       label: 'Tạm ứng' },
  { href: '/salary/employee-info', label: 'Thông tin lương NV' },
  { href: '/salary/config',        label: 'Cấu hình' },
]

export default function SalaryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <AdminLayout>
      {/* Tab bar sub-navigation */}
      <div
        style={{
          borderBottom: '1px solid #f0f0f0',
          marginBottom: 24,
          marginTop: -8,
          display: 'flex',
          gap: 0,
          background: '#fff',
          marginLeft: -24,
          marginRight: -24,
          paddingLeft: 24,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                color: isActive ? '#1677ff' : '#595959',
                fontWeight: isActive ? 600 : 400,
                borderBottom: isActive ? '2px solid #1677ff' : '2px solid transparent',
                textDecoration: 'none',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                fontSize: 14,
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </div>

      {/* Page content */}
      {children}
    </AdminLayout>
  )
}
