# SPEC: TRANG XEM CHẤM CÔNG THÁNG (MOBILE)

# Dành cho Claude Code — Đọc toàn bộ trước khi viết bất kỳ dòng code nào

---

## 1. TỔNG QUAN

**Mục tiêu:** Xây dựng một trang mới, tối ưu hoàn toàn cho màn hình điện thoại, cho phép xem dữ liệu chấm công tháng của từng nhân viên dưới dạng lịch trực quan.

**Tính năng:** Chỉ xem (read-only). Không có thêm / sửa / xóa bất kỳ dữ liệu nào.

**File cần tạo:** `src/app/mobile/timesheet/page.tsx`

**Đăng ký vào Sidebar:** Thêm vào group **"MOBILE"** trong `src/components/AdminLayout.tsx`.

---

## 2. ĐĂNG KÝ SIDEBAR (AdminLayout.tsx)

Mở file `src/components/AdminLayout.tsx`, tìm mảng `menuItems` (hoặc cấu trúc tương tự định nghĩa menu sidebar).

Thêm một group mới tên **"MOBILE"** (nếu chưa có), bên trong có item:

```ts
{
  key: "mobile-timesheet",
  icon: <MobileOutlined />, // import từ @ant-design/icons
  label: "Chấm công tháng (Mobile)",
  path: "/mobile/timesheet",
}
```

> **Lưu ý:** Chỉ thêm group "MOBILE" nếu chưa tồn tại. Không xóa hoặc sửa bất kỳ group/item nào khác trong menu.

---

## 3. LUỒNG UX — 3 MÀN HÌNH (STATES)

Trang này có **3 trạng thái hiển thị** (không phải 3 route khác nhau, dùng React state để chuyển):

```
[SCREEN 1: Bộ lọc] → chọn xong → [SCREEN 2: Danh sách NV] → chọn người → [SCREEN 3: Lịch tháng]
                                          ↑ nút "← Back"                        ↑ nút "← Back"
```

---

## 4. SCREEN 1 — BỘ LỌC

### Mô tả

Màn hình đầu tiên khi vào trang. Cho phép người dùng chọn điều kiện lọc.

### Các ô lọc

Sử dụng component **`CommonFilter`** đã có tại `src/components/CommonFilter.tsx` với prop:

- `dateMode="month"` — chọn tháng/năm
- `onFilterChange={handleFilterChange}` — callback nhận `FilterResult`

> `CommonFilter` đã xử lý toàn bộ logic ma trận NM1/NM2/NM3, không cần viết lại.

### Nút hành động

- Nút **"Xem danh sách"** (primary, full-width) — disabled nếu chưa chọn đủ điều kiện (chưa có `realDepartmentIds`)
- Khi nhấn → chuyển sang Screen 2

### Layout gợi ý

```
┌─────────────────────────────┐
│  📋 Xem chấm công tháng     │
│─────────────────────────────│
│  [CommonFilter component]   │
│  - Tháng/Năm                │
│  - Nhà máy                  │
│  - Phòng ban                │
│  - Kíp (nếu có)             │
│─────────────────────────────│
│  [ Xem danh sách →  ]       │
└─────────────────────────────┘
```

---

## 5. SCREEN 2 — DANH SÁCH NHÂN VIÊN

### Mô tả

Hiển thị danh sách nhân viên thỏa mãn điều kiện lọc. Người dùng tap vào tên → chuyển sang Screen 3.

### Fetch data

Gọi API giống hệt trang desktop `monthly/page.tsx`:

```
GET /api/timesheets/monthly?month={m}&year={y}&departmentId={ids}&kipIds={ids}&factoryId={id}
```

Response trả về mảng `MonthlyEmployeeData[]` (đã có interface, copy từ `monthly/page.tsx`).

### Hiển thị

Mỗi nhân viên render dạng **Card ngang** (không phải list text thuần):

