# SKILL-05: EXCEL EXPORT — BẢNG LƯƠNG

> Đọc SKILL-00 trước. Tạo file `src/lib/salary/excel-exporter.ts`

## Cấu trúc file Excel xuất ra

```
Hàng 1: "DANH SÁCH DỰ KIẾN CHI TIẾT TIỀN LƯƠNG THÁNG X NĂM XXXX" (merge toàn bộ)
Hàng 2-3: Header 2 tầng (merge cell theo nhóm)
Hàng 4+: Dữ liệu từng NV
Hàng cuối: Tổng cộng (SUM)
```

## Nhóm cột

| # | Nhóm | Các cột con |
|---|---|---|
| A-C | Thông tin | STT, Mã NV, Họ tên |
| D-E | Lương CB | Mức lương, Hệ số |
| F-G | Lương TG | Ngày công, Tiền |
| H | Ăn cơm CN | Tiền |
| I-J | PC Ca 3 | Công, Tiền |
| K-L | Trích NLĐ | BHXH+BHTN, BHYT |
| M | Tổng lương TG | |
| N | Tổng lương CBCV | |
| O | Tổng thu nhập | |
| P | Tạm ứng | |
| Q-V | Khấu trừ | BHXH, BHYT, BHTN, CĐ phí, Ăn CN, Thuế |
| W | **Thực nhận** | |

## Code

