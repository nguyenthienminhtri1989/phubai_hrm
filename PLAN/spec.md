# SPEC: TÍNH NĂNG THÔNG BÁO (WEB + MOBILE)

# Dành cho Claude Code — Đọc toàn bộ trước khi viết bất kỳ dòng code nào

---

## 1. TỔNG QUAN

**Mục tiêu:** Phòng nhân sự đăng thông báo nội bộ, toàn bộ nhân viên vào xem. Có giao diện web (desktop) và mobile riêng biệt, dùng chung API.

**Phân quyền:**

- `ADMIN`, `HR_MANAGER`: xem + đăng + xóa thông báo
- Tất cả role còn lại (`TIMEKEEPER`, `LEADER`, `STAFF`): chỉ xem

**Phạm vi:** Tất cả user đã đăng nhập đều thấy tất cả thông báo — không lọc theo nhà máy/phòng ban.

**Files cần tạo/sửa:**

| File                                        | Hành động                        |
| ------------------------------------------- | -------------------------------- |
| `prisma/schema.prisma`                      | Thêm model `Announcement`        |
| `src/app/api/announcements/route.ts`        | GET (danh sách) + POST (tạo mới) |
| `src/app/api/announcements/[id]/route.ts`   | DELETE (xóa)                     |
| `src/app/api/announcements/upload/route.ts` | POST upload ảnh                  |
| `src/app/announcements/page.tsx`            | Giao diện web                    |
| `src/app/mobile/announcements/page.tsx`     | Giao diện mobile                 |
| `src/components/AdminLayout.tsx`            | Thêm menu item vào sidebar       |

---

## 2. SCHEMA — thêm model `Announcement`

Thêm vào `prisma/schema.prisma`:

```prisma
model Announcement {
  id        Int      @id @default(autoincrement())
  title     String                        // Tiêu đề thông báo
  content   String                        // Nội dung (text thuần)
  imageUrl  String?                       // Đường dẫn ảnh đính kèm (nullable)
  authorId  Int                           // ID người đăng
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Thêm relation ngược vào model `User` hiện có:

```prisma
model User {
  // ... các trường hiện có ...
  announcements Announcement[]
}
```

Chạy migration:

```bash
npx prisma migrate dev --name add_announcement
npx prisma generate
```

---

## 3. THƯ MỤC LƯU ẢNH

Tạo thư mục trên máy chủ (nếu chưa có):

```
public/uploads/announcements/
```

Ảnh upload lên sẽ được lưu tại đây, truy cập qua URL:

```
/uploads/announcements/{filename}
```

> **Lưu ý backup:** Nhớ backup thư mục `public/uploads/` cùng với backup database định kỳ.

---

## 4. API

### 4.1 `GET /api/announcements` — Danh sách thông báo

- Không yêu cầu role đặc biệt, chỉ cần đăng nhập
- Trả về mảng thông báo, sắp xếp mới nhất lên đầu (`orderBy: { createdAt: "desc" }`)
- Include thông tin author: `{ select: { fullName: true, role: true } }`
- Hỗ trợ phân trang đơn giản: query param `?page=1&limit=20`

```ts
// Response shape
[
  {
    id: 1,
    title: "Thông báo nghỉ lễ 30/4",
    content: "Công ty thông báo...",
    imageUrl: "/uploads/announcements/abc123.jpg",
    createdAt: "2026-04-25T08:00:00.000Z",
    author: { fullName: "Nguyễn Thị HR", role: "HR_MANAGER" },
  },
];
```

### 4.2 `POST /api/announcements` — Đăng thông báo mới

- Chỉ `ADMIN` hoặc `HR_MANAGER` mới được gọi, trả về 403 nếu không đủ quyền
- Body: `{ title, content, imageUrl? }`
- `authorId` lấy từ session, không nhận từ client

```ts
// Validate
if (!title || title.trim().length < 2) → 400
if (!content || content.trim().length < 5) → 400

