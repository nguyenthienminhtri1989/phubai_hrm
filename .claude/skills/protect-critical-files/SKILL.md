---
name: protect-critical-files
description: "Bảo vệ các file/thư mục quan trọng của hệ thống PHUBAI-HRM khỏi việc bị xóa hoặc thay đổi cấu trúc một cách tùy tiện. BẮT BUỘC tham chiếu skill này TRƯỚC KHI thực hiện bất kỳ thao tác: xóa file (rm, del, Remove-Item), xóa thư mục, ghi đè file cấu hình, drop bảng Prisma, xóa migration, xóa env, xóa lock file, dọn dẹp 'rác', refactor lớn có kèm xóa. Trigger khi user nói: 'xóa', 'dọn dẹp', 'clean up', 'remove', 'gỡ bỏ', 'không cần nữa', hoặc khi AI đang định chạy lệnh xóa. Mục tiêu: KHÔNG được tự ý xóa file ảnh hưởng đến hệ thống — phải xác nhận với user trước."
---

# Protect Critical Files — PHUBAI-HRM

## Nguyên tắc tối thượng

> **KHÔNG BAO GIỜ tự ý xóa file mà chưa được user xác nhận rõ ràng.**
> Nếu phân vân — luôn HỎI trước, KHÔNG xóa rồi xin lỗi sau.

Mất file ở dự án production HRM = mất dữ liệu nhân sự, mất khả năng tính lương, mất khả năng deploy lại. Không có "Ctrl+Z" cho `rm -rf`.

## Danh mục file/thư mục CẤM XÓA tuyệt đối

### 🔴 Tier 1 — DỪNG NGAY, không bao giờ xóa
| File/Folder | Lý do |
|---|---|
| `.env`, `.env.local`, `.env.production` | Chứa `DATABASE_URL`, `NEXTAUTH_SECRET`, credentials |
| `prisma/schema.prisma` | Schema database, mất là toàn bộ model biến mất |
| `prisma/migrations/` | Lịch sử migration. Xóa → DB lệch, không deploy được |
| `package.json`, `package-lock.json`, `pnpm-lock.yaml` | Khóa version dependencies |
| `next.config.*`, `tsconfig.json`, `tailwind.config.*`, `postcss.config.*` | Cấu hình build |
| `src/auth.ts`, `src/auth.config.ts`, `src/middleware.ts` | Auth & route protection — xóa là sập toàn site |
| `src/lib/prisma.ts` | Prisma singleton — mọi API đều import |
| `.git/`, `.gitignore` | Git history & ignore rules |
| Toàn bộ `src/app/api/**` đang được UI gọi | Endpoint live |
| Database backup files (`*.sql`, `*.dump`) | Bản sao DB |

### 🟡 Tier 2 — HỎI USER trước khi xóa
| File/Folder | Cần hỏi vì |
|---|---|
| `src/app/**/page.tsx` đã có route trong sidebar | Có thể đang được dùng |
| `src/components/AdminLayout.tsx`, `src/components/CommonFilter.tsx` | Shared component |
| Bất kỳ file nào được `import` từ ≥ 2 nơi | Dùng chung |
| `PLAN/`, `PROJECT_OVERVIEW.md`, `architecture.md`, `business-logic.md`, `api-routes.md`, `CLAUDE.md` | Tài liệu dự án |
| `.claude/`, `.claude/skills/`, `.claude/settings*.json` | Cấu hình AI agent |
| File migration cũ trong `prisma/migrations/` dù trông "thừa" | Lịch sử |
| `public/` assets được reference trong code | Có thể đang dùng |
| Bất kỳ file `.zip`/backup trong repo | User chủ đích lưu lại |

### 🟢 Tier 3 — Có thể xóa nhưng phải báo cáo
- File tạm thật sự: `*.tmp`, `*.bak` do AI vừa tạo trong session này.
- File log do AI vừa tạo để debug.
- File test sandbox AI vừa tạo và không cần nữa.
- Output Excel test do AI vừa export thử.

→ Ngay cả Tier 3, vẫn phải **liệt kê tên file** và **báo trước** trong câu trả lời cuối session, không xóa âm thầm.

## Quy trình bắt buộc khi muốn xóa

### Bước 1: Phân loại
Trước khi gõ lệnh xóa, đối chiếu với 3 tier trên.

