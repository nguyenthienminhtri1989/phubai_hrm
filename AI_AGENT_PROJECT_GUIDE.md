# AI Agent Project Guide

Tai lieu nay la nguon ngu canh chuan danh cho moi AI Agent lam viec voi du an `phubai-hrm`.

Muc tieu:

- Giup AI Agent moi doc mot lan la nam duoc kien truc, mo hinh du lieu va quy trinh nghiep vu chinh.
- Giam viec sua code dua tren suy doan.
- Lam moc chuan de cap nhat moi khi co module moi, feature moi, thay doi business rule hoac thay doi schema.

Quy uoc bao tri:

- Moi thay doi quan trong ve module, API, schema, role, luong xu ly, menu, bao cao hoac business rule deu phai cap nhat file nay.
- Neu code va tai lieu nay khac nhau, code dang chay trong repo la nguon su that cao nhat.
- Khi mot module bi tam dung hoac bi go bo, phai ghi ro trang thai cua module do trong tai lieu nay.

## 1. Tong quan du an

Day la he thong quan ly nhan su va cham cong noi bo cho Cong ty Co phan Soi Phu Bai.

Pham vi nghiep vu hien dang co trong codebase:

- Quan ly nha may, phong ban, kip, ky hieu cham cong.
- Quan ly ho so nhan su.
- Quan ly user va phan quyen.
- Cham cong hang ngay.
- Tong hop cong thang.
- Xep loai A/B/C theo thang va tong hop nam.
- Dashboard va thong ke tinh hinh lao dong.
- Cong tang cuong.
- Lam them gio.
- Xuat Excel bang cong va du lieu BRAVO.
- Khoa so.
- Backup/restore database.

Trang thai module luong:

- Module luong da duoc go bo khoi codebase hien tai.
- Khong con UI, API, business logic hoac bang Prisma cho luong trong trang thai hien hanh.
- Neu co task lien quan den luong, xem do la pham vi phan tich/thiet ke/xay moi, khong phai sua mot module dang chay.

## 2. Kien truc ky thuat

Stack chinh:

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

Cach to chuc:

- Day la monolith web app.
- Frontend va backend API nam chung trong mot repo.
- UI goi truc tiep cac API noi bo trong `src/app/api`.
- Business logic nam mot phan trong page, mot phan trong API route, mot phan trong `src/lib`.

Vi tri quan trong:

- `src/app/*`: cac trang giao dien
- `src/app/api/*`: API route
- `src/components/*`: layout va component dung chung
- `src/lib/*`: utility va business logic tai su dung
- `prisma/schema.prisma`: schema trung tam
- `src/auth.ts`, `src/auth.config.ts`, `src/middleware.ts`: auth va route protection

## 3. Phan quyen

Role hien co:

- `ADMIN`
- `HR_MANAGER`
- `TIMEKEEPER`
- `LEADER`
- `STAFF`

Y nghia thuc te:

- `ADMIN`: toan quyen he thong, user, import, backup/restore, vuot khoa so.
- `HR_MANAGER`: quan ly nhan su va cac nghiep vu van hanh cho HR.
- `TIMEKEEPER`: cham cong theo cac phong ban duoc giao.
- `LEADER`: chu yeu xem dashboard, bao cao va du lieu tong hop.
- `STAFF`: vai tro hep, nghieng ve xem du lieu.

Session hien dang luu cac truong quan trong:

- `role`
- `username`
- `fullName`
- `managedDeptIds`

Luu y:

- An nut o UI khong du.
- API van phai kiem tra role va pham vi du lieu.

## 4. Mo hinh du lieu nghiep vu

### 4.1. To chuc

`Factory`

- Dai dien cho nha may.

`Department`

- Dai dien cho phong ban, to, bo phan.
- Co `code`, `name`, `factoryId`, `isKip`.

`Kip`

- Dai dien cho kip lam viec.
- Gan voi nha may.

### 4.2. Nhan su va user

`Employee`

- Ho so nhan su trung tam.
- Bat buoc thuoc mot `Department`.
- Co the thuoc `Kip`.
- Co `isActive` de biet con lam viec hay khong.

`User`

- Tai khoan dang nhap.
- Co `role`.
- Co the duoc gan nhieu phong ban qua `managedDepartments`.

### 4.3. Cham cong

`AttendanceCode`

- Danh muc ky hieu cham cong.

`Timesheet`

- Mot dong cham cong theo ngay cua mot nhan vien.
- Unique theo `employeeId + date`.

`LockRule`, `LockRuleDepartment`

- Khoa du lieu theo khoang thoi gian.
- Co the khoa toan he thong, theo nha may, hoac theo phong ban.

### 4.4. Danh gia va du lieu cong mo rong

`MonthlyEvaluation`

- Xep loai theo thang.

`ExtraTimesheet`

- Cong tang cuong noi bo.

