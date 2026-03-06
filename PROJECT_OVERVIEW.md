# 🚀 PROJECT CONTEXT: PHÚ BÀI HRM & TIMEKEEPING SYSTEM

## 1. PROJECT OVERVIEW

Dự án là Hệ thống Quản lý Nhân sự và Chấm công (HRM & Timekeeping) cho Công ty Cổ phần Sợi Phú Bài (khoảng 650 nhân sự). Hệ thống chuyển đổi quy trình chấm công từ giấy sang số hóa, hỗ trợ quản lý đa nhà máy (3 nhà máy), đa ca kíp (10 kíp/nhà máy), thống kê vắng mặt, và xuất file báo cáo tính lương (Excel).

## 2. TECH STACK

- **Framework:** Next.js (App Router, v14/v16)
- **Language:** TypeScript
- **Database:** PostgreSQL (chạy trên Windows Server)
- **ORM:** Prisma
- **UI Library:** Ant Design (antd) + Tailwind CSS
- **Authentication:** NextAuth.js (v5) - Credentials Provider (Bcryptjs)
- **Utilities:** ExcelJS (xuất báo cáo), Recharts (vẽ biểu đồ Dashboard), dayjs (xử lý thời gian).

## 3. CORE DATABASE SCHEMA (Prisma)

Hệ thống xoay quanh các Entity chính và mối quan hệ sau:

- **Factory (Nhà máy):** NM1, NM2, NM3. (1 Factory có nhiều Department và nhiều Kip).
- **Kip (Ca/Kíp):** Định nghĩa từ Kíp 1 -> Kíp 10. Liên kết trực tiếp với Factory.
- **Department (Phòng ban/Tổ):** Có trường `code` (VD: `PHC`, `2GT1`), trường `isKip` (Boolean) để phân biệt khối hành chính và khối sản xuất. Liên kết với Factory.
- **Employee (Nhân viên):** Chứa các thông tin: Mã NV, Họ tên, Ngày sinh, Giới tính, CCCD, MST, STK... Liên kết Bắt buộc với `DepartmentId` và Tùy chọn với `KipId` (có thể null nếu làm hành chính).
- **AttendanceCode (Ký hiệu chấm công):** Định nghĩa các loại công (X, F, TS, Ô, RO, L...). Có các thuộc tính: `category` (nhóm chế độ), `factor` (hệ số), `color` (mã màu UI).
- **Timesheet (Chấm công hàng ngày):** Cấu trúc khóa độc nhất (Unique Constraint) là `[employeeId, date]`. Lưu trữ `attendanceCodeId` và `note`.
- **TimesheetLock (Khóa sổ):** Lưu trạng thái khóa theo `[departmentId, month, year]`.
- **User (Tài khoản):** Liên kết Many-to-Many với Department qua `managedDepartments` (Phân quyền người chấm công chỉ được thấy phòng ban được giao).

## 4. ROLE & PERMISSIONS (NextAuth)

- `ADMIN`: Toàn quyền. Có thêm quyền Backup Database.
- `HR_MANAGER`: Quản lý nhân sự, được sửa danh mục, khóa/mở sổ chấm công.
- `TIMEKEEPER`: Người chấm công. Chỉ được xem và chấm công cho các `Department` được Admin gán trong mảng `managedDepartments`.
- `LEADER`: Ban lãnh đạo. Chỉ xem (View-only), xem Dashboard, không được sửa đổi dữ liệu.

## 5. CÁC QUY TẮC NGHIỆP VỤ CỐT LÕI (CORE BUSINESS LOGIC - RẤT QUAN TRỌNG)

### 5.1. Logic "Ma trận" Phân loại Nhà máy (Department vs Kip)

Đây là logic phức tạp nhất ở Frontend khi filter để chấm công, chia làm 3 trường hợp dựa theo đặc thù nhà máy:

- **Nhà máy 1 (Cơ bản):** Chỉ chọn Phòng ban. Không sử dụng dropdown chọn Kíp. Filter Employee theo `departmentId`.
- **Nhà máy 3 (Exclusive - Loại trừ):** Có 2 khối là Hành chính và Sản xuất.
  - _Quy tắc UI:_ Nếu chọn dropdown "Phòng ban" thì xóa/ẩn dropdown "Kíp" và ngược lại.
  - _Backend Query:_ Filter độc lập bằng `departmentId` HOẶC `kipIds`.