```typescript
import ExcelJS from 'exceljs'
import prisma from '@/lib/prisma'

export async function exportSalaryExcel(params: {
  month: number
  year: number
  departmentId?: number
  factoryId?: number
}): Promise<Buffer> {
  const { month, year, departmentId } = params

  // 1. Lấy dữ liệu
  const records = await prisma.monthlySalary.findMany({
    where: {
      month, year,
      ...(departmentId ? { employee: { departmentId } } : {}),
    },
    include: {
      employee: {
        include: { department: true },
      },
      salaryInfo: true,
    },
    orderBy: [
      { employee: { department: { name: 'asc' } } },
      { employee: { fullName: 'asc' } },
    ],
  })

  // 2. Tạo workbook
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(`Lương T${month}.${year}`)

  // 3. Styles
  const headerFill: ExcelJS.Fill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: 'FFD9E1F2' },
  }
  const moneyFmt = '#,##0'
  const centerAlign: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true }
  const thinBorder: Partial<ExcelJS.Borders> = {
    top:    { style: 'thin' }, bottom: { style: 'thin' },
    left:   { style: 'thin' }, right:  { style: 'thin' },
  }

  const TOTAL_COLS = 23 // A đến W

  // 4. Tiêu đề
  ws.mergeCells(1, 1, 1, TOTAL_COLS)
  const titleCell = ws.getCell(1, 1)
  titleCell.value = `DANH SÁCH DỰ KIẾN CHI TIẾT TIỀN LƯƠNG THÁNG ${month} NĂM ${year}`
  titleCell.font = { bold: true, size: 13 }
  titleCell.alignment = { horizontal: 'center' }

  // 5. Header tầng 1 (hàng 2) — các nhóm
  const groupHeaders = [
    { label: 'STT',           col: 1,  span: 1 },
    { label: 'Mã NV',         col: 2,  span: 1 },
    { label: 'Họ tên',        col: 3,  span: 1 },
    { label: 'Mức lương',     col: 4,  span: 1 },
    { label: 'Hệ số',         col: 5,  span: 1 },
    { label: 'Lương thời gian', col: 6, span: 2 },
    { label: 'Ăn cơm CN',    col: 8,  span: 1 },
    { label: 'PC Ca 3',       col: 9,  span: 2 },
    { label: 'Trích NLĐ',    col: 11, span: 2 },
    { label: 'Tổng lương TG', col: 13, span: 1 },
    { label: 'Tổng lương CBCV', col: 14, span: 1 },
    { label: 'Tổng thu nhập', col: 15, span: 1 },
    { label: 'Tạm ứng',      col: 16, span: 1 },
    { label: 'Các khoản khấu trừ', col: 17, span: 5 },
    { label: 'Thuế TNCN',    col: 22, span: 1 },
    { label: 'Thực nhận',    col: 23, span: 1 },
  ]

  for (const g of groupHeaders) {
    if (g.span > 1) ws.mergeCells(2, g.col, 2, g.col + g.span - 1)
    const cell = ws.getCell(2, g.col)
    cell.value = g.label
    cell.font = { bold: true }
    cell.fill = headerFill
    cell.alignment = centerAlign
    cell.border = thinBorder
  }

  // 6. Header tầng 2 (hàng 3) — cột con
  const subHeaders = [
    '', '', '',  // STT, Mã NV, Họ tên (merge với hàng 2)
    '', '',       // Mức lương, Hệ số
    'Ngày công', 'Tiền',
    '',           // Ăn cơm CN (không có sub)
    'Công', 'Tiền',
    'BHXH(8%)+BHTN(1%)', 'BHYT(1.5%)',
    '', '', '',   // Tổng TG, Tổng CBCV, Tổng TN
    '',           // Tạm ứng
    'BHXH(26%)', 'BHYT(4.5%)', 'BHTN(1.5%)', 'CĐ phí', 'Ăn CN',
    '',           // Thuế TNCN
    '',           // Thực nhận
  ]

  for (let i = 0; i < subHeaders.length; i++) {
    const cell = ws.getCell(3, i + 1)
    if (subHeaders[i]) {
      cell.value = subHeaders[i]
      cell.font = { bold: true }
      cell.fill = headerFill
      cell.alignment = centerAlign
    }
    cell.border = thinBorder
  }

  // Merge các ô không có sub-header
  const mergeRows = [1, 2, 3, 4, 5, 8, 13, 14, 15, 16, 22, 23]
  for (const col of mergeRows) {
    ws.mergeCells(2, col, 3, col)
  }

  // Freeze top 3 rows + 3 cột đầu
  ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 3 }]

  // 7. Data rows
  let stt = 1
  let startDataRow = 4

  const totals = new Array(TOTAL_COLS).fill(0)

  for (const rec of records) {
    const row = ws.getRow(startDataRow + stt - 1)
    const si = rec.salaryInfo

    const values = [
      stt,
      rec.employee.code,
      rec.employee.fullName,
      si?.baseSalary ?? 0,
      si?.salaryCoefficient ?? 0,
      rec.actualWorkDays,
      rec.timeSalary,
      rec.mealAllowance,
      rec.shift3Days,
      rec.shift3Allowance,
      rec.bhxhDeduction + rec.bhtnDeduction,  // Trích NLĐ: BHXH+BHTN
      rec.bhytDeduction,
      rec.timeSalary + rec.mealAllowance + rec.shift3Allowance,  // Tổng TG
      rec.performanceSalary + rec.specialAllowance,              // Tổng CBCV
      rec.totalIncome,
      rec.advanceDeduction,
      rec.bhxhDeduction,
      rec.bhytDeduction,
      rec.bhtnDeduction,
      rec.unionFeeDeduction,
      rec.mealDeduction,
      rec.incomeTaxDeduction,
      rec.netSalary,
    ]

    row.values = values
    row.eachCell((cell, colNum) => {
      cell.border = thinBorder
      if (colNum >= 4) cell.numFmt = moneyFmt  // Format tiền từ cột D trở đi
      if (colNum !== 3) cell.alignment = { horizontal: 'right' } // Căn phải trừ tên
    })
    // Căn giữa STT
    row.getCell(1).alignment = { horizontal: 'center' }

    // Cộng tổng (bỏ qua 3 cột đầu text)
    for (let i = 3; i < TOTAL_COLS; i++) {
      if (typeof values[i] === 'number') totals[i] = (totals[i] || 0) + values[i]
    }

    stt++
  }

  // 8. Hàng tổng cộng
  const totalRowNum = startDataRow + records.length
  const totalRow = ws.getRow(totalRowNum)
  ws.mergeCells(totalRowNum, 1, totalRowNum, 3)
  totalRow.getCell(1).value = 'TỔNG CỘNG'
  totalRow.getCell(1).font = { bold: true }
  totalRow.getCell(1).alignment = { horizontal: 'center' }

  for (let i = 3; i < TOTAL_COLS; i++) {
    const cell = totalRow.getCell(i + 1)
    cell.value = totals[i]
    cell.numFmt = moneyFmt
    cell.font = { bold: true }
    cell.border = thinBorder
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
  }

  // 9. Column widths
  ws.getColumn(1).width = 5   // STT
  ws.getColumn(2).width = 10  // Mã NV
  ws.getColumn(3).width = 25  // Họ tên
  for (let i = 4; i <= TOTAL_COLS; i++) ws.getColumn(i).width = 14

  // 10. Export
  const arrayBuffer = await wb.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}
```

## Lưu ý
- Cột "Thực nhận" (cột W) nên có font bold + fill vàng nhạt để nổi bật
- Nếu `departmentId` được truyền: thêm tên phòng ban vào header title
- File name: `bang-luong-T${month}-${year}.xlsx`