`OvertimeRecord`

- Lam them gio theo moc thoi gian thuc te.

## 5. Cac module nghiep vu hien co

### 5.1. Danh muc nen

Bao gom:

- Nha may
- Phong ban
- Nhan vien
- Kip
- Ky hieu cham cong

Day la du lieu goc cho he thong.

### 5.2. Quan ly user va phan quyen

Bao gom:

- Dang nhap
- Doi mat khau
- Gan role
- Gan phong ban duoc quan ly
- Quan tri user cho ADMIN

### 5.3. Cham cong hang ngay

Trang chinh:

- `src/app/timesheets/daily/page.tsx`

API chinh:

- `src/app/api/timesheets/daily/route.ts`

Business rule chinh:

- Chi lay nhan vien `isActive = true`.
- Moi nhan vien moi ngay chi co mot dong cham cong.
- Neu xoa ma cong thi backend xoa dong timesheet tuong ung.
- Truoc khi luu phai kiem tra khoa so.
- Neu bi khoa thi chi `ADMIN` duoc vuot qua.

### 5.4. Bo loc dung chung

Component:

- `src/components/CommonFilter.tsx`

Day la diem rat quan trong.

No phai:

- chon ngay/thang/nam
- chon nha may
- chon phong ban hoac to
- chon kip
- chuyen lua chon giao dien thanh `realDepartmentIds` de backend hieu duoc

### 5.5. Tong hop cong thang

Trang chinh:

- `src/app/timesheets/monthly/page.tsx`

Muc tieu:

- Hien ma tran cong theo thang
- Tong hop cac nhom cong
- Xuat Excel bang cong

### 5.6. Dashboard va thong ke

Trang chinh:

- `src/app/dashboard/page.tsx`
- cac trang con trong `src/app/dashboard/*`

Muc tieu:

- Theo doi ti le di lam, nghi, chua cham
- Theo doi theo nha may
- Phan tich ly do vang mat

### 5.7. Xep loai A/B/C

Trang:

- `src/app/evaluations/monthly/*`
- `src/app/evaluations/yearly/*`

Muc tieu:

- Nhap ket qua theo thang
- Tong hop theo nam

### 5.8. Cong tang cuong

Trang:

- `src/app/extra-timesheets/daily/*`
- `src/app/extra-timesheets/monthly/*`

### 5.9. Lam them gio

Trang:

- `src/app/overtime/page.tsx`

Muc tieu:

- Ghi nhan OT theo gio thuc te

### 5.10. Xuat BRAVO

Trang:

- `src/app/bravo-data/page.tsx`

### 5.11. Quan tri he thong

Bao gom:

- User
- Khoa so
- Import nhan vien
- Backup/restore

## 6. Logic nghiep vu dac thu theo nha may va kip

AI Agent phai nam chac phan nay truoc khi sua bo loc hoac logic cham cong.

### 6.1. Nguyen tac chung

Nguoi dung khong luon chon du lieu theo `departmentId` that trong database.

Can co buoc resolve tu lua chon UI sang `realDepartmentIds`.

### 6.2. Nha may 1

Logic don gian:

- Chon phong ban la du

### 6.3. Nha may 2

Day la logic matrix quan trong.

Dac diem:

- Database co the luu theo ma department gan ca to va so kip, vi du `2GT1`, `2GT2`
- UI gom thanh to tong quat
- Sau do nguoi dung chon them mot hoac nhieu kip

He qua:

- Frontend phai map tu `SECTION:*` + danh sach kip sang danh sach `departmentId` that

### 6.4. Nha may 3

Logic hon hop:

- co khoi hanh chinh
- co khoi san xuat
- co the loc theo phong ban hoac theo kip tuy truong hop

### 6.5. Ket luan

Khi sua bo loc:

- Khong duoc gia dinh `1 lua chon UI = 1 departmentId`
- Phai xac dinh day la `DEPT` hay `SECTION`
- Phai kiem tra logic map nguoc tu giao dien ve DB

## 7. Quy tac cham cong

### 7.1. Nhom ma cong

Code hien tai dang su dung nhieu ma cong nhu:

- Di lam: `X`, `XD`, `CT`, `LD`, `XL`, `LE`, `LĐ`, hoac mot so cho dang la `+`
- Nghi huong luong/duoc tinh cong: `F`, `R`, `L`, `ĐC`
- Nua cong: `X/2` hoac mot so cho con thay `1/2X`
- BHXH/om/thai san: `Ô`, `CÔ`, `TS`, `DS`, `T`, `CL`
- Khong luong: `RO`
- Vo ly do: `O`
- Bao: `B`

Luu y rat quan trong:

- Code ma cong hien co dau hieu chua dong nhat hoan toan giua cac man.
- Moi thay doi ma cong phai kiem tra lai UI, API, tong hop cong, dashboard va export.

