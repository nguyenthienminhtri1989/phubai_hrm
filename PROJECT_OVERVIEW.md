# PROJECT CONTEXT — PHÚ BÀI HRM & TIMEKEEPING

> **Tài liệu này là điểm vào (entry point) cho mọi AI Agent làm việc với codebase.**
> Đọc hết tài liệu này trước khi sửa code. Sau khi thêm tính năng mới → cập nhật lại file này (xem skill `update-project-overview`).

---

## 0. TL;DR — Đọc trong 30 giây

- **Là gì:** Web app nội bộ thay thế việc chấm công bằng giấy cho **Công ty Cổ phần Sợi Phú Bài** (~650 nhân sự).
- **Phục vụ ai:** Người chấm công (TIMEKEEPER) ghi công hàng ngày → HR khóa sổ cuối tháng → Xuất Excel sang phần mềm tính lương Bravo.
- **Quy mô vận hành:** **3 nhà máy** (NM1, NM2, NM3), mỗi NM tối đa **10 kíp** sản xuất + khối hành chính.
- **Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Prisma 5 + PostgreSQL + NextAuth v5 + Ant Design v6 + Tailwind v4.
- **Triển khai:** Self-hosted trên Windows Server (intranet), DB PostgreSQL local.
- **Điểm dễ sai nhất:** Logic "Ma trận NM2" (mục [5.1](#51-logic-ma-trận-—-3-mô-hình-nhà-máy)) và check `TimesheetLock` trước khi ghi (mục [5.3](#53-lưu-chấm-công-daily-timesheet)).

---

## 1. KIẾN TRÚC TỔNG THỂ

### 1.1. Luồng dữ liệu chính

```
┌──────────────┐     ┌────────────────┐     ┌────────────────┐
│ TIMEKEEPER   │────▶│ /timesheets/   │────▶│ POST /api/     │
│ (Web Mobile) │     │   daily        │     │  timesheets    │
└──────────────┘     └────────────────┘     └────────┬───────┘
                                                     │ upsert + $transaction
                                            ┌────────▼───────┐
                                            │   PostgreSQL   │
                                            │  Timesheet     │
                                            │  TimesheetLock │
                                            └────────┬───────┘
                                                     │
┌──────────────┐     ┌────────────────┐              │
│ HR_MANAGER   │────▶│ /timesheets/   │──────────────┘
│              │     │   monthly      │──▶ Excel (ExcelJS) ──▶ Bravo Payroll
└──────────────┘     └────────────────┘
```

### 1.2. Tech Stack (versions chốt)

| Layer      | Công nghệ            | Version        | Ghi chú                                           |
| ---------- | -------------------- | -------------- | ------------------------------------------------- |
| Framework  | Next.js (App Router) | **16.0.10**    | Server Components mặc định, `params` là `Promise` |
| Runtime UI | React                | **19.2.1**     |                                                   |
| Ngôn ngữ   | TypeScript           | 5.9            |                                                   |
| Database   | PostgreSQL           | 14+            | Cài trên Windows Server                           |
| ORM        | Prisma               | 5.22           | `@prisma/client`                                  |
| Auth       | NextAuth.js          | **5.0.0-beta** | Credentials + bcryptjs                            |
| UI Kit     | Ant Design           | **6.1**        | + `@ant-design/icons`                             |
| Styling    | Tailwind CSS         | **4**          | Dùng `@tailwindcss/postcss`                       |
| Excel      | ExcelJS              | 4.4            | + `file-saver`                                    |
| Chart      | Recharts             | 3.6            | Dashboard                                         |
| Date       | dayjs                | 1.11           | KHÔNG dùng `moment`/`date-fns`                    |
| QR         | qrcode.react         | 4.2            | Cho mã NV / máy                                   |

> ⚠️ **Đừng thêm thư viện mới khi đã có sẵn equivalent.** Vd: không thêm `axios` (dùng `fetch`); không thêm `formik`/`react-hook-form` (dùng Antd `Form`).

---

## 2. GLOSSARY — Thuật ngữ nghiệp vụ

| Thuật ngữ              | Tiếng Việt            | Giải thích cho AI                                                                                 |
| ---------------------- | --------------------- | ------------------------------------------------------------------------------------------------- |
| **Factory**            | Nhà máy               | 3 nhà máy: `NM1`, `NM2`, `NM3`. Mỗi NM có đặc thù chấm công khác nhau (xem 5.1)                   |
| **Kip**                | Kíp / Ca              | Đơn vị ca sản xuất, đánh số 1–10, thuộc 1 Factory. Khối hành chính KHÔNG có Kip                   |
| **Department**         | Phòng ban / Tổ        | Đơn vị tổ chức. Có `code` duy nhất (vd `PHC`, `2GT1`). Cờ `isKip` phân biệt khối SX vs hành chính |
| **Section**            | Bộ phận (ảo, chỉ NM2) | Group các Department cùng loại nhưng khác Kip. Vd `2GT1`, `2GT2` → Section `GT`                   |
| **AttendanceCode**     | Mã/Ký hiệu công       | `X` đi làm, `F` nghỉ phép, `Ô` ốm, `TS` thai sản... Có `factor` (hệ số công) và `category` (nhóm) |
| **Timesheet**          | Bảng chấm công ngày   | 1 record = 1 NV × 1 ngày × 1 mã công. Unique key `[employeeId, date]`                             |
| **TimesheetLock**      | Khóa sổ               | Cờ khóa theo `[departmentId, month, year]`. Khi locked thì TIMEKEEPER không sửa được              |
| **Extra Timesheet**    | Bảng làm thêm         | OT, công ngoài giờ — module riêng `/extra-timesheets`                                             |
| **Bravo**              | Phần mềm lương ngoài  | File Excel xuất ra phải đúng format Bravo đọc được                                                |
| **managedDepartments** | Phân quyền theo phòng | TIMEKEEPER chỉ thấy phòng ban có trong mảng này                                                   |

---

## 3. DATABASE SCHEMA — Core Entities

> Nguồn chuẩn: `prisma/schema.prisma`. Phần này chỉ là tóm tắt — luôn đọc file gốc khi sửa schema.

```
Factory (1) ─┬─ (n) Department ─┬─ (n) Employee ── (n) Timesheet ── (1) AttendanceCode
             │                  │                                        │
             └─ (n) Kip ────────┘                                        │
                                                                          │
                       TimesheetLock [departmentId, month, year]          │
                                                                          │
User ── (n:n) Department  (managedDepartments)        AttendanceCode danh mục
```

**Bảng chính:**

| Bảng             | Khóa độc nhất                 | Trường quan trọng                                                                                                    |
| ---------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `Factory`        | `code`                        | `name`, `code` (NM1/NM2/NM3)                                                                                         |
| `Kip`            | `[factoryId, number]`         | `number` (1–10), `name`                                                                                              |
| `Department`     | `code`                        | `code`, `isKip` (Bool), `factoryId`                                                                                  |
| `Employee`       | `employeeCode`                | `fullName`, `dob`, `gender`, `idCard`, `taxCode`, `bankAccount`, `departmentId` (req), `kipId` (null nếu hành chính) |
| `AttendanceCode` | `code`                        | `category`, `factor`, `color`, `order` (sort UI)                                                                     |
| `Timesheet`      | `[employeeId, date]`          | `attendanceCodeId`, `note`                                                                                           |
| `TimesheetLock`  | `[departmentId, month, year]` | `isLocked`                                                                                                           |
| `User`           | `username`                    | `passwordHash`, `role`, `managedDepartments[]`                                                                       |

**Module phụ (xem `prisma/schema.prisma` để chi tiết):**

- `ExtraTimesheet` — bảng làm thêm/OT
- `Evaluation` — đánh giá nhân viên
- `Salary*` — module tính lương (xem skills 01–05)
- `BravoData` — bảng import/đối soát với phần mềm Bravo

---

## 4. ROLES & PERMISSIONS

| Role         | Phạm vi                  | Có thể                                                 |
| ------------ | ------------------------ | ------------------------------------------------------ |
| `ADMIN`      | Toàn hệ thống            | Mọi quyền + **Backup DB** + quản lý User               |
| `HR_MANAGER` | Toàn hệ thống            | CRUD danh mục, khóa/mở `TimesheetLock`, xem mọi report |
| `TIMEKEEPER` | Chỉ `managedDepartments` | Chấm công + xem report của phòng được giao             |
| `LEADER`     | Toàn hệ thống            | **View-only** (Dashboard + report). KHÔNG được sửa     |
| `STAFF`      | Chỉ bản thân             | Xem bảng công cá nhân + sửa Extra Timesheet riêng      |

> Check role ở 2 chỗ: `src/middleware.ts` (route-level) và đầu mỗi API route (operation-level).

---

## 5. CORE BUSINESS LOGIC — Bắt buộc đọc kỹ

### 5.1. Logic "Ma trận" — 3 mô hình nhà máy

Đây là **chỗ sai nhất** khi code mới. Mỗi NM có UI filter khác nhau:

| Nhà máy | Mô hình              | UI Filter                                            | Backend query                                                       |
| ------- | -------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| **NM1** | Cơ bản               | Chỉ dropdown Phòng ban (ẩn dropdown Kíp)             | `where: { departmentId }`                                           |
| **NM3** | Exclusive (loại trừ) | Chọn Phòng ban **HOẶC** Kíp (chọn 1 thì xóa cái kia) | `where: { departmentId }` **OR** `where: { kipId: { in: kipIds } }` |
| **NM2** | Matrix (ma trận)     | Section gom nhóm + Multi-select Kíp                  | Resolve Section + Kíp → mảng `departmentId`                         |

**Chi tiết NM2 (quan trọng):**

- DB lưu chi tiết: `2GT1` = Tổ Ghép Thô kíp 1, `2GT2` = Tổ Ghép Thô kíp 2, ...
- UI gom lại: hiện ra Section "Tổ Ghép Thô" (code `GT`) + multi-select Kíp.
- Regex parse code: `^2([a-zA-Z]+)(\d+)$` → group 1 = section code (`GT`), group 2 = kíp number.
- Khi user chọn Section `GT` + Kíp `[1, 2]` → Frontend resolve thành `["2GT1", "2GT2"]` → query `departmentId: { in: [...] }`.
- Logic này ở [src/components/CommonFilter.tsx](src/components/CommonFilter.tsx).

### 5.2. Bảng mã chấm công (AttendanceCode)

| Nhóm             | Mã                                      | Factor              | Ý nghĩa                       |
| ---------------- | --------------------------------------- | ------------------- | ----------------------------- |
| Đi làm (full)    | `X`, `XD`, `CT`, `LĐ`, `XL`, `LE`, `LD` | 1.0                 | Đi làm bình thường / công tác |
| Đi làm (half)    | `X/2`                                   | 0.5                 | Nửa ngày                      |
| Nghỉ hưởng lương | `F`, `R`, `L`, `ĐC`                     | 1.0                 | Phép năm, lễ, ...             |
| Ốm / BHXH        | `Ô`, `CÔ`, `TS`, `DS`, `T`, `CL`        | 0 (BHXH tính riêng) | Ốm, thai sản, dưỡng sức       |
| Không lương      | `RO`                                    | 0                   | Nghỉ không lương              |
| Vô lý do         | `O`                                     | 0                   | Nghỉ không phép               |
| Thiên tai        | `B`                                     | tùy                 | Bão lụt                       |

**Ràng buộc UI:**

- Dropdown sort theo cột `order` của `AttendanceCode` → mã hay dùng (`X`, `XD`, `F`, `Ô`, `TS`...) lên đầu.
- Có nút **"Toàn bộ đi làm (X)"** ở `/timesheets/daily` để fill nhanh cột.

### 5.3. Lưu chấm công (Daily Timesheet)

Pattern bắt buộc trong `POST /api/timesheets`:

```ts
// 1. Check lock TRƯỚC khi mở transaction
const lock = await prisma.timesheetLock.findUnique({
  where: { departmentId_month_year: { departmentId, month, year } },
});
if (lock?.isLocked && session.user.role !== "ADMIN") {
  return NextResponse.json({ error: "Sổ đã khóa" }, { status: 403 });
}

// 2. Lọc bỏ record null
const valid = rows.filter((r) => r.attendanceCodeId);

// 3. Upsert trong transaction
await prisma.$transaction(
  valid.map((r) =>
    prisma.timesheet.upsert({
      where: { employeeId_date: { employeeId: r.employeeId, date: r.date } },
      create: { ...r },
      update: { attendanceCodeId: r.attendanceCodeId, note: r.note },
    }),
  ),
);
```

### 5.4. Export Excel (Monthly)

- Lib: `exceljs` (KHÔNG dùng `xlsx`).
- Cấu trúc cột: `STT | Mã NV | Họ Tên | [Ngày 1...31] | Tổng công | Ca 3 | Phép 100% | Ốm/BHXH | Không Lương | Vô lý do`.
- Tên sheet/header **động** theo filter: `"Bộ phận: Tổ Ghép Thô - Kíp 1, Kíp 2"`.
- Logic ở [src/app/timesheets/monthly/page.tsx](src/app/timesheets/monthly/page.tsx) và `src/app/api/reports/...`.

### 5.5. Backup Database

- Endpoint: `POST /api/system/backup` (chỉ ADMIN).
- Dùng `child_process.exec` gọi `pg_dump.exe` của PostgreSQL.
- ⚠️ **Pitfall xử lý chuỗi connection:**
  - Phải **cắt bỏ** query string `?schema=public` khỏi `DATABASE_URL` trước khi truyền vào `pg_dump`.
  - Absolute path `pg_dump.exe` phải bọc trong dấu ngoặc kép (vì Windows có space trong `Program Files`).

### 5.6. Module Tính Lương (Salary)

- Đang trong giai đoạn phát triển, schema + logic chi tiết xem skills `01-schema`, `02-calculator`, `03-api-conventions`, `04-ui-conventions`, `05-excel-export`.
- Input: Timesheet đã chốt + cấu hình hệ số lương + phụ cấp.
- Output: Bảng lương tháng → Excel format Bravo.

---

## 6. CẤU TRÚC THƯ MỤC & MODULE

### 6.1. Cây thư mục chính

```
phubai-hrm/
├── prisma/
│   ├── schema.prisma        # ⭐ Single source of truth cho DB
│   ├── migrations/          # KHÔNG được xóa
│   └── seed.ts              # Seed data ban đầu
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/             # REST endpoints (xem 6.2)
│   │   ├── (pages)/         # UI pages (xem 6.3)
│   │   └── layout.tsx       # Root layout
│   ├── components/
│   │   ├── AdminLayout.tsx       # ⭐ Shell + Sidebar + Đổi mật khẩu
│   │   ├── CommonFilter.tsx      # ⭐ Filter ma trận (logic 5.1)
│   │   └── SessionProviderWrapper.tsx
│   ├── lib/
│   │   └── prisma.ts        # ⭐ Prisma singleton — import từ đây
│   ├── auth.ts              # ⭐ NextAuth config (server)
│   ├── auth.config.ts       # ⭐ NextAuth shared config (edge-safe)
│   └── middleware.ts        # ⭐ Route protection
├── PROJECT_OVERVIEW.md      # ⭐ File này
├── CLAUDE.md (nếu có)       # Instruction cho Claude
└── .claude/skills/          # Skills hướng dẫn AI
```

### 6.2. API Routes (theo module)

| Đường dẫn                       | Module         | Operation chính             |
| ------------------------------- | -------------- | --------------------------- |
| `/api/auth/*`                   | NextAuth       | Login, session              |
| `/api/employees`                | Nhân viên      | CRUD, search                |
| `/api/departments`              | Phòng ban      | CRUD + tree                 |
| `/api/factories`                | Nhà máy        | CRUD                        |
| `/api/kips`                     | Kíp            | CRUD                        |
| `/api/attendance-codes`         | Mã công        | CRUD + reorder              |
| `/api/timesheets`               | Chấm công ngày | GET (filter), POST (upsert) |
| `/api/timesheets/lock`          | Khóa sổ        | POST lock/unlock            |
| `/api/extra-timesheets`         | Làm thêm/OT    | CRUD                        |
| `/api/overtime`                 | Tổng hợp OT    | GET report                  |
| `/api/evaluations`              | Đánh giá NV    | CRUD                        |
| `/api/reports/*`                | Báo cáo        | Export Excel                |
| `/api/statistics`, `/api/stats` | Dashboard      | Aggregate                   |
| `/api/bravo-data`               | Đối soát Bravo | Import + diff               |
| `/api/salary/*`                 | Tính lương     | (đang dev)                  |
| `/api/users`                    | Tài khoản      | CRUD (ADMIN only)           |
| `/api/admin/*`                  | Quản trị       | Backup, log                 |
| `/api/system/backup`            | Backup DB      | POST (pg_dump)              |
| `/api/dashboard`                | Dashboard data | GET                         |

### 6.3. UI Pages chính

| Route                                             | Mục đích                         | Role                             |
| ------------------------------------------------- | -------------------------------- | -------------------------------- |
| `/login`                                          | Đăng nhập                        | Public                           |
| `/register`                                       | Đăng ký (đang gate ở `/pending`) | Public                           |
| `/pending`                                        | Chờ admin duyệt                  | Authed nhưng chưa active         |
| `/dashboard`                                      | Tổng quan (Recharts)             | All                              |
| `/timesheets/daily`                               | ⭐ Chấm công ngày (core)         | TIMEKEEPER, HR_MANAGER, ADMIN    |
| `/timesheets/monthly`                             | ⭐ Tổng hợp tháng + Export       | HR_MANAGER, ADMIN, LEADER (view) |
| `/extra-timesheets`                               | OT / làm thêm                    | TIMEKEEPER, STAFF                |
| `/overtime`                                       | Báo cáo OT                       | HR_MANAGER                       |
| `/employees`                                      | Danh sách NV                     | HR_MANAGER, ADMIN                |
| `/departments`, `/factories`, `/attendance-codes` | Danh mục                         | HR_MANAGER, ADMIN                |
| `/evaluations`                                    | Đánh giá NV                      | HR_MANAGER                       |
| `/salary/*`                                       | Module lương (dev)               | HR_MANAGER, ADMIN                |
| `/bravo-data`                                     | Đối soát Bravo                   | HR_MANAGER                       |
| `/admin/*`                                        | Quản trị (user, backup)          | ADMIN                            |
| `/mobile`                                         | UI tối ưu mobile                 | All                              |
| `/help`                                           | Hướng dẫn sử dụng                | All                              |

---

## 7. CODING CONVENTIONS — Bắt buộc tuân thủ

### 7.1. Next.js App Router

- API route handler chuẩn Next.js 15+:
  ```ts
  export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> },
  ) {
    const { id } = await props.params; // ⚠️ phải await
  }
  ```
- UI có hook/state → `"use client"` ở dòng đầu file.
- Page server-side fetch → ưu tiên Server Component (không `use client`).

### 7.2. Prisma

- Import từ `src/lib/prisma.ts` (singleton). KHÔNG `new PrismaClient()` ở route khác.
- Multi-row update → `$transaction` hoặc `updateMany`.
- Tránh N+1 → dùng `include` / `select` rõ ràng.
- Filter theo array → `{ in: [...] }`.

### 7.3. API conventions

- Success: `return NextResponse.json(data)` (status 200 mặc định) hoặc `{ status: 201 }` cho create.
- Error: `return NextResponse.json({ error: "msg tiếng Việt" }, { status: 4xx/5xx })`.
- Check session ở đầu mọi route ghi (POST/PUT/PATCH/DELETE):
  ```ts
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!["ADMIN", "HR_MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  ```

### 7.4. Frontend

- Fetch: dùng `fetch()` thuần (không thêm axios).
- Error UX: `try/catch` + `message.error(...)` của Antd.
- Form: Antd `Form` + `Form.useForm()` — không thêm formik/react-hook-form.
- Date: dayjs (`dayjs().format("YYYY-MM-DD")`). Truyền ISO string giữa client/server.
- Table: Antd `Table` với `rowKey="id"` rõ ràng.

### 7.5. TypeScript

- Mọi payload API và state phức tạp đều phải có `interface` đặt cùng file (hoặc `src/types/` nếu dùng nhiều nơi).
- Tránh `any`; nếu chưa rõ shape thì dùng `unknown` + narrow.

### 7.6. UI/UX

- Toàn bộ text user-facing là **tiếng Việt có dấu**.
- Mobile-first cho `/timesheets/daily` và `/mobile` (TIMEKEEPER chấm trên điện thoại).
- Màu sắc bảng chấm công lấy từ `AttendanceCode.color` (đừng hardcode).

---

## 8. CHO AI — Quy tắc làm việc

| ✅ NÊN                                              | ❌ KHÔNG                                 |
| --------------------------------------------------- | ---------------------------------------- |
| Đọc `prisma/schema.prisma` trước khi viết query     | Đoán shape model                         |
| Đọc `CommonFilter.tsx` trước khi đụng tới filter NM | Code lại logic ma trận từ đầu            |
| Dùng `$transaction` cho multi-row                   | Loop `await` riêng lẻ                    |
| Check `TimesheetLock` trước khi ghi                 | Bỏ qua lock                              |
| Hỏi user trước khi xóa file/migration               | `rm -rf`, drop table                     |
| Update `PROJECT_OVERVIEW.md` sau feat mới           | Để doc lệch với code                     |
| Dùng lib đã có (dayjs, fetch, Antd Form)            | Thêm lib trùng chức năng                 |
| Trả lời tiếng Việt                                  | Trả lời tiếng Anh (trừ khi user yêu cầu) |

### Skills tham chiếu trong `.claude/skills/`

| Skill                                    | Khi dùng                                 |
| ---------------------------------------- | ---------------------------------------- |
| `00-project-context` → `05-excel-export` | Làm việc với module Tính Lương           |
| `api-test-generator`                     | Sau khi thêm/sửa API route               |
| `git-commit-convention`                  | Khi commit                               |
| `update-project-overview`                | Sau khi thêm tính năng → update file này |
| `protect-critical-files`                 | Trước khi xóa bất cứ thứ gì              |

---

## 9. ENVIRONMENT & DEPLOYMENT

- **Env vars chính** (trong `.env`):
  - `DATABASE_URL` — chuỗi PostgreSQL (có `?schema=public`)
  - `NEXTAUTH_SECRET` — secret cho JWT
  - `NEXTAUTH_URL` — base URL
- **Lệnh dev:** `pnpm dev` (hoặc `npm run dev`) → http://localhost:3000
- **Build prod:** `pnpm build && pnpm start`
- **Prisma:** `pnpm prisma migrate dev`, `pnpm prisma studio`, `pnpm prisma generate`
- **Deploy:** Windows Server, IIS reverse proxy hoặc PM2/Node.

---

_Cập nhật tài liệu này khi có thay đổi kiến trúc. Single source of truth — đừng để doc lệch code._
