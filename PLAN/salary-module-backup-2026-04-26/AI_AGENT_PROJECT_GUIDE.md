# AI Agent Project Guide

Tài liệu này là nguồn ngữ cảnh chuẩn dành cho mọi AI Agent làm việc với dự án `phubai-hrm`.

Mục tiêu:
- Giúp AI Agent mới đọc một lần là hiểu kiến trúc, mô hình dữ liệu và quy trình nghiệp vụ chính của hệ thống.
- Giảm việc suy đoán sai khi sửa code.
- Làm mốc chuẩn để cập nhật mỗi khi dự án có module mới, feature mới, thay đổi luồng xử lý hoặc thay đổi business rule.

Quy ước bảo trì:
- Khi thêm module mới, API mới, màn hình mới, bảng dữ liệu mới, role mới, hoặc thay đổi logic nghiệp vụ, phải cập nhật file này.
- Nếu code và tài liệu này khác nhau, code đang chạy thực tế trong repo là nguồn sự thật cao nhất; sau đó phải sửa lại tài liệu này cho khớp.
- Không xóa phần cũ nếu chưa chắc logic đã bị loại bỏ hoàn toàn; hãy ghi rõ "deprecated" hoặc "replaced by".

## 1. Tổng quan dự án

Đây là hệ thống quản lý nhân sự và chấm công nội bộ cho Công ty Cổ phần Sợi Phú Bài.

Phạm vi nghiệp vụ hiện tại trong codebase:
- Quản lý danh mục nhà máy, phòng ban, kíp, ký hiệu chấm công.
- Quản lý hồ sơ nhân sự.
- Quản lý người dùng và phân quyền.
- Chấm công hằng ngày.
- Tổng hợp công tháng.
- Xếp loại A/B/C theo tháng và tổng hợp năm.
- Theo dõi tình hình lao động và dashboard thống kê.
- Quản lý công tăng cường.
- Quản lý làm thêm giờ.
- Tính lương tháng.
- Quản lý tạm ứng, cấu hình lương, thông tin lương nhân viên, kết quả/thưởng tháng.
- Xuất Excel phục vụ báo cáo và BRAVO.
- Backup/restore cơ sở dữ liệu.

Hệ thống phục vụ mô hình:
- Đa nhà máy.
- Đa phòng ban/tổ.
- Đa kíp.
- Nhiều vai trò người dùng với quyền khác nhau.

## 2. Kiến trúc kỹ thuật

Stack chính:
- Next.js App Router
- TypeScript
- React
- Prisma ORM
- PostgreSQL
- NextAuth Credentials
- Ant Design
- Tailwind CSS
- ExcelJS
- Recharts
- dayjs

Cấu trúc triển khai:
- Đây là monolith web app.
- Frontend và backend API nằm chung trong một repo.
- UI gọi trực tiếp các API nội bộ trong `src/app/api`.
- Business logic quan trọng nằm một phần trong API route, một phần trong `src/lib`.

Các vị trí quan trọng:
- `src/app/*`: các trang giao diện.
- `src/app/api/*`: API route nội bộ.
- `src/components/*`: layout và component dùng chung.
- `src/lib/*`: utility và business logic tái sử dụng.
- `prisma/schema.prisma`: mô hình dữ liệu trung tâm.
- `src/auth.ts`, `src/auth.config.ts`, `src/middleware.ts`: xác thực và bảo vệ route.

## 3. Cấu trúc phân lớp thực tế

Luồng xử lý điển hình:
1. Người dùng thao tác trên màn hình trong `src/app/.../page.tsx`.
2. Trang gọi `fetch()` tới API nội bộ trong `src/app/api/.../route.ts`.
3. API kiểm tra session, role, quyền truy cập.
4. API đọc/ghi dữ liệu qua Prisma.
5. Với một số module phức tạp, API gọi logic dùng chung trong `src/lib`.
6. Kết quả trả về JSON hoặc file Excel/SQL.

Lưu ý:
- Không có lớp service tách riêng hoàn chỉnh cho toàn bộ hệ thống.
- Nhiều business rule hiện đang nằm trực tiếp ở page component hoặc API route.
- `CommonFilter` là component dùng chung nhưng đang gánh nhiều logic nghiệp vụ quan trọng của toàn bộ hệ thống chấm công.