### 7.2. Nguyen tac luu

Khi luu cham cong ngay:

- Co ma cong thi tao moi hoac cap nhat
- Khong co ma cong thi xoa dong timesheet cua ngay do
- Luu trong transaction

### 7.3. Khoa so

Truoc khi luu:

- Xac dinh ngay
- Xac dinh nhan vien, phong ban, nha may
- Kiem tra `LockRule`

Pham vi khoa:

- toan he thong
- theo nha may
- theo phong ban

Neu bi khoa:

- `ADMIN` duoc vuot qua
- role khac bi chan

## 8. Quy trinh tong hop cong thang

Nguon du lieu:

- `Timesheet`
- `AttendanceCode`
- `Employee`
- `Department`
- `Kip`
- `MonthlyEvaluation`

Luong xu ly:

1. Nguoi dung chon thang va pham vi loc
2. Frontend resolve thanh `departmentId` that
3. API tra danh sach nhan vien va timesheet trong thang
4. Frontend dung ma tran ngay
5. Frontend tong hop so cong theo business rule
6. Nguoi dung co the xuat Excel

## 9. Dashboard va thong ke

Nguon du lieu:

- `Employee`
- `Timesheet`
- `AttendanceCode`
- `Department`
- `Factory`

Cach hoat dong:

- API tra du lieu tho
- Frontend tu phan loai thanh di lam, nghi, chua cham
- Frontend nhom ly do vang mat de ve bieu do

## 10. Xuat file va tich hop ngoai

### 10.1. Excel bang cong

Xuat bang Excel tu du lieu tong hop cong thang.

### 10.2. BRAVO

Xuat du lieu phuc vu he thong BRAVO.

### 10.3. Backup database

API:

- `src/app/api/system/backup/route.ts`

Chi `ADMIN` duoc dung.

### 10.4. Restore database

La tac vu nhay cam.

- Chi `ADMIN` nen dung
- Moi thay doi logic restore phai review ky

## 11. Cac file AI Agent nen doc dau tien

Theo thu tu uu tien:

1. `AI_AGENT_PROJECT_GUIDE.md`
2. `prisma/schema.prisma`
3. `src/components/AdminLayout.tsx`
4. `src/components/CommonFilter.tsx`
5. module dang sua trong `src/app/...`
6. API tuong ung trong `src/app/api/...`
7. utility lien quan trong `src/lib/...`

Neu task lien quan cham cong:

- doc `CommonFilter`
- doc `timesheets/daily`
- doc `timesheets/monthly`
- doc `api/timesheets/daily`

## 12. Nhung diem AI Agent phai can than

### 12.1. Khong gia dinh du lieu to chuc la don gian

Mot lua chon tren UI co the map sang nhieu `departmentId` that.

### 12.2. Khong gia dinh ma cong da dong nhat hoan toan

Phai ra soat ca UI va backend truoc khi doi logic tong hop.

### 12.3. Module luong dang o trang thai cho thiet ke lai

Neu co yeu cau ve luong:

- xem do la pham vi moi
- khong khoi phuc ngam code cu
- thong nhat lai yeu cau nghiep vu truoc khi viet code

### 12.4. Khong bo qua phan quyen o API

An nut o UI la chua du.

### 12.5. Khong quen cap nhat tai lieu nay

Can cap nhat khi:

- them module
- them page
- them API
- doi schema
- doi luong loc
- doi ma cong
- doi role
- doi business rule

## 13. Danh sach module hien dien trong repo

Trang chinh:

- `/`
- `/login`
- `/help`

Danh muc:

- `/factories`
- `/departments`
- `/employees`
- `/attendance-codes`

Cham cong:

- `/timesheets/daily`
- `/timesheets/daily-mobile`
- `/timesheets/monthly`

Danh gia:

- `/evaluations/monthly`
- `/evaluations/yearly`

Dashboard va thong ke:

- `/dashboard`
- `/dashboard/departments`
- `/dashboard/statistics/employee`

Cong mo rong:

- `/extra-timesheets/daily`
- `/extra-timesheets/monthly`
- `/overtime`

Khac:

- `/bravo-data`

Quan tri:

- `/admin/users`
- `/admin/lock-rules`
- `/admin/employees/import`

## 14. Nguon su that khi co mau thuan

Thu tu uu tien:

1. Code dang chay trong repo
2. Prisma schema
3. API route dang duoc dung that
4. Tai lieu nay
5. `PROJECT_OVERVIEW.md`

## 15. Ket luan

Day khong phai CRUD don gian.

Ba truc nghiep vu AI Agent phai nam:

- truc to chuc: nha may -> phong ban/to -> kip -> nhan vien
- truc cham cong: ma cong -> timesheet -> tong hop cong -> dashboard
- truc van hanh: phan quyen -> khoa so -> bao cao -> backup/restore