// Create
await prisma.announcement.create({
  data: { title, content, imageUrl: imageUrl || null, authorId: session.user.id }
});
```

### 4.3 `DELETE /api/announcements/[id]` — Xóa thông báo

- Chỉ `ADMIN` hoặc `HR_MANAGER`
- Nếu thông báo có `imageUrl` → xóa file ảnh trên disk trước khi xóa record:

```ts
import fs from "fs";
import path from "path";

if (announcement.imageUrl) {
  const filePath = path.join(process.cwd(), "public", announcement.imageUrl);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
await prisma.announcement.delete({ where: { id } });
```

### 4.4 `POST /api/announcements/upload` — Upload ảnh

- Chỉ `ADMIN` hoặc `HR_MANAGER`
- Nhận `FormData` với field `file`
- Giới hạn: chỉ chấp nhận `image/jpeg`, `image/png`, `image/webp`, tối đa **5MB**
- Tạo tên file unique bằng timestamp + random string
- Lưu vào `public/uploads/announcements/`
- Trả về `{ url: "/uploads/announcements/{filename}" }`

```ts
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  // Check auth
  const session = await auth();
  if (!["ADMIN", "HR_MANAGER"].includes(session?.user?.role || "")) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file)
    return NextResponse.json({ error: "Không có file" }, { status: 400 });

  // Validate type và size
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Chỉ chấp nhận JPG, PNG, WEBP" },
      { status: 400 },
    );
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Ảnh tối đa 5MB" }, { status: 400 });
  }

  const ext = file.type.split("/")[1];
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const savePath = path.join(
    process.cwd(),
    "public/uploads/announcements",
    filename,
  );

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(savePath, buffer);

  return NextResponse.json({ url: `/uploads/announcements/${filename}` });
}
```

---

## 5. GIAO DIỆN WEB (`/announcements`)

### 5.1 Layout tổng thể

Dùng `AdminLayout` như các trang desktop khác. Chia 2 khu vực:

```
┌─────────────────────────────────────────────────┐
│  THÔNG BÁO NỘI BỘ          [+ Đăng thông báo]  │  ← nút chỉ hiện với ADMIN/HR_MANAGER
├─────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────┐  │
│  │ 📢 Thông báo nghỉ lễ 30/4                │  │
│  │ HR Manager · 25/04/2026 08:30            │  │
│  │                                           │  │
│  │ Công ty thông báo toàn thể CBCNV...      │  │
│  │ [ảnh nếu có]                              │  │
│  │                                    [Xóa] │  │  ← nút Xóa chỉ hiện với ADMIN/HR_MANAGER
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │ 📢 Thông báo tăng ca tháng 5             │  │
│  │ ...                                       │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 5.2 Modal đăng thông báo

Khi nhấn **"+ Đăng thông báo"** → mở `Modal` của Ant Design:

```
┌──────────────────────────────────┐
│  Đăng thông báo mới              │
├──────────────────────────────────┤
│  Tiêu đề *                       │
│  [_____________________________] │
│                                  │
│  Nội dung *                      │
│  [_____________________________] │
│  [_____________________________] │
│  [_____________________________] │
│  (textarea, tối thiểu 3 dòng)    │
│                                  │
│  Đính kèm ảnh (không bắt buộc)   │
│  [  Chọn ảnh  ] preview ảnh      │
│  JPG/PNG/WEBP, tối đa 5MB        │
│                                  │
│  [Hủy]          [Đăng thông báo] │
└──────────────────────────────────┘
```

**Flow upload ảnh:**

1. User chọn file → hiển thị preview ngay (dùng `URL.createObjectURL`)
2. Khi nhấn "Đăng thông báo" → upload ảnh trước (`POST /api/announcements/upload`)
3. Nhận `url` từ response → gửi kèm vào `POST /api/announcements`
4. Đóng modal, reload danh sách

### 5.3 Xác nhận xóa

Khi nhấn "Xóa" → dùng `Modal.confirm` của Ant Design:

```
"Bạn có chắc muốn xóa thông báo này không? Hành động này không thể hoàn tác."
[Hủy]  [Xóa]
```

---

