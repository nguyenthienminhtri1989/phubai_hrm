# Hướng Dẫn Deploy PHUBAI-HRM

Tài liệu này dùng cho mỗi lần phát triển tính năng mới trong repo `phubai-hrm`.
Luồng chuẩn hiện tại là: sửa code trên máy dev -> kiểm tra build -> commit/push lên GitHub -> vào VPS Production pull code -> chạy migration/build -> reload đúng tiến trình PM2 của HRM.

Không restart toàn bộ PM2 vì trên VPS còn nhiều phần mềm khác chạy song song.

## 1. Thông tin hiện tại của app

- Repo local dev: `D:\DU-AN-PHAN-MEM\PHUBAI-HRM\phubai-hrm`
- Remote GitHub: `https://github.com/nguyenthienminhtri1989/phubai_hrm.git`
- Nhánh chính đang dùng: `master`
- Framework: Next.js App Router
- Database: PostgreSQL qua Prisma
- PM2 process của HRM: `phubai-hrm`
- Port production theo `ecosystem.config.js`: `3000`
- PM2 config trong repo: `ecosystem.config.js`

Các biến môi trường quan trọng trên Production:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public"
NEXTAUTH_URL="https://ten-mien-hrm"
NEXTAUTH_SECRET="chuoi-secret-du-manh"
AUTH_SECRET="chuoi-secret-du-manh"
AUTH_TRUST_HOST=true
```

## 2. Việc cần làm trên máy dev

Đứng tại repo HRM:

```bash
cd /d/DU-AN-PHAN-MEM/PHUBAI-HRM/phubai-hrm
```

Kiểm tra trạng thái code trước khi sửa:

```bash
git status --short
git branch --show-current
```

Sau khi phát triển xong tính năng, chạy các bước kiểm tra tối thiểu:

```bash
npx prisma generate
npm run build
```

Nếu có sửa API quan trọng hoặc có test shell tương ứng trong `tests/`, chạy thêm test liên quan. Ví dụ:

```bash
bash tests/test-timesheets-daily-order.sh
```

Kiểm tra file thay đổi trước khi commit:

```bash
git status --short
git diff --check
git diff
```

Commit và push lên nhánh chính:

```bash
git add .
git commit -m "feat: mo ta ngan gon tinh nang"
git push origin master
```

Ghi chú:

- Nếu chỉ sửa tài liệu, không bắt buộc chạy `npm run build`.
- Nếu có thay đổi `prisma/schema.prisma`, phải có migration mới trong `prisma/migrations/` trước khi deploy Production.
- Không chạy `npx prisma migrate dev` trên Production. Lệnh này chỉ dùng ở môi trường dev.

## 3. Việc cần làm trên VPS Production

SSH vào VPS, sau đó vào thư mục app HRM trên Production.
Thay đường dẫn bên dưới bằng đúng thư mục thực tế trên VPS nếu khác.

```bash
cd /home/deploy/apps/phubai-hrm
```

Kiểm tra nhanh đang ở đúng repo và đúng nhánh:

```bash
git remote -v
git branch --show-current
git status --short
```

Kéo code mới:

```bash
git pull origin master
```

Cài dependency chỉ khi `package.json` hoặc `package-lock.json` thay đổi:

```bash
npm ci
```

Nếu package không đổi, có thể bỏ qua `npm ci` để deploy nhanh hơn.

Áp dụng Prisma migration nếu có migration mới:

```bash
npx prisma migrate deploy
```

Sinh lại Prisma Client:

```bash
npx prisma generate
```

Build app Production:

```bash
npm run build
```

Reload đúng app HRM bằng PM2:

```bash
pm2 reload ecosystem.config.js --only phubai-hrm --update-env
pm2 save
```

Nếu VPS đang quản lý process HRM trực tiếp theo tên, không dùng ecosystem file, có thể dùng:

```bash
pm2 reload phubai-hrm --update-env
pm2 save
```

Không dùng các lệnh sau khi chỉ muốn deploy HRM:

```bash
pm2 restart all
pm2 reload all
pm2 delete all
```

## 4. Lần đầu chạy PM2 cho HRM

Chỉ dùng phần này khi VPS chưa có process `phubai-hrm`.

```bash
cd /home/deploy/apps/phubai-hrm
npm ci
npx prisma migrate deploy
npx prisma generate
npm run build
pm2 start ecosystem.config.js --only phubai-hrm --update-env
pm2 save
pm2 startup
```

Sau `pm2 startup`, PM2 sẽ in ra một lệnh `sudo ...`; copy và chạy đúng lệnh đó để PM2 tự khởi động lại sau khi VPS reboot.

## 5. Kiểm tra sau deploy

Kiểm tra PM2 chỉ riêng HRM:

```bash
pm2 status phubai-hrm
pm2 logs phubai-hrm --lines 100
```

Kiểm tra app có trả HTTP ở port nội bộ:

```bash
curl -I http://127.0.0.1:3000
```

Nếu có reverse proxy Nginx, kiểm tra cấu hình và trạng thái:

```bash
sudo nginx -t
sudo systemctl status nginx
```

Sau đó mở trình duyệt vào domain Production của HRM và kiểm tra các màn hình vừa sửa.

## 6. Khi nào cần chạy lệnh nào

| Tình huống | Máy dev | VPS Production |
| --- | --- | --- |
| Sửa UI/API thông thường | `npm run build`, commit, push | `git pull`, `npm run build`, `pm2 reload ... --only phubai-hrm` |
| Sửa Prisma schema/migration | `npx prisma generate`, `npm run build`, commit, push | `git pull`, `npx prisma migrate deploy`, `npx prisma generate`, `npm run build`, `pm2 reload ... --only phubai-hrm` |
| Sửa dependency | `npm install`, `npm run build`, commit cả `package-lock.json`, push | `git pull`, `npm ci`, `npm run build`, `pm2 reload ... --only phubai-hrm` |
| Sửa biến môi trường | build nếu cần, commit/push nếu có code | cập nhật `.env`, `npm run build` nếu biến ảnh hưởng build, `pm2 reload ... --update-env` |
| Chỉ sửa tài liệu | commit, push | thường chỉ cần `git pull`, không cần restart PM2 |

## 7. Checklist nhanh trước khi chốt deploy

Trên máy dev:

```bash
npm run build
git diff --check
git status --short
```

Trên VPS:

```bash
git pull origin master
npx prisma migrate deploy
npx prisma generate
npm run build
pm2 reload ecosystem.config.js --only phubai-hrm --update-env
pm2 status phubai-hrm
curl -I http://127.0.0.1:3000
```

Nếu lần deploy đó không có migration mới, vẫn có thể chạy `npx prisma migrate deploy`; Prisma sẽ báo không có migration pending và không làm thay đổi dữ liệu.

## 8. Lưu ý về `ecosystem.config.js`

File hiện tại khai báo:

```js
name: "phubai-hrm"
args: "start -p 3000"
```

Vì vậy khi restart/reload bằng PM2, luôn target theo tên `phubai-hrm`.
Nếu đường dẫn `cwd` trong `ecosystem.config.js` trên VPS khác đường dẫn repo thực tế, cần sửa lại `cwd` trên VPS hoặc dùng process PM2 hiện có theo tên `phubai-hrm`.

Không tự thêm tham số port lần nữa vào lệnh PM2, vì `ecosystem.config.js` đã khai báo port `3000`.