### Bước 2: Verify usage
Với file ở Tier 2/3 mà nghi ngờ — chạy `Grep` để kiểm tra reference:
```
Grep pattern: "tên-file-không-extension" → xem có chỗ nào import không
```
Nếu kết quả > 0 → upgrade lên Tier 1, **không xóa**.

### Bước 3: Xin xác nhận user
Format thông điệp gửi user:
```
Tôi định xóa:
- path/to/file1.ts (lý do: ...)
- path/to/file2.tsx (lý do: ...)

Đã kiểm tra: không còn nơi nào import.
Bạn xác nhận xóa không? (y/n)
```
→ **Dừng lại chờ user reply.** Không tự suy diễn "chắc user OK".

### Bước 4: Thực thi (sau khi user OK)
- Ưu tiên `git rm` thay vì `rm` để giữ history.
- Xóa từng file, KHÔNG dùng `rm -rf` thư mục lớn.
- KHÔNG dùng `git clean -fd`, `git checkout .`, `git reset --hard` mà chưa hỏi.

### Bước 5: Báo cáo
Liệt kê chính xác file đã xóa để user có thể `git restore` nếu sai.

## Các lệnh CẤM tự ý chạy

- ❌ `rm -rf <dir>` khi `<dir>` không phải do AI vừa tạo trong session này
- ❌ `git clean -fd`, `git clean -fdx`
- ❌ `git reset --hard`, `git checkout -- .`
- ❌ `git push --force`, `git push -f` (đặc biệt vào `master`/`main`)
- ❌ `git branch -D <branch>`
- ❌ `prisma migrate reset` (xóa toàn bộ DB)
- ❌ `prisma db push --accept-data-loss`
- ❌ `DROP TABLE`, `DROP DATABASE`, `TRUNCATE` trong SQL
- ❌ `Remove-Item -Recurse -Force` cho thư mục dự án
- ❌ `pnpm/npm uninstall <package>` khi chưa rõ package đó dùng ở đâu

→ Tất cả đều phải HỎI user trước, kể cả khi user đã nói "dọn dẹp" — vẫn liệt kê và xin xác nhận lần nữa.

## Anti-patterns thường gặp

### ❌ Sai: "User bảo dọn dẹp file thừa → xóa hết file không nằm trong import tree"
→ File có thể được dùng qua dynamic import, qua route convention của Next.js, qua Prisma generate, qua script CI. Không thấy import ≠ không dùng.

### ❌ Sai: "Đổi cấu trúc nên xóa file cũ luôn cho gọn"
→ Phải đổi tên / move, không xóa. User có thể đang reference file cũ.

### ❌ Sai: "Migration cũ trông không cần thiết → xóa"
→ Migration là append-only. Xóa migration cũ phá vỡ lịch sử DB.

### ❌ Sai: "File `.env.example` giống `.env` → xóa cái example"
→ `.env.example` là template để dev khác clone repo. Giữ lại.

### ❌ Sai: "Tạo file thay thế, file cũ chắc bỏ được"
→ Đề xuất user xóa, nhưng để user tự quyết.

## Ví dụ phản ứng đúng

**User:** "dọn dẹp lại module timesheet cho gọn"

**AI đúng:**
```
Tôi rà soát module timesheet thấy các file sau có thể bỏ:
- src/app/timesheets/old-page-backup.tsx (không có ai import)
- src/app/timesheets/test.tsx (file test còn sót)

Các file sau tôi KHÔNG đề xuất xóa vì đang được dùng:
- src/app/timesheets/daily/page.tsx (route active)
- src/app/timesheets/monthly/page.tsx (route active)

Bạn xác nhận xóa 2 file đầu không?
```

**AI sai:**
```
Đã dọn dẹp xong module timesheet, xóa 5 file dư thừa.
```
(→ user mất file mà không biết file nào.)

## Khi user nói "xóa hết X" rộng rãi

Vẫn liệt kê cụ thể trước, KHÔNG diễn dịch thành lệnh quét rộng:
- "xóa hết file backup" → liệt kê các file `*.bak`, `*backup*` tìm được, hỏi xác nhận.
- "clean cache" → chỉ dùng lệnh cache an toàn (`pnpm store prune`, `.next/`), không động vào `node_modules` nếu user chưa nói rõ.