- **Nhà máy 2 (Matrix - Ma trận):** Dữ liệu Database lưu chi tiết từng tổ theo kíp (VD: `2GT1` là Tổ Ghép thô kíp 1, `2GT2` là Tổ Ghép thô kíp 2).
  - _Quy tắc UI:_ UI Gom nhóm các phòng lại (Bỏ đuôi Kíp). Dropdown "Tổ/Bộ phận" chỉ hiện chữ "Tổ Ghép thô" (Mã SECTION: `GT`). Dropdown "Kíp" cho phép Multi-select (Kíp 1, Kíp 2).
  - _Backend Resolution:_ Dùng Regex `^2([a-zA-Z]+)(\d+)$` để map ngược lại. Nếu User chọn "Tổ GT" và "Kíp 1, Kíp 2", logic phải tìm trong DB các Department có code là `2GT1` và `2GT2`, sau đó lấy mảng `departmentId` gửi lên API.

### 5.2. Logic Tính Công & Ký hiệu chấm công

- **Full-day (Cộng 1):** Các mã `X`, `XD`, `CT`, `LĐ`, `XL`, `LE`, `LD` (Đi làm) và `F`, `R`, `L`, `ĐC` (Nghỉ 100% lương).
- **Half-day (Cộng 0.5):** Mã `X/2`.
- **Phân loại theo nhóm:** Cần group các mã nghỉ Ôm/BHXH (`Ô`, `CÔ`, `TS`, `DS`, `T`, `CL`), Không lương (`RO`), Vô lý do (`O`), Bão (`B`).
- **Ràng buộc UI:** Các mã hay dùng (`X`, `XD`, `F`, `Ô`, `TS`...) phải được sort lên đầu trong dropdown chấm công. Có nút "Thao tác nhanh" để đánh dấu "Toàn bộ đi làm (X)".

### 5.3. Logic Lưu Chấm Công (Save Daily Timesheet)

- Sử dụng cú pháp `prisma.timesheet.upsert` lồng trong `prisma.$transaction`.
- Chỉ gửi lên Server những Record có `attendanceCodeId` hợp lệ (Bỏ qua null/undefined).
- Trước khi lưu, phải check xem phòng ban đó ở Tháng/Năm đó đã bị `TimesheetLock` hay chưa. Nếu `isLocked === true`, ném lỗi 403 (Trừ khi là ADMIN mở khóa).

### 5.4. Export Excel (Monthly Timesheet)

- Sử dụng `exceljs`. Cấu trúc file:
  - Cột trái: STT, Mã NV, Họ Tên.
  - Cột giữa: Các ngày trong tháng (1 -> 28/29/30/31). Hiển thị ký hiệu mã công.
  - Cột phải (Tổng hợp): Tổng số công, Số ca 3, Phép 100%, Ốm/BHXH, Không Lương, Vô lý do.
- Tên bộ phận/Kíp trên file Excel phải được sinh động dựa theo chuỗi Filter (VD: "Bộ phận: Tổ Ghép Thô - Kíp 1, Kíp 2").

### 5.5. System Backup Logic

- API `/api/system/backup` gọi thực thi lệnh OS thông qua `child_process.exec`.
- Dùng `pg_dump.exe` của PostgreSQL.
- _Lưu ý xử lý chuỗi:_ Cắt bỏ tham số `?schema=public` khỏi `DATABASE_URL` trước khi truyền vào `pg_dump`, sử dụng absolute path bọc trong dấu ngoặc kép cho `pg_dump.exe` trên môi trường Windows Server.

## 6. PROJECT DIRECTORY STRUCTURE (Key Files)

- `prisma/schema.prisma`: Schema database.
- `src/app/api/...`: Chứa các REST API (GET, POST, PATCH/PUT, DELETE). Phải luôn xử lý `params` như một `Promise<{id: string}>` (chuẩn Next.js 15+).
- `src/auth.ts` & `src/auth.config.ts`: Chứa cấu hình NextAuth, Middleware check Role.
- `src/app/timesheets/daily/page.tsx`: Core UI Chấm công hàng ngày (Chứa toàn bộ Logic Ma trận).
- `src/app/timesheets/monthly/page.tsx`: Core UI Tổng hợp & Xuất Excel.
- `src/app/dashboard/page.tsx`: Thống kê tổng quan (Recharts).
- `src/components/AdminLayout.tsx`: Shell UI, Sidebar navigation.

## 7. CODING CONVENTIONS FOR AI

1.  **Next.js App Router:** Luôn dùng `use client` cho các component có UI state/hooks. API Route dùng chuẩn `export async function GET(request: Request, props: { params: Promise<{id: string}> })`.
2.  **Prisma:** Hạn chế N+1 query bằng cách dùng `include` hợp lý. Data update nhiều dòng dùng `updateMany` hoặc `$transaction`.
3.  **Error Handling:** API luôn trả về `NextResponse.json({ error: "..." }, { status: ... })`. Frontend luôn bọc try/catch và dùng `message.error()` của Antd.
4.  **Typescript:** Định nghĩa `Interface` rõ ràng cho payload API và state của Table (e.g., `Employee`, `TimesheetRow`).

---

_End of Context Document._
