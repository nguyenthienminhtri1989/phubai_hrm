---
name: update-project-overview
description: "Cập nhật file PROJECT_OVERVIEW.md sau khi phát triển/thay đổi tính năng. BẮT BUỘC kích hoạt khi: vừa thêm tính năng mới (page, API route, module), thay đổi schema Prisma, thêm role/permission, thay đổi business logic cốt lõi, thêm thư viện vào tech stack, hoặc khi developer nói 'xong rồi', 'đã hoàn thành', 'feature done', 'cập nhật overview', 'update doc', 'ghi lại tài liệu', trước khi commit cho feat/schema/refactor lớn. Bỏ qua khi chỉ là fix lỗi nhỏ, style/CSS, đổi text, hoặc thay đổi không ảnh hưởng kiến trúc."
---

# Update PROJECT_OVERVIEW.md After Feature Development

## Mục đích
Đảm bảo file `PROJECT_OVERVIEW.md` ở root dự án luôn là **single source of truth** phản ánh đúng trạng thái hiện tại của hệ thống PHUBAI-HRM. Mọi AI Agent (Claude Code, Cursor, Copilot...) khi vào dự án đều phải đọc file này trước, nên nó **bắt buộc** phải được cập nhật sau mỗi tính năng mới.

## Khi nào BẮT BUỘC chạy skill này

Trigger ngay sau khi:

| Loại thay đổi | Cập nhật mục nào trong PROJECT_OVERVIEW.md |
|---|---|
| Thêm bảng/field mới vào `prisma/schema.prisma` | Mục **3. CORE DATABASE SCHEMA** |
| Thêm Role mới hoặc đổi quyền | Mục **4. ROLE & PERMISSIONS** |
| Thêm module/page mới (vd: `/salary`, `/recruitment`) | Mục **6. PROJECT DIRECTORY STRUCTURE** + thêm mô tả ở mục 5 nếu có business logic |
| Thêm logic nghiệp vụ mới (vd: tính lương, OT, KPI) | Mục **5. CORE BUSINESS LOGIC** (thêm section 5.x mới) |
| Thêm thư viện mới (vd: `puppeteer`, `socket.io`) | Mục **2. TECH STACK** |
| Đổi convention code (vd: chuyển sang Server Actions) | Mục **7. CODING CONVENTIONS FOR AI** |
| Đổi luồng auth, middleware, layout | Mục **6. PROJECT DIRECTORY STRUCTURE** |

## Khi nào BỎ QUA (không cần update)

- Fix bug nhỏ không thay đổi cấu trúc.
- Đổi CSS/màu sắc/text UI.
- Refactor nội bộ 1 hàm không đổi interface.
- Sửa typo, format code.
- Thêm test, log, comment.

## Quy trình thực thi

### Bước 1: Đọc trạng thái hiện tại
1. `Read` file `PROJECT_OVERVIEW.md` để hiểu cấu trúc 7 mục hiện có.
2. Xác định những gì đã thay đổi trong session (file mới, schema diff, API mới...).

### Bước 2: Xác định mục cần sửa
Map thay đổi → mục tương ứng theo bảng phía trên. Một tính năng lớn có thể chạm nhiều mục.

### Bước 3: Soạn nội dung cập nhật
Tuân thủ phong cách hiện tại của file:
- **Tiếng Việt**, ngắn gọn, có ví dụ code/path cụ thể.
- Dùng bullet `-` và **bold** cho thuật ngữ quan trọng.
- Đường dẫn file luôn dùng backtick: `src/app/...`
- Ký hiệu, mã code wrap trong backtick: `X/2`, `TimesheetLock`.
- Nếu thêm business logic mới → đánh số tiếp theo (vd: `5.6. Logic Tính Lương`).
- Nếu thêm Key File → thêm dòng vào mục 6, format: `` `path/to/file`: Mô tả ngắn. ``

### Bước 4: Áp dụng bằng Edit
- Dùng `Edit` tool với context đủ rộng để unique.
- **KHÔNG** ghi đè toàn file bằng `Write` (rủi ro mất nội dung khác).
- Sau khi sửa, `Read` lại đoạn đã sửa để xác nhận.

### Bước 5: Báo cáo cho user
Tóm tắt trong 1-2 câu: "Đã cập nhật mục X trong PROJECT_OVERVIEW.md (thêm Y)". Gợi ý commit kèm `docs: update PROJECT_OVERVIEW.md` hoặc gộp vào commit feature dưới dạng "feat(x): ... + update overview".

## Ví dụ

### Ví dụ 1: Vừa thêm module Tính lương
Sau khi tạo `src/app/salary/`, `src/app/api/salary/`, thêm bảng `SalaryConfig` vào schema:

1. Thêm bảng vào mục 3:
   ```
   - **SalaryConfig (Cấu hình lương):** Lưu hệ số lương cơ bản, phụ cấp, BHXH theo từng `kipId` và `departmentId`...
   ```
2. Thêm section 5.6:
   ```
   ### 5.6. Logic Tính Lương Tháng
   - Lấy tổng công từ Timesheet → nhân hệ số `factor` của AttendanceCode → cộng phụ cấp...
   ```
3. Thêm vào mục 6:
   ```
   - `src/app/salary/monthly/page.tsx`: UI bảng lương tháng & xuất Excel.
   ```

### Ví dụ 2: Vừa thêm thư viện QR
Sau khi `pnpm add qrcode.react`:
- Mục 2 TECH STACK: thêm `qrcode.react (sinh QR cho máy/nhân viên)` vào dòng Utilities.

### Ví dụ 3: Vừa thêm Role STAFF
Mục 4: thêm dòng:
```
- `STAFF`: Nhân viên thường. Chỉ xem bảng công của bản thân, được sửa bảng làm thêm cá nhân.
```

## Anti-patterns

- ❌ Tạo file mới như `CHANGELOG.md`, `FEATURES.md` — chỉ cập nhật **đúng file** `PROJECT_OVERVIEW.md`.
- ❌ Copy paste nguyên đoạn code dài vào overview — chỉ tóm tắt nghiệp vụ.
- ❌ Viết tiếng Anh xen lẫn không cần thiết — giữ tiếng Việt nhất quán.
- ❌ Update khi chỉ sửa CSS — gây ồn cho file overview.
- ❌ Quên đánh số tiếp theo cho section 5.x mới.
