# PATCH SPEC: BỔ SUNG CHỌN PHÒNG BAN KHI ĐĂNG KÝ

# Áp dụng SAU KHI đã chạy SPEC_USER_REGISTRATION.md

# Chỉ liệt kê những gì cần thêm/sửa — không làm lại những gì đã có

---

## 1. SCHEMA — thêm 1 trường vào model `User`

Mở `prisma/schema.prisma`, tìm model `User`, thêm trường sau vào **cạnh `userDepartmentId`**:

```prisma
registeredKipId  Int?   // Kíp user tự khai khi đăng ký (dùng để gán managedDepartments lúc duyệt)
```

Chạy migration:

```bash
npx prisma migrate dev --name add_registered_kip_id
npx prisma generate
```

---

## 2. API DEPARTMENTS + KIPS — bỏ check auth

Trang `/register` là public nên cần gọi được 2 API này mà không cần đăng nhập.

Mở **`src/app/api/departments/route.ts`** và **`src/app/api/kips/route.ts`**, tìm hàm `GET`, **xóa hoặc comment** phần kiểm tra session/role nếu có. Chỉ áp dụng cho method GET, các method POST/PATCH/DELETE giữ nguyên check auth.

---

## 3. TRANG ĐĂNG KÝ — thêm 3 ô chọn NM/PB/Kíp

Mở `src/app/register/page.tsx`, bổ sung vào form hiện có (đặt **sau ô Mã nhân viên**, trước nút submit):

### 3.1 Thêm state

```ts
const [factories, setFactories] = useState<{ id: number; name: string }[]>([]);
const [departments, setDepartments] = useState<
  { id: number; name: string; isKip: boolean; factory?: { id: number } }[]
>([]);
const [kips, setKips] = useState<
  { id: number; name: string; factoryId: number }[]
>([]);
const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(null);
const [selectedDeptIsKip, setSelectedDeptIsKip] = useState(false);
```

### 3.2 Fetch khi mount

```ts
useEffect(() => {
  Promise.all([fetch("/api/departments"), fetch("/api/kips")])
    .then(([dRes, kRes]) => Promise.all([dRes.json(), kRes.json()]))
    .then(([depts, kips]) => {
      // Lấy danh sách factory từ departments
      const facs = Array.from(
        new Map(
          depts
            .filter((d: any) => d.factory)
            .map((d: any) => [d.factory.id, d.factory]),
        ).values(),
      );
      setFactories(facs as any);
      setDepartments(depts);
      setKips(kips);
    });
}, []);
```

### 3.3 Thêm vào JSX form (sau Form.Item mã nhân viên)

```tsx
<Divider orientation="left" style={{ fontSize: 13 }}>Thông tin công tác</Divider>

<Form.Item name="factoryId" label="Nhà máy" rules={[{ required: true, message: "Vui lòng chọn nhà máy" }]}>
  <Select
    placeholder="Chọn nhà máy"
    options={factories.map(f => ({ value: f.id, label: f.name }))}
    onChange={(val) => {
      setSelectedFactoryId(val);
      setSelectedDeptIsKip(false);
      form.setFieldsValue({ departmentId: undefined, kipId: undefined });
    }}
  />
</Form.Item>

<Form.Item name="departmentId" label="Phòng ban / Tổ" rules={[{ required: true, message: "Vui lòng chọn phòng ban" }]}>
  <Select
    placeholder="Chọn phòng ban"
    disabled={!selectedFactoryId}
    options={departments
      .filter(d => d.factory?.id === selectedFactoryId)
      .map(d => ({ value: d.id, label: d.name }))}
    onChange={(val) => {
      const dept = departments.find(d => d.id === val);
      setSelectedDeptIsKip(dept?.isKip || false);
      form.setFieldsValue({ kipId: undefined });
    }}
  />
</Form.Item>

{/* Chỉ hiện khi phòng ban có isKip = true */}
{selectedDeptIsKip && (
  <Form.Item name="kipId" label="Kíp">
    <Select
      placeholder="Chọn kíp (nếu có)"
      allowClear
      options={kips
        .filter(k => k.factoryId === selectedFactoryId)
        .map(k => ({ value: k.id, label: k.name }))}
    />
  </Form.Item>
)}
```