## 4. Phân quyền và vai trò

Role trong hệ thống:
- `ADMIN`: toàn quyền hệ thống, quản trị người dùng, backup/restore, import, vượt khóa sổ.
- `HR_MANAGER`: quản lý nhân sự và nghiệp vụ nhân sự/lương, được dùng nhiều màn quản trị nhưng không có toàn bộ quyền như ADMIN.
- `TIMEKEEPER`: người chấm công, chỉ làm việc trên các phòng ban được gán.
- `LEADER`: chỉ xem dashboard, báo cáo, dữ liệu tổng hợp; không chỉnh sửa.
- `STAFF`: hiện là vai trò nhân viên thường, thiên về quyền xem và một số chức năng hẹp.

Phân quyền thực tế:
- Session lưu `role`, `username`, `fullName`, `managedDeptIds`.
- `TIMEKEEPER` và một phần `STAFF` bị giới hạn theo `managedDepartments`.
- Menu trên sidebar hiển thị theo role trong `src/components/AdminLayout.tsx`.
- Middleware chỉ chặn ở mức route tổng quát; quyền chi tiết vẫn phải kiểm tra lại ở API.

## 5. Mô hình dữ liệu nghiệp vụ

### 5.1. Tổ chức

`Factory`
- Đại diện cho nhà máy.
- Một nhà máy có nhiều phòng ban.
- Một nhà máy có nhiều kíp.

`Department`
- Đại diện cho phòng ban, tổ, bộ phận.
- Có `code`, `name`, `factoryId`, `isKip`.
- `isKip = true` thường dùng để chỉ bộ phận sản xuất theo kíp.

`Kip`
- Đại diện cho kíp làm việc.
- Gắn với nhà máy.
- Nhân viên có thể thuộc một kíp hoặc không thuộc kíp.

### 5.2. Nhân sự và người dùng

`Employee`
- Hồ sơ nhân sự trung tâm.
- Có mã nhân viên, họ tên, ngày sinh, giới tính, CCCD, MST, tài khoản ngân hàng, ngày vào làm...
- Bắt buộc thuộc một `Department`.
- Có thể thuộc `Kip`.
- Có trạng thái `isActive` để xác định còn làm việc hay không.

`User`
- Tài khoản đăng nhập hệ thống.
- Dùng `username` và `password` băm bằng bcrypt.
- Có `role`.
- Có thể thuộc một phòng ban qua `userDepartmentId`.
- Có quan hệ nhiều-nhiều với `Department` qua `managedDepartments` để giới hạn phạm vi quản lý/chấm công.

### 5.3. Chấm công

`AttendanceCode`
- Danh mục ký hiệu chấm công.
- Có `code`, `name`, `category`, `factor`, `color`, `description`.

`Timesheet`
- Một dòng chấm công theo ngày của một nhân viên.
- Unique theo `employeeId + date`.
- Lưu mã công và ghi chú.

`LockRule`, `LockRuleDepartment`
- Dùng để khóa sổ dữ liệu theo khoảng thời gian.
- Có thể khóa:
  - toàn hệ thống
  - theo nhà máy
  - theo một hoặc nhiều phòng ban

### 5.4. Đánh giá và công bổ sung

`MonthlyEvaluation`
- Xếp loại theo tháng cho nhân viên.
- Unique theo `employeeId + month + year`.

`ExtraTimesheet`
- Chấm công tăng cường nội bộ.
- Tách riêng với bảng chấm công chính.

`OvertimeRecord`
- Ghi nhận làm thêm giờ theo thời gian bắt đầu/kết thúc.
- Dùng để tính OT trong module lương.

### 5.5. Lương

`SalaryConfig`
- Cấu hình lương theo tháng/năm.
- Chứa các mức tối thiểu vùng, ngày công chuẩn, tỷ lệ bảo hiểm, đơn giá phụ cấp...

`EmployeeSalaryInfo`
- Lưu thông tin lương cá nhân theo thời gian hiệu lực.
- Hỗ trợ lịch sử thay đổi lương.

