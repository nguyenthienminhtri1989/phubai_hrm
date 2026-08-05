// src/app/api/system/restore/route.ts
//
// ⚠️ CHỨC NĂNG RESTORE QUA GIAO DIỆN ĐÃ BỊ VÔ HIỆU HÓA (08/2026).
//
// Lý do: cho phép upload một file .sql tùy ý rồi chạy thẳng qua psql trên server
// là một lỗ hổng bảo mật nghiêm trọng:
//   - File .sql có thể chứa lệnh phá hoại (DROP, TRUNCATE...) ghi đè toàn bộ DB,
//     không thể hoàn tác.
//   - PostgreSQL hỗ trợ `COPY ... FROM/TO PROGRAM '...'` cho phép thực thi lệnh
//     shell tùy ý dưới quyền user postgres → nguy cơ chiếm quyền điều khiển
//     server (RCE). `--single-transaction` KHÔNG chặn được điều này.
//   - Chỉ cần một phiên đăng nhập ADMIN bị lộ là toàn bộ hệ thống có thể bị
//     xóa hoặc khống chế.
//
// Việc khôi phục CSDL phải được thực hiện THỦ CÔNG trên server bởi quản trị viên,
// sau khi đã kiểm tra kỹ nội dung file backup, ví dụ:
//
//   psql "$DATABASE_URL" --single-transaction -f backup.sql
//
// Nếu sau này thực sự cần bật lại qua giao diện, hãy cân nhắc: xác thực/kiểm duyệt
// nội dung file, chạy trong môi trường tách biệt, và không dùng quyền superuser.

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Chức năng khôi phục (restore) qua giao diện đã bị vô hiệu hóa vì lý do an toàn. Vui lòng thực hiện restore thủ công trực tiếp trên server.",
    },
    { status: 410 } // 410 Gone
  );
}
