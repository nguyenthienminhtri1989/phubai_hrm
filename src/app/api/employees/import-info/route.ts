// src/app/api/employees/import-info/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Không có file nào được tải lên" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.getWorksheet(1); // Lấy sheet đầu tiên
    if (!worksheet) {
        return NextResponse.json({ error: "File Excel rỗng" }, { status: 400 });
    }

    const updates: Promise<any>[] = [];
    
    // Giả sử File Excel có cấu trúc cột như sau (Bắt đầu từ dòng 2):
    // A: Mã NV | B: Tên (Bỏ qua) | C: Ngày vào | D: Số CCCD | E: Ngày cấp | F: Nơi cấp | G: Số TK | H: MST

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Bỏ qua dòng tiêu đề

      const code = row.getCell(1).text?.toString().trim(); // Cột A: Mã NV
      
      // Nếu không có mã NV thì bỏ qua
      if (!code) return;

      // Hàm helper để lấy ngày tháng từ Excel an toàn
      const getDate = (cellIndex: number) => {
          const val = row.getCell(cellIndex).value;
          if (!val) return null;
          // ExcelJS đôi khi trả về object Date, đôi khi trả về string
          return new Date(val as string | number | Date);
      };

      const startDate = getDate(3);        // Cột C
      const idCardNumber = row.getCell(4).text?.toString().trim(); // Cột D
      const idCardDate = getDate(5);       // Cột E
      const idCardPlace = row.getCell(6).text?.toString().trim();  // Cột F
      const bankAccount = row.getCell(7).text?.toString().trim();  // Cột G
      const taxCode = row.getCell(8).text?.toString().trim();      // Cột H

      // Đẩy vào mảng Promise để chạy cập nhật
      // Sử dụng prisma.update với điều kiện where code
      updates.push(
        prisma.employee.update({
          where: { code: code }, // <--- Mấu chốt là đây: Tìm theo Mã NV
          data: {
            startDate,
            idCardNumber,
            idCardDate,
            idCardPlace,
            bankAccount,
            taxCode
          }
        }).catch(err => {
            console.log(`Không tìm thấy hoặc lỗi update NV mã ${code}:`, err.message);
            return null; 
        })
      );
    });

    // Thực hiện cập nhật song song (nhanh hơn vòng lặp thường)
    await Promise.all(updates);

    return NextResponse.json({ message: `Đã xử lý cập nhật ${updates.length} nhân viên` });

  } catch (error) {
    console.error("Lỗi import:", error);
    return NextResponse.json({ error: "Lỗi xử lý file" }, { status: 500 });
  }
}