## 6. GIAO DIỆN MOBILE (`/mobile/announcements`)

### 6.1 Layout

Max-width `480px`, căn giữa, mobile-first. Không dùng `AdminLayout`.

```
┌─────────────────────────────┐
│  ← Thông báo nội bộ         │
├─────────────────────────────┤
│  ┌─────────────────────────┐│
│  │ 📢 Thông báo nghỉ lễ   ││
│  │ 25/04/2026 · 08:30     ││
│  │ HR Manager             ││
│  │                        ││
│  │ Công ty thông báo...   ││
│  │ [ảnh nếu có, full width]││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │ ...                    ││
│  └─────────────────────────┘│
└─────────────────────────────┘
```

- Mỗi thông báo là 1 Card full-width, bo tròn, shadow nhẹ
- Ảnh đính kèm hiển thị full-width bên dưới nội dung, bo góc
- **Không có nút đăng/xóa** trên giao diện mobile — chỉ xem
- Nút `←` quay về `/mobile`
- Infinite scroll hoặc nút "Xem thêm" nếu có nhiều thông báo

### 6.2 Thêm vào trang chủ mobile

Mở `src/app/mobile/page.tsx`, thêm vào mảng `MOBILE_FEATURES`:

```ts
{
  key: "announcements",
  label: "Thông báo",
  description: "Thông báo nội bộ",
  icon: "📢",
  href: "/mobile/announcements",
  color: "#f5222d",  // đỏ
}
```

---

## 7. ĐĂNG KÝ SIDEBAR (AdminLayout.tsx)

Thêm item vào menu sidebar, đặt vào group phù hợp (hoặc tạo group mới "TIỆN ÍCH" nếu chưa có):

```ts
{
  key: "announcements",
  icon: <NotificationOutlined />,  // import từ @ant-design/icons
  label: "Thông báo",
  path: "/announcements",
}
```

---

## 8. STYLING GUIDELINES

- Card thông báo: nền trắng, border-left `4px solid #f5222d` để nhận diện
- Tiêu đề: font đậm, size 16px
- Meta (tác giả + thời gian): màu nhạt `#888`, size 12px, dùng `dayjs` format `"HH:mm · DD/MM/YYYY"`
- Ảnh: `object-fit: cover`, max-height `400px` trên web, full-width trên mobile
- Empty state: dùng `<Empty description="Chưa có thông báo nào" />` của Ant Design

---

## 9. CHECKLIST TRƯỚC KHI HOÀN THÀNH

### Database & API

- [ ] Model `Announcement` đã thêm vào schema + migration chạy OK
- [ ] Thư mục `public/uploads/announcements/` đã tạo
- [ ] `GET /api/announcements` trả về đúng, sắp xếp mới nhất lên đầu
- [ ] `POST /api/announcements` chỉ cho ADMIN/HR_MANAGER
- [ ] `DELETE /api/announcements/[id]` xóa cả file ảnh trên disk
- [ ] `POST /api/announcements/upload` validate đúng type và size

### Giao diện Web

- [ ] Danh sách thông báo hiển thị đúng
- [ ] Nút "Đăng thông báo" chỉ hiện với ADMIN/HR_MANAGER
- [ ] Modal đăng có preview ảnh trước khi submit
- [ ] Flow upload ảnh → đăng thông báo hoạt động đúng thứ tự
- [ ] Nút Xóa có confirm dialog, chỉ hiện với ADMIN/HR_MANAGER
- [ ] Menu sidebar đã có item "Thông báo"

### Giao diện Mobile

- [ ] Trang `/mobile/announcements` hiển thị đúng
- [ ] Ảnh hiển thị full-width
- [ ] Card "Thông báo" đã thêm vào trang chủ mobile (`/mobile`)
- [ ] Không có nút đăng/xóa trên mobile

### Phân quyền

- [ ] STAFF/TIMEKEEPER/LEADER chỉ xem, không thấy nút đăng/xóa
- [ ] API trả về 403 nếu không đủ quyền khi POST/DELETE

---

_End of Spec._