`MonthlyPerformanceBonus`
- Lưu hệ số kết quả công việc, hệ số sản xuất, công ca 3, thưởng đủ công, thưởng HC, thưởng ca 3.

`AdvancePayment`
- Quản lý tạm ứng lương theo tháng.

`MonthlySalary`
- Snapshot kết quả tính lương tháng.
- Có trạng thái `DRAFT`, `CONFIRMED`, `LOCKED`.

## 6. Các module nghiệp vụ hiện có

### 6.1. Danh mục nền

Bao gồm:
- Nhà máy
- Phòng ban
- Nhân viên
- Kíp
- Ký hiệu chấm công

Vai trò:
- Là dữ liệu nền cho chấm công, báo cáo, phân quyền, lương.
- Sai dữ liệu danh mục sẽ kéo theo sai ở hầu hết các module còn lại.

### 6.2. Quản lý người dùng và phân quyền

Bao gồm:
- Đăng nhập bằng credentials.
- Gán role.
- Gán danh sách phòng ban được quản lý.
- Đổi mật khẩu.
- Quản trị user bởi ADMIN.

Ý nghĩa nghiệp vụ:
- Quyết định ai được xem và ai được nhập/chỉnh sửa dữ liệu ở bộ phận nào.

### 6.3. Chấm công hằng ngày

Màn hình chính:
- `src/app/timesheets/daily/page.tsx`

API chính:
- `src/app/api/timesheets/daily/route.ts`

Mục tiêu:
- Chấm công theo ngày cho danh sách nhân viên của một hoặc nhiều phòng ban/kíp.
- Hỗ trợ thao tác nhanh để áp mã công hàng loạt.

Business rule quan trọng:
- Chỉ tải nhân viên `isActive = true`.
- Lưu theo từng ngày.
- Mỗi nhân viên mỗi ngày chỉ có một dòng chấm công.
- Nếu xóa mã công khỏi ô nhập thì backend xóa dòng chấm công tương ứng.
- Trước khi lưu phải kiểm tra khóa sổ.
- Nếu đang bị khóa và user không phải ADMIN thì chặn lưu.

### 6.4. Bộ lọc dùng chung cho chấm công/tổng hợp

Component:
- `src/components/CommonFilter.tsx`

Đây là phần quan trọng nhất của logic nghiệp vụ frontend.

Nhiệm vụ:
- Chọn ngày/tháng/năm.
- Chọn nhà máy.
- Chọn phòng ban hoặc tổ.
- Chọn kíp.
- Chuyển giá trị UI thành `realDepartmentIds` thật để API hiểu được.

Tại sao quan trọng:
- Nghiệp vụ thực tế của Phú Bài không đồng nhất hoàn toàn giữa các nhà máy.
- Người dùng chọn theo "cách hiểu nghiệp vụ", nhưng backend cần `departmentId` thật.

### 6.5. Tổng hợp chấm công tháng

Màn hình:
- `src/app/timesheets/monthly/page.tsx`

Mục tiêu:
- Hiển thị ma trận công của cả tháng cho từng nhân viên.
- Tổng hợp số công, ca 3, nghỉ hưởng lương, nghỉ BHXH, nghỉ không lương...
- Xuất Excel bảng công tháng.

Đặc điểm:
- Có thể xem theo phạm vi lọc hoặc tải toàn bộ.
- Có logic nhóm nhân viên theo nhà máy/phòng ban/kíp khi render và khi export Excel.

### 6.6. Dashboard và thống kê lao động

Màn hình:
- `src/app/dashboard/page.tsx`
- các trang con trong `src/app/dashboard/*`

Mục tiêu:
- Hiển thị tỷ lệ đi làm, nghỉ, chưa chấm.
- Thống kê theo nhà máy.
- Phân tích lý do vắng mặt.
- Theo dõi tình hình lao động theo phòng ban.

### 6.7. Xếp loại A/B/C

Màn hình:
- `src/app/evaluations/monthly/*`
- `src/app/evaluations/yearly/*`

