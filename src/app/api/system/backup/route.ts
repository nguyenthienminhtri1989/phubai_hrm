// src/app/api/system/backup/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth"; // Đường dẫn tới file auth của bạn
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

export async function GET() {
  try {
    // 1. KIỂM TRA QUYỀN (BẢO MẬT)
    const session = await auth();
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này" },
        { status: 403 }
      );
    }

    // 2. LẤY CHUỖI KẾT NỐI DB
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json(
        { error: "Chưa cấu hình DATABASE_URL" },
        { status: 500 }
      );
    }

    // 3. CẤU HÌNH LỆNH BACKUP
    // Lưu ý: pg_dump phải được cài trên máy chủ
    // --no-owner --no-acl: Giúp file backup sạch hơn, dễ restore sang máy khác
    const command = `pg_dump "${dbUrl}" --no-owner --no-acl`;

    // 4. THỰC THI LỆNH
    // Tăng maxBuffer lên 50MB (hoặc hơn tùy data) để tránh lỗi nếu DB lớn
    const { stdout, stderr } = await execPromise(command, {
      maxBuffer: 1024 * 1024 * 50,
    });

    if (stderr) {
      // pg_dump đôi khi in warning vào stderr nhưng vẫn thành công.
      // Chỉ coi là lỗi nghiêm trọng nếu không có stdout.
      console.warn("Backup warning:", stderr);
    }

    // 5. TRẢ VỀ FILE CHO CLIENT
    // Tạo tên file có ngày giờ: backup_2025-12-27.sql
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `backup_phubai_${dateStr}.sql`;

    return new NextResponse(stdout, {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/sql",
      },
    });
  } catch (error: any) {
    console.error("Lỗi Backup:", error);
    return NextResponse.json(
      { error: "Lỗi khi tạo backup: " + error.message },
      { status: 500 }
    );
  }
}
