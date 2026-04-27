// src/app/api/system/restore/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import os from "os";

const execPromise = promisify(exec);

export async function POST(req: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    // 1. KIỂM TRA QUYỀN - Chỉ ADMIN mới được restore
    const session = await auth();
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện thao tác này" },
        { status: 403 }
      );
    }

    // 2. ĐỌC FILE TỪ FORM DATA
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Không tìm thấy file SQL trong request" },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".sql")) {
      return NextResponse.json(
        { error: "Chỉ chấp nhận file có định dạng .sql" },
        { status: 400 }
      );
    }

    // 3. GHI FILE TẠM VÀO HỆ THỐNG
    const buffer = Buffer.from(await file.arrayBuffer());
    tempFilePath = path.join(os.tmpdir(), `restore_${Date.now()}.sql`);
    await writeFile(tempFilePath, buffer);

    // 4. LẤY & XỬ LÝ DATABASE URL
    let dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json(
        { error: "Chưa cấu hình DATABASE_URL" },
        { status: 500 }
      );
    }

    // Cắt bỏ tham số ?schema=public nếu có
    if (dbUrl.includes("?")) {
      dbUrl = dbUrl.split("?")[0];
    }

    // 5. CẤU HÌNH ĐƯỜNG DẪN PSQL (PostgreSQL 17)
    const psqlPath = '"C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe"';

    console.log("Đang bắt đầu restore database...");

    // 6. TẠO LỆNH RESTORE
    // --single-transaction: rollback toàn bộ nếu lỗi giữa chừng
    // -f: đường dẫn file SQL
    const command = `${psqlPath} "${dbUrl}" --single-transaction -f "${tempFilePath}"`;

    // 7. THỰC THI
    const { stdout, stderr } = await execPromise(command, {
      maxBuffer: 1024 * 1024 * 200, // 200MB buffer
      env: process.env,
    });

    if (stderr) {
      console.warn("Restore warning:", stderr);
    }

    console.log("Restore hoàn thành:", stdout);

    return NextResponse.json({ success: true, message: "Khôi phục dữ liệu thành công!" });
  } catch (error: any) {
    console.error("LỖI RESTORE CHI TIẾT:", error);
    return NextResponse.json(
      { error: "Lỗi Server khi restore: " + (error.message || error.toString()) },
      { status: 500 }
    );
  } finally {
    // 8. XÓA FILE TẠM
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
      } catch {
        // Bỏ qua nếu xóa file tạm bị lỗi
      }
    }
  }
}