Mục tiêu:
- Nhập xếp loại theo tháng.
- Tổng hợp theo năm.
- Cung cấp dữ liệu đầu vào cho module lương.

### 6.8. Công tăng cường

Màn hình:
- `src/app/extra-timesheets/daily/*`
- `src/app/extra-timesheets/monthly/*`

Mục tiêu:
- Ghi nhận công tăng cường nội bộ.
- Tách khỏi bảng công chuẩn.
- Không đồng nghĩa trực tiếp với OT trả lương.

### 6.9. Làm thêm giờ

Màn hình:
- `src/app/overtime/page.tsx`

Mục tiêu:
- Ghi nhận OT theo giờ thực tế.
- Dữ liệu này được dùng để tính lương OT trong module lương.

### 6.10. Module lương

Màn hình:
- `src/app/salary/calculate/page.tsx`
- `src/app/salary/performance/*`
- `src/app/salary/advance/*`
- `src/app/salary/employee-info/*`
- `src/app/salary/config/*`

API và logic cốt lõi:
- `src/app/api/salary/calculate/route.ts`
- `src/app/api/salary/monthly/route.ts`
- `src/lib/salary/calculator.ts`
- `src/lib/salary/attendance-counter.ts`

Mục tiêu:
- Cấu hình tham số tính lương theo tháng.
- Quản lý thông tin lương cá nhân.
- Nhập dữ liệu kết quả/thưởng tháng.
- Nhập tạm ứng.
- Tính và lưu bảng lương tháng.
- Duyệt bảng lương.
- Xuất Excel lương.

### 6.11. Xuất dữ liệu BRAVO

Màn hình:
- `src/app/bravo-data/page.tsx`

Mục tiêu:
- Xuất dữ liệu chấm công theo định dạng phục vụ hệ thống BRAVO.

### 6.12. Quản trị hệ thống

Bao gồm:
- Quản lý user.
- Khóa sổ.
- Import nhân viên.
- Backup database.
- Restore database.

## 7. Logic nghiệp vụ đặc thù theo nhà máy và kíp

Đây là phần AI Agent phải nắm chắc trước khi sửa `CommonFilter`, chấm công hoặc API tổng hợp.

### 7.1. Tư duy chung

Người dùng không luôn chọn dữ liệu theo `departmentId` thật trong database.

Thay vào đó:
- Có nơi chỉ chọn phòng ban.
- Có nơi chọn tổ rồi chọn thêm kíp.
- Có nơi chọn một tổ tổng quát nhưng thực tế database lại lưu thành nhiều department khác nhau theo từng kíp.

Do đó phải có bước "resolve" từ lựa chọn UI sang danh sách `realDepartmentIds`.

### 7.2. Nhà máy 1

Logic đơn giản nhất:
- Chọn phòng ban là đủ.
- Không cần logic ma trận phức tạp.
- Dữ liệu thường lọc trực tiếp theo `departmentId`.

### 7.3. Nhà máy 2

Đây là logic "matrix" quan trọng.

Đặc điểm:
- Database có thể lưu department theo kiểu mã gắn cả tổ và số kíp, ví dụ dạng `2GT1`, `2GT2`.
- UI không nên bắt người dùng chọn từng department chi tiết như trong DB.
- UI gom lại thành một tổ tổng quát, ví dụ "Tổ Ghép thô".
- Người dùng sau đó chọn thêm 1 hoặc nhiều kíp.

Hệ quả:
- Frontend phải map từ giá trị kiểu `SECTION:GT` + danh sách kíp sang các `departmentId` thật tương ứng.
- Đây là lý do `CommonFilter` có regex để giải mã mã phòng ban.

### 7.4. Nhà máy 3

Logic hỗn hợp giữa phòng ban và kíp:
- Có khối hành chính và khối sản xuất.
- Có thể cần lọc độc lập theo phòng ban hoặc theo kíp.
- Tùy dữ liệu thực tế mà chọn theo `departmentId` hoặc `kipId`.

### 7.5. Kết luận cho AI Agent