```
┌──────────────────────────────────────────────┐
│  👤  Nguyễn Văn A                      [  >] │
│      NV001 · Tổ Ghép thô · Kíp 1            │
└──────────────────────────────────────────────┘
```

Các thông tin hiển thị trong card:

- **Họ tên** (font đậm)
- **Mã NV** · **Tên phòng ban** · **Tên kíp** (nếu có)
- Icon mũi tên `>` bên phải

### Gom nhóm theo phòng ban

Giữ nguyên logic `groupedDataSource` từ trang desktop: chèn dòng tiêu đề nhóm (tên phòng ban/kíp) trước mỗi nhóm nhân viên.

Dòng tiêu đề nhóm render dạng **section header** nền nhạt, chữ in hoa, không thể tap.

### Nút Back

Header có nút **"← Bộ lọc"** để quay về Screen 1 (reset về state filter, không mất giá trị filter đã chọn).

### Trạng thái loading / empty

- Loading: hiển thị Skeleton cards (antd Skeleton)
- Không có NV: hiển thị Empty state (antd Empty)

---

## 6. SCREEN 3 — LỊCH CHẤM CÔNG CÁ NHÂN

### Mô tả

Hiển thị lịch tháng dạng grid 7 cột (theo tuần thật), với ký hiệu và màu chấm công của nhân viên đã chọn.

### Header

```
┌─────────────────────────────────────────┐
│  ←   Nguyễn Văn A                  [×] │
│      NV001 · Tổ Ghép thô · Kíp 1       │
│  ◀  Tháng 05/2025  ▶                   │
└─────────────────────────────────────────┘
```

- Nút `←` hoặc `×`: Quay về Screen 2 (danh sách)
- Nút `◀` / `▶`: Chuyển tháng trước/sau. Khi đổi tháng → fetch lại data cho người đó với tháng mới

### Grid lịch

- 7 cột cố định theo thứ: **T2 | T3 | T4 | T5 | T6 | T7 | CN**
- Mỗi hàng = 1 tuần
- Các ô trước ngày 1 và sau ngày cuối tháng: để trống (placeholder)

Mỗi ô ngày trong lịch:

```
┌──────┐
│  15  │   ← số ngày (nhỏ, màu nhạt)
│  X   │   ← mã chấm công (lớn, đậm, màu theo attendanceCode.color)
└──────┘
```

Quy tắc màu:

- Dùng `attendanceCode.color` từ API để tô nền hoặc màu chữ của ký hiệu
- Ngày Chủ nhật (cột CN): số ngày màu đỏ
- Ô chưa có dữ liệu: để trống, nền xám nhạt
- Ngày hôm nay (nếu trong tháng đang xem): viền highlight

### Swipe chuyển tháng

Hỗ trợ **swipe trái/phải** trên vùng lịch để chuyển tháng (dùng touch events: `onTouchStart` / `onTouchEnd`, tính delta X, nếu > 50px thì chuyển tháng).

### Thanh tổng hợp (Summary Bar)

Đặt **bên dưới lịch**, hiển thị các chỉ số tổng hợp theo hàng ngang dạng pill/badge:

| Chỉ số      | Mã tính                                               | Hiển thị          |
| ----------- | ----------------------------------------------------- | ----------------- |
| Tổng công   | `X, XD, CT, LĐ, XL, LE, LD` (×1) + `X/2, 1/2X` (×0.5) | 🟢 **22.5** công  |
| Ca 3        | `XD, LD`                                              | 🌙 **6** ca 3     |
| Phép 100%   | `F, R, L`                                             | 📋 **2** phép     |
| Ốm/BHXH     | `Ô, CÔ, TS, DS, T, CL`                                | 🏥 **1** ốm       |
| Không lương | `RO`                                                  | ❌ **0** K.lương  |
| Vô lý do    | `O`                                                   | ⚠️ **0** vô lý do |

> Các chỉ số bằng 0 vẫn hiển thị nhưng màu nhạt hơn.