### 3.4 Cập nhật body submit — thêm 2 trường mới

```ts
// Trong hàm onFinish, thêm vào body:
body: JSON.stringify({
  // ... các trường cũ giữ nguyên ...
  departmentId: values.departmentId,
  kipId: values.kipId || null,
});
```

---

## 4. API REGISTER — lưu thêm departmentId và kipId

Mở `src/app/api/auth/register/route.ts`, cập nhật:

### 4.1 Parse thêm 2 trường từ body

```ts
const { fullName, username, password, employeeCode, departmentId, kipId } =
  await request.json();
```

### 4.2 Thêm validate departmentId bắt buộc

```ts
if (!fullName || !username || !password || !departmentId) {
  return NextResponse.json(
    { error: "Thiếu thông tin bắt buộc" },
    { status: 400 },
  );
}
// Kiểm tra departmentId hợp lệ
const dept = await prisma.department.findUnique({
  where: { id: Number(departmentId) },
});
if (!dept) {
  return NextResponse.json(
    { error: "Phòng ban không hợp lệ" },
    { status: 400 },
  );
}
```

### 4.3 Thêm vào data khi create user

```ts
await prisma.user.create({
  data: {
    // ... các trường cũ giữ nguyên ...
    userDepartmentId: Number(departmentId),
    registeredKipId: kipId ? Number(kipId) : null,
  },
});
```

---

## 5. API APPROVE — tự động gán managedDepartments khi duyệt

Mở `src/app/api/admin/users/approve/route.ts`, **thay thế** logic `updateMany` hiện tại bằng:

```ts
// Lấy thông tin từng user để biết họ khai phòng ban nào
const users = await prisma.user.findMany({
  where: { id: { in: userIds }, status: "PENDING" },
});

// Duyệt từng user riêng lẻ để gán managedDepartments
await Promise.all(
  users.map((user) =>
    prisma.user.update({
      where: { id: user.id },
      data: {
        status: "ACTIVE",
        // Gán phòng ban user đã khai vào managedDepartments
        ...(user.userDepartmentId
          ? {
              managedDepartments: {
                connect: [{ id: user.userDepartmentId }],
              },
            }
          : {}),
      },
    }),
  ),
);
```

> **Lý do dùng `update` từng cái thay vì `updateMany`:** `updateMany` không hỗ trợ cập nhật quan hệ many-to-many (`managedDepartments`), chỉ `update` mới dùng được `connect`.

---

## 6. TAB CHỜ DUYỆT — thêm cột Phòng ban

Mở `src/app/admin/users/page.tsx`, tìm phần định nghĩa columns của tab "Chờ duyệt", thêm cột sau vào **trước cột Ngày đăng ký**:

```ts
{
  title: "Phòng ban đăng ký",
  dataIndex: ["userDepartment", "name"],
  key: "userDepartment",
  render: (_: any, record: any) => record.userDepartment?.name || <span style={{ color: "#ccc" }}>Chưa chọn</span>,
},
```

Đảm bảo API GET users đã `include: { userDepartment: true }` — **đã có sẵn trong `route.ts` hiện tại**, không cần sửa thêm.

---

## 7. CHECKLIST PATCH NÀY

- [ ] Trường `registeredKipId` đã thêm vào schema + migration chạy OK
- [ ] API GET `/api/departments` và `/api/kips` không còn yêu cầu auth
- [ ] Form đăng ký hiển thị đủ 3 ô NM → PB → Kíp (cascade đúng)
- [ ] Kíp chỉ hiện khi phòng ban có `isKip = true`
- [ ] API register lưu được `userDepartmentId` và `registeredKipId`
- [ ] API approve gán `managedDepartments` đúng khi duyệt
- [ ] Tab chờ duyệt hiển thị cột "Phòng ban đăng ký"
- [ ] User STAFF sau khi duyệt vào `CommonFilter` thấy đúng phòng ban của mình

---

_End of Patch Spec._