Khi sửa logic lọc dữ liệu:
- Không giả định "1 lựa chọn UI = 1 departmentId".
- Phải kiểm tra xem lựa chọn đó là `DEPT` hay `SECTION`.
- Phải hiểu rằng một lựa chọn trên giao diện có thể đại diện cho nhiều bản ghi department trong DB.

## 8. Quy tắc chấm công

### 8.1. Phân nhóm mã công

Theo tài liệu và code hiện tại, hệ thống đang dùng nhiều mã công như:
- Đi làm: `X`, `XD`, `CT`, `LĐ`, `XL`, `LE`, `LD`, hoặc trong một số màn hiện tại là `+`
- Nghỉ hưởng lương/được tính công: `F`, `R`, `L`, `ĐC`
- Nửa công: `X/2` hoặc một số chỗ còn thấy `1/2X`
- Nghỉ BHXH/ốm/thai sản: `Ô`, `CÔ`, `TS`, `DS`, `T`, `CL`
- Không lương: `RO`
- Vô lý do: `O`
- Bảo: `B`

Lưu ý rất quan trọng:
- Trong code hiện có dấu hiệu chưa đồng nhất hoàn toàn giữa các ký hiệu như `X` và `+`, hoặc `X/2` và `1/2X`.
- Khi sửa logic tổng hợp công, export Excel, thống kê hoặc tính lương, phải rà lại toàn bộ nơi dùng mã công để tránh lệch kết quả.

### 8.2. Nguyên tắc lưu

Khi lưu chấm công ngày:
- Có mã công thì tạo mới hoặc cập nhật.
- Không có mã công thì xóa bản ghi chấm công của ngày đó.
- Luôn thực hiện trong transaction.

### 8.3. Khóa sổ

Trước khi cho lưu:
- Xác định ngày đang nhập.
- Lấy thông tin nhân viên/phòng ban/nhà máy.
- Kiểm tra xem có `LockRule` nào đang áp dụng không.

Thứ tự phạm vi khóa:
- Toàn hệ thống.
- Theo nhà máy.
- Theo phòng ban.

Nếu bị khóa:
- Chỉ ADMIN được phép bỏ qua.
- Role khác bị trả lỗi 403.

## 9. Quy trình tổng hợp công tháng

Nguồn dữ liệu:
- `Timesheet`
- `AttendanceCode`
- `Employee`
- `Department`
- `Kip`
- `MonthlyEvaluation`

Luồng:
1. Người dùng chọn tháng và phạm vi lọc.
2. Frontend resolve thành `departmentId` thật.
3. API trả danh sách nhân viên cùng toàn bộ timesheet trong tháng.
4. Frontend dựng ma trận ngày 1..31.
5. Frontend cộng các nhóm công theo business rule.
6. Người dùng có thể export Excel.

Điểm cần cẩn thận:
- Nhân viên phải được nhóm đúng theo nhà máy/phòng ban/kíp khi hiển thị.
- Code mã công phải đồng nhất giữa màn hình và file Excel.

## 10. Quy trình tính lương tháng

Đây là chuỗi nghiệp vụ quan trọng nhất sau chấm công.

### 10.1. Đầu vào

Module lương lấy dữ liệu từ:
- `Employee`
- `EmployeeSalaryInfo`
- `SalaryConfig`
- `Timesheet`
- `OvertimeRecord`
- `MonthlyPerformanceBonus`
- `MonthlyEvaluation`
- `AdvancePayment`

### 10.2. Luồng tính lương hiện tại

Cho mỗi nhân viên:
1. Kiểm tra có cấu hình lương tháng tương ứng chưa.
2. Tìm thông tin lương cá nhân đang còn hiệu lực trong tháng.
3. Đếm ngày công, ngày Chủ nhật làm việc, ngày nghỉ hưởng lương và tổng phút OT.
4. Xác định nhân viên có phải lao động sản xuất theo kíp hay không thông qua `department.isKip`.
5. Tính lương thời gian dựa trên `baseSalary` và ngày công chuẩn.
6. Tính lương OT từ số phút OT.
7. Tính lương ngày nghỉ hưởng lương.
8. Tính tiền ăn Chủ nhật.
9. Tính phụ cấp ca 3 nếu là khối sản xuất.
10. Tính phần lương/kết quả công việc từ `MonthlyPerformanceBonus` kết hợp `MonthlyEvaluation`.
11. Cộng phụ cấp điện thoại/đi lại từ `EmployeeSalaryInfo`.
12. Tính tổng thu nhập.
13. Tính các khoản khấu trừ: BHXH, BHYT, BHTN, công đoàn, tạm ứng.
14. Tính thực nhận.
15. Upsert vào `MonthlySalary` với trạng thái `DRAFT`.