### Xếp loại

Nếu `employee.classification` có giá trị (A/B/C), hiển thị badge xếp loại nổi bật bên cạnh tên nhân viên ở header.

---

## 7. INTERFACE & TYPES

Copy các interface sau từ `src/app/timesheets/monthly/page.tsx` vào file mới:

```ts
interface AttendanceCode {
  id: number;
  code: string;
  name: string;
  color: string;
}

interface MonthlyEmployeeData {
  id: number;
  code: string;
  fullName: string;
  department?: { name: string; factory?: { name: string } };
  kip?: { name: string };
  timesheets: { date: string; attendanceCode: AttendanceCode }[];
  classification?: string | null;
}
```

---

## 8. STATE MANAGEMENT

```ts
// Screen navigation
type ScreenState = "filter" | "list" | "calendar";
const [screen, setScreen] = useState<ScreenState>("filter");

// Filter
const [currentFilter, setCurrentFilter] = useState<FilterResult | null>(null);

// Employee list
const [employees, setEmployees] = useState<MonthlyEmployeeData[]>([]);
const [loadingList, setLoadingList] = useState(false);

// Selected employee & calendar
const [selectedEmployee, setSelectedEmployee] =
  useState<MonthlyEmployeeData | null>(null);
const [calendarMonth, setCalendarMonth] = useState<dayjs.Dayjs>(dayjs());
const [loadingCalendar, setLoadingCalendar] = useState(false);
```

Khi người dùng chuyển tháng ở Screen 3, fetch lại data **chỉ cho nhân viên đó** với tháng mới:

```
GET /api/timesheets/monthly?month={m}&year={y}&departmentId={emp.department.id}
```

Sau đó filter client-side theo `employeeId`.

---

## 9. STYLING GUIDELINES

- **Không dùng Ant Design Table** ở bất kỳ đâu trong trang này.
- Dùng **Tailwind CSS** cho layout và spacing.
- Dùng các component Antd đơn giản: `Skeleton`, `Empty`, `Badge`, `Tag`, `Spin`.
- Font size tối thiểu: `14px` cho body, `12px` cho label phụ.
- Touch target tối thiểu: `44px` height cho mỗi card/row có thể tap.
- Màu nền trang: `#f5f5f5` (xám nhạt) để tạo depth giữa card và background.
- Max-width toàn trang: `480px`, căn giữa — vẫn dùng được trên desktop nhưng layout mobile-first.

---

## 10. PHÂN QUYỀN

- Trang này dùng chung phân quyền của hệ thống (NextAuth session).
- Role `TIMEKEEPER`: chỉ thấy nhân viên thuộc `managedDepartments` của mình (backend đã xử lý, không cần thêm logic ở frontend).
- Role `LEADER`, `HR_MANAGER`, `ADMIN`: xem được tất cả.
- Không có nút sửa/xóa/khóa ở bất kỳ đâu.

---

## 11. CHECKLIST TRƯỚC KHI HOÀN THÀNH

- [ ] File `src/app/mobile/timesheet/page.tsx` đã tạo
- [ ] Group "MOBILE" và item menu đã thêm vào `AdminLayout.tsx`
- [ ] Screen 1 (filter) hoạt động với `CommonFilter`
- [ ] Screen 2 (danh sách) fetch API đúng, hiển thị card + group header
- [ ] Screen 3 (lịch) grid 7 cột đúng thứ trong tuần, màu theo `attendanceCode.color`
- [ ] Swipe trái/phải chuyển tháng hoạt động
- [ ] Summary bar tính đúng công theo bảng mã ở mục 6
- [ ] Nút Back từ Screen 3 → Screen 2 và Screen 2 → Screen 1 hoạt động
- [ ] Loading state (Skeleton) và Empty state hiển thị đúng chỗ
- [ ] Không có bất kỳ thao tác ghi dữ liệu nào (chỉ GET)

---

_End of Spec._
