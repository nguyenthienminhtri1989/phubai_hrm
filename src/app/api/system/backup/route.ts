// src/app/api/system/backup/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

export async function GET() {
  try {
    // 1. KIỂM TRA QUYỀN
    const session = await auth();
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này" },
        { status: 403 }
      );
    }

    // 2. LẤY & XỬ LÝ DATABASE URL (QUAN TRỌNG)
    let dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json(
        { error: "Chưa cấu hình DATABASE_URL" },
        { status: 500 }
      );
    }

    // --- SỬA LỖI: CẮT BỎ THAM SỐ ?schema=public ---
    // pg_dump không chịu tham số này, nên ta phải bỏ đi
    if (dbUrl.includes("?")) {
      dbUrl = dbUrl.split("?")[0];
    }
    // ----------------------------------------------

    // 3. CẤU HÌNH ĐƯỜNG DẪN (CẬP NHẬT THEO LOG CỦA BẠN: BẢN 17)
    // Log của bạn cho thấy bạn đang cài bản 17, hãy sửa số 16 thành 17
    const pgDumpPath = '"C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe"';

    console.log("Đang bắt đầu backup với URL đã làm sạch...");

    // 4. TẠO LỆNH
    const command = `${pgDumpPath} "${dbUrl}" --no-owner --no-acl`;

    // 5. THỰC THI
    const { stdout, stderr } = await execPromise(command, {
      maxBuffer: 1024 * 1024 * 100, // 100MB buffer
      env: process.env,
    });

    if (stderr) {
      console.warn("Backup warning:", stderr);
    }

    // 6. TRẢ VỀ FILE
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `backup_phubai_${dateStr}.sql`;

    return new NextResponse(stdout, {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/sql",
      },
    });
  } catch (error: any) {
    console.error("LỖI BACKUP CHI TIẾT:", error);
    return NextResponse.json(
      { error: "Lỗi Server: " + (error.message || error.toString()) },
      { status: 500 }
    );
  }
}