### 10.3. Duyệt lương

Sau khi tính:
- HR_MANAGER hoặc ADMIN có thể duyệt từng bản ghi hoặc duyệt hàng loạt.
- Bản ghi `CONFIRMED` hoặc `LOCKED` không bị tính đè ở luồng tính lương hiện tại.

### 10.4. Lưu ý rất quan trọng

Một số công thức hiện tại là business rule hard-code trong code:
- hệ số xếp loại A/B/C
- công thức tính OT
- khoản ăn Chủ nhật
- phụ cấp ca 3
- các tỷ lệ bảo hiểm

Nếu quy chế lương thay đổi:
- phải sửa code
- phải sửa tài liệu này
- phải kiểm tra lại export và bảng hiển thị

## 11. Dashboard và thống kê

Nguồn dữ liệu hiện tại:
- `Employee`
- `Timesheet`
- `AttendanceCode`
- `Department`
- `Factory`

Cách hoạt động:
- API `stats/daily` trả dữ liệu thô.
- Frontend tự phân loại thành:
  - đi làm
  - nghỉ
  - chưa chấm
- Frontend tiếp tục nhóm lý do nghỉ để vẽ biểu đồ.

Điểm cần lưu ý:
- Một số thống kê đang xử lý ở frontend thay vì backend.
- Nếu đổi quy tắc mã công, dashboard cũng phải cập nhật theo.

## 12. Xuất file và tích hợp ngoài

### 12.1. Excel bảng công

Được xuất trực tiếp từ frontend bằng ExcelJS.

Nội dung thường gồm:
- thông tin nhân viên
- mã công từng ngày
- các cột tổng hợp
- dòng nhóm theo bộ phận/kíp

### 12.2. Xuất BRAVO

Mục đích:
- phục vụ tích hợp hoặc import vào hệ thống BRAVO

### 12.3. Backup database

API:
- `src/app/api/system/backup/route.ts`

Cách hoạt động:
- Chỉ ADMIN được gọi.
- Chạy `pg_dump.exe`.
- Có xử lý cắt phần `?schema=public` khỏi `DATABASE_URL`.
- Trả về file `.sql`.

### 12.4. Restore database

Có route riêng cho restore.

Đây là tác vụ nhạy cảm:
- Chỉ ADMIN nên dùng.
- Mọi thay đổi logic route restore phải được review kỹ về an toàn dữ liệu.

## 13. Các file AI Agent nên đọc đầu tiên khi bắt đầu một task

Theo thứ tự ưu tiên:
1. `AI_AGENT_PROJECT_GUIDE.md`
2. `prisma/schema.prisma`
3. `src/components/AdminLayout.tsx`
4. `src/components/CommonFilter.tsx`
5. module đang sửa trong `src/app/...`
6. API tương ứng trong `src/app/api/...`
7. utility hoặc business logic liên quan trong `src/lib/...`

Nếu task liên quan lương:
- đọc thêm toàn bộ `src/lib/salary/*`
- đọc thêm các route `src/app/api/salary/*`

Nếu task liên quan chấm công:
- đọc `CommonFilter`
- đọc `timesheets/daily`
- đọc `timesheets/monthly`
- đọc `api/timesheets/daily`

## 14. Những điểm AI Agent phải đặc biệt cẩn thận

### 14.1. Không giả định dữ liệu tổ chức là đơn giản

Trong dự án này:
- một lựa chọn trên UI có thể map sang nhiều department thật
- cùng một nhà máy có thể có cách tổ chức dữ liệu khác nhà máy khác

### 14.2. Không giả định mã công đã đồng nhất hoàn toàn

