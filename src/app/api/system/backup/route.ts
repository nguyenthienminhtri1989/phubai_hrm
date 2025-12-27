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

    // 2. LẤY DATABASE URL
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json(
        { error: "Chưa cấu hình DATABASE_URL" },
        { status: 500 }
      );
    }

    // 3. CẤU HÌNH ĐƯỜNG DẪN PG_DUMP (QUAN TRỌNG TRÊN WINDOWS)
    // Bạn hãy sửa đường dẫn dưới đây cho đúng với máy chủ của bạn
    // Lưu ý: Dùng 2 dấu gạch chéo \\
    const pgDumpPath = '"C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe"';

    // Nếu bạn đã cài biến môi trường thì dùng dòng dưới này (nhưng hay lỗi trên Windows)
    // const pgDumpPath = 'pg_dump';

    console.log("Đang bắt đầu backup...");

    // 4. TẠO LỆNH
    // --no-owner --no-acl: Bỏ qua quyền sở hữu để dễ restore
    const command = `${pgDumpPath} "${dbUrl}" --no-owner --no-acl`;

    // 5. THỰC THI
    // Tăng buffer lên 100MB để chứa file sql
    const { stdout, stderr } = await execPromise(command, {
      maxBuffer: 1024 * 1024 * 100,
      env: process.env, // Kế thừa biến môi trường hệ thống
    });

    if (stderr) {
      console.warn("Backup warning (không phải lỗi):", stderr);
    }

    console.log("Backup thành công, đang gửi file...");

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
    console.error("LỖI BACKUP NGHIÊM TRỌNG:", error);

    // Trả về lỗi chi tiết để Client biết đường sửa
    return NextResponse.json(
      { error: "Lỗi Server: " + (error.message || error.toString()) },
      { status: 500 }
    );
  }
}
