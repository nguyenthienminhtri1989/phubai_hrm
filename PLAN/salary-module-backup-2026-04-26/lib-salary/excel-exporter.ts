import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'

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
      month,
      year,
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
  wb.creator = 'PHUBAI-HRM'
  wb.created = new Date()
  const ws = wb.addWorksheet(`Lương T${month}.${year}`)

  // 3. Styles dùng chung
  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9E1F2' },
  }
  const totalFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFF2CC' },
  }
  const netSalaryFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2EFDA' },
  }
  const moneyFmt = '#,##0'
  const centerAlign: Partial<ExcelJS.Alignment> = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true,
  }
  const thinBorder: Partial<ExcelJS.Borders> = {
    top:    { style: 'thin' },
    bottom: { style: 'thin' },
    left:   { style: 'thin' },
    right:  { style: 'thin' },
  }

  const TOTAL_COLS = 23 // Cột A → W

  // 4. Hàng 1: Tiêu đề lớn
  ws.mergeCells(1, 1, 1, TOTAL_COLS)
  const titleCell = ws.getCell(1, 1)
  const deptSuffix = departmentId ? '' : ''  // Có thể thêm tên phòng ban nếu cần
  titleCell.value = `DANH SÁCH DỰ KIẾN CHI TIẾT TIỀN LƯƠNG THÁNG ${month} NĂM ${year}${deptSuffix}`
  titleCell.font = { bold: true, size: 13 }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 28

  // 5. Hàng 2: Header nhóm (tầng 1)
  // Định nghĩa từng nhóm: [label, cột bắt đầu, số cột span]
  const groupHeaders: Array<{ label: string; col: number; span: number }> = [
    { label: 'STT',                   col: 1,  span: 1 },
    { label: 'Mã NV',                 col: 2,  span: 1 },
    { label: 'Họ tên',                col: 3,  span: 1 },
    { label: 'Mức lương',             col: 4,  span: 1 },
    { label: 'Hệ số',                 col: 5,  span: 1 },
    { label: 'Lương thời gian',       col: 6,  span: 2 },
    { label: 'Ăn cơm CN',            col: 8,  span: 1 },
    { label: 'PC Ca 3',              col: 9,  span: 2 },
    { label: 'Trích NLĐ',            col: 11, span: 2 },
    { label: 'Tổng lương TG',        col: 13, span: 1 },
    { label: 'Tổng lương CBCV',      col: 14, span: 1 },
    { label: 'Tổng thu nhập',        col: 15, span: 1 },
    { label: 'Tạm ứng',              col: 16, span: 1 },
    { label: 'Các khoản khấu trừ',   col: 17, span: 5 },
    { label: 'Thuế TNCN',            col: 22, span: 1 },
    { label: 'Thực nhận',            col: 23, span: 1 },
  ]

  ws.getRow(2).height = 36
  for (const g of groupHeaders) {
    if (g.span > 1) ws.mergeCells(2, g.col, 2, g.col + g.span - 1)
    const cell = ws.getCell(2, g.col)
    cell.value = g.label
    cell.font = { bold: true }
    cell.fill = headerFill
    cell.alignment = centerAlign
    cell.border = thinBorder
  }

  // 6. Hàng 3: Header cột con (tầng 2)
  // Mỗi phần tử tương ứng cột 1→23
  const subHeaders = [
    '',                       // 1: STT      (merge với hàng 2)
    '',                       // 2: Mã NV    (merge)
    '',                       // 3: Họ tên   (merge)
    '',                       // 4: Mức lương (merge)
    '',                       // 5: Hệ số   (merge)
    'Ngày công',              // 6
    'Tiền',                   // 7
    '',                       // 8: Ăn cơm CN (merge)
    'Công',                   // 9
    'Tiền',                   // 10
    'BHXH(8%)+BHTN(1%)',      // 11
    'BHYT(1.5%)',             // 12
    '',                       // 13: Tổng TG (merge)
    '',                       // 14: Tổng CBCV (merge)
    '',                       // 15: Tổng TN (merge)
    '',                       // 16: Tạm ứng (merge)
    'BHXH(17.5%)',            // 17 — phần công ty đóng (dùng cho tổng hợp)
    'BHYT(3%)',               // 18
    'BHTN(1%)',               // 19
    'CĐ phí',                 // 20
    'Ăn CN',                  // 21
    '',                       // 22: Thuế TNCN (merge)
    '',                       // 23: Thực nhận (merge)
  ]

  ws.getRow(3).height = 30
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

  // Merge các cột không có sub-header (hàng 2 xuống hàng 3)
  const singleCols = [1, 2, 3, 4, 5, 8, 13, 14, 15, 16, 22, 23]
  for (const col of singleCols) {
    ws.mergeCells(2, col, 3, col)
  }

  // Thực nhận (col 23) — highlight vàng xanh
  ws.getCell(2, 23).fill = netSalaryFill
  ws.getCell(2, 23).font = { bold: true, color: { argb: 'FF375623' } }

  // Freeze top 3 rows + 3 cột đầu
  ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 3 }]

  // 7. Data rows — bắt đầu từ hàng 4
  const DATA_START_ROW = 4
  let stt = 1
  const totals = new Array(TOTAL_COLS + 1).fill(0) // index 1-based

  for (const rec of records) {
    const rowNum = DATA_START_ROW + stt - 1
    const row = ws.getRow(rowNum)
    const si = rec.salaryInfo

    const values = [
      stt,                                                             // 1:  STT
      rec.employee.code,                                               // 2:  Mã NV
      rec.employee.fullName,                                           // 3:  Họ tên
      si?.baseSalary ?? 0,                                             // 4:  Mức lương
      si?.salaryCoefficient ?? 0,                                      // 5:  Hệ số
      rec.actualWorkDays,                                              // 6:  Ngày công
      rec.timeSalary,                                                  // 7:  Tiền TG
      rec.mealAllowance,                                               // 8:  Ăn cơm CN
      rec.shift3Days,                                                  // 9:  Công ca 3
      rec.shift3Allowance,                                             // 10: Tiền ca 3
      rec.bhxhDeduction + rec.bhtnDeduction,                          // 11: Trích NLĐ BHXH+BHTN
      rec.bhytDeduction,                                               // 12: Trích NLĐ BHYT
      rec.timeSalary + rec.mealAllowance + rec.shift3Allowance,       // 13: Tổng lương TG
      rec.performanceSalary + rec.specialAllowance,                    // 14: Tổng lương CBCV
      rec.totalIncome,                                                  // 15: Tổng thu nhập
      rec.advanceDeduction,                                             // 16: Tạm ứng
      rec.bhxhDeduction,                                               // 17: BHXH NV
      rec.bhytDeduction,                                               // 18: BHYT NV
      rec.bhtnDeduction,                                               // 19: BHTN NV
      rec.unionFeeDeduction,                                            // 20: CĐ phí
      rec.mealDeduction,                                               // 21: Ăn CN (trừ)
      rec.incomeTaxDeduction,                                          // 22: Thuế TNCN
      rec.netSalary,                                                   // 23: Thực nhận
    ]

    row.values = ['', ...values] // ExcelJS row.values là 1-based, thêm '' để index khớp

    row.eachCell({ includeEmpty: false }, (cell, colNum) => {
      cell.border = thinBorder
      // Format tiền từ cột 4 trở đi (trừ cột 5 Hệ số và cột 9 Công ca 3)
      if (colNum >= 4 && colNum !== 5 && colNum !== 9) {
        cell.numFmt = moneyFmt
      }
      if (colNum === 1) {
        cell.alignment = { horizontal: 'center' }
      } else if (colNum === 3) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' }
      } else if (colNum >= 4) {
        cell.alignment = { horizontal: 'right' }
      }
    })

    // Highlight cột Thực nhận
    const netCell = row.getCell(23)
    netCell.font = { bold: true }
    netCell.fill = netSalaryFill

    // Cộng tổng (bỏ cột STT, Mã NV, Họ tên, Hệ số)
    for (let i = 3; i < values.length; i++) {
      const v = values[i]
      if (typeof v === 'number' && i !== 4 && i !== 8) { // bỏ Hệ số(idx4) và Công ca3(idx8)
        totals[i + 1] = (totals[i + 1] || 0) + v
      }
    }

    stt++
  }

  // 8. Hàng tổng cộng
  const totalRowNum = DATA_START_ROW + records.length
  const totalRow = ws.getRow(totalRowNum)
  ws.mergeCells(totalRowNum, 1, totalRowNum, 3)

  const labelCell = totalRow.getCell(1)
  labelCell.value = 'TỔNG CỘNG'
  labelCell.font = { bold: true }
  labelCell.alignment = { horizontal: 'center', vertical: 'middle' }
  labelCell.border = thinBorder
  labelCell.fill = totalFill

  for (let col = 4; col <= TOTAL_COLS; col++) {
    const cell = totalRow.getCell(col)
    cell.value = totals[col] || 0
    cell.numFmt = moneyFmt
    cell.font = { bold: true }
    cell.border = thinBorder
    cell.fill = col === 23 ? netSalaryFill : totalFill
    cell.alignment = { horizontal: 'right' }
  }

  // Hàng tổng cộng chiều cao
  totalRow.height = 22

  // 9. Column widths
  ws.getColumn(1).width = 5    // STT
  ws.getColumn(2).width = 10   // Mã NV
  ws.getColumn(3).width = 26   // Họ tên
  ws.getColumn(4).width = 14   // Mức lương
  ws.getColumn(5).width = 8    // Hệ số
  ws.getColumn(6).width = 10   // Ngày công
  for (let i = 7; i <= TOTAL_COLS; i++) {
    ws.getColumn(i).width = i === 23 ? 16 : 13 // Thực nhận rộng hơn
  }

  // 10. Export buffer
  const arrayBuffer = await wb.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}