Trước khi sửa:
- rà lại toàn bộ nơi đang dùng code đó
- kiểm tra cả UI, API, tổng hợp công, dashboard, lương, export Excel

### 14.3. Không sửa logic lương mà không kiểm tra tác động chuỗi

Một thay đổi nhỏ có thể ảnh hưởng:
- bảng lương tháng
- export Excel
- tổng thu nhập
- khấu trừ
- quyền duyệt

### 14.4. Không bỏ qua phân quyền ở API

Ẩn nút ở UI là chưa đủ.
API vẫn phải kiểm tra role và phạm vi dữ liệu.

### 14.5. Không quên cập nhật tài liệu này

Bất kỳ thay đổi nào dưới đây đều phải cập nhật:
- thêm module mới
- thêm page mới
- thêm API mới
- thêm bảng Prisma mới
- đổi công thức
- đổi quyền
- đổi luồng lọc
- đổi mã công

## 15. Danh sách module hiện diện trong repo tại thời điểm tạo tài liệu

Trang chính:
- `/`
- `/login`
- `/help`

Danh mục:
- `/factories`
- `/departments`
- `/employees`
- `/attendance-codes`

Chấm công:
- `/timesheets/daily`
- `/timesheets/daily-mobile`
- `/timesheets/monthly`

Đánh giá:
- `/evaluations/monthly`
- `/evaluations/yearly`

Dashboard và thống kê:
- `/dashboard`
- `/dashboard/departments`
- `/dashboard/statistics/employee`

Khối dữ liệu công bổ sung:
- `/extra-timesheets/daily`
- `/extra-timesheets/monthly`
- `/overtime`

Lương:
- `/salary/calculate`
- `/salary/performance`
- `/salary/advance`
- `/salary/employee-info`
- `/salary/config`

Khác:
- `/bravo-data`

Quản trị:
- `/admin/users`
- `/admin/lock-rules`
- `/admin/employees/import`

## 16. Nguồn sự thật khi có mâu thuẫn

Thứ tự ưu tiên:
1. Code đang chạy trong repo
2. Prisma schema
3. API route đang dùng thật
4. Tài liệu này
5. `PROJECT_OVERVIEW.md`

Lý do:
- `PROJECT_OVERVIEW.md` phản ánh ý đồ và quy ước rất tốt, nhưng có thể chậm cập nhật hơn code.
- Tài liệu này được tạo ra để nối giữa "ý đồ thiết kế" và "thực tế code đang chạy".

## 17. Hướng dẫn cập nhật tài liệu này khi có feature mới

Khi thêm hoặc sửa feature, cập nhật tối thiểu các phần sau:
- Mục "Tổng quan dự án" nếu feature đủ lớn.
- Mục "Các module nghiệp vụ hiện có".
- Mục "Mô hình dữ liệu nghiệp vụ" nếu có thêm bảng/cột/quan hệ quan trọng.
- Mục "Logic nghiệp vụ đặc thù" nếu đổi rule.
- Mục "Danh sách module hiện diện" nếu có page mới.
- Mục "Những điểm AI Agent phải đặc biệt cẩn thận" nếu có rủi ro mới.

Template cập nhật ngắn:
- Feature/module:
- Màn hình:
- API:
- Bảng dữ liệu:
- Role bị ảnh hưởng:
- Business rule mới:
- Rủi ro tương thích ngược:

## 18. Kết luận

Đây không phải project CRUD đơn giản.

Bản chất hệ thống là:
- HRM nội bộ
- chấm công đa nhà máy/đa kíp
- tổng hợp công
- đánh giá
- OT và công bổ sung
- tính lương theo dữ liệu vận hành thực tế
- có phân quyền theo phạm vi quản lý

AI Agent muốn làm việc an toàn với repo này phải luôn hiểu ba trục chính:
- trục tổ chức: nhà máy -> phòng ban/tổ -> kíp -> nhân viên
- trục nghiệp vụ chấm công: mã công -> timesheet -> tổng hợp công -> dashboard
- trục nghiệp vụ lương: công + OT + đánh giá + thưởng + tạm ứng + cấu hình -> bảng lương tháng
