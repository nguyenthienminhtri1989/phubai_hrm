// prisma/seed.ts
import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs"; // Import thư viện mã hóa

const prisma = new PrismaClient();

// Định nghĩa dữ liệu các loại công
const attendanceCodes = [
  // --- NHÓM 1: LƯƠNG THỜI GIAN (Đi làm, Công tác...) ---
  {
    code: "X",
    name: "Đi làm bình thường",
    category: "TIME_WORK",
    color: "#22c55e",
  }, // Xanh lá
  { code: "XD", name: "Làm ca 3", category: "TIME_WORK", color: "#15803d" }, // Xanh đậm
  {
    code: "LĐ",
    name: "Lao động nghĩa vụ",
    category: "TIME_WORK",
    color: "#0ea5e9",
  }, // Xanh dương đậm (Đã sửa LĐ)
  {
    code: "LD",
    name: "Làm ca 3 ngày lễ",
    category: "TIME_WORK",
    color: "#7e22ce",
  }, // Tím đậm (Đã sửa LD)
  {
    code: "XL",
    name: "Đi làm ngày lễ",
    category: "TIME_WORK",
    color: "#a855f7",
  }, // Tím
  {
    code: "LE",
    name: "Công đi làm ngày lễ",
    category: "TIME_WORK",
    color: "#9333ea",
  }, // Tím
  { code: "CT", name: "Đi công tác", category: "TIME_WORK", color: "#06b6d4" }, // Cyan

  // --- NHÓM 2: NGHỈ HƯỞNG 100% LƯƠNG (Phép, Lễ...) ---
  {
    code: "F",
    name: "Nghỉ phép năm",
    category: "PAID_LEAVE",
    color: "#3b82f6",
  }, // Xanh dương
  { code: "L", name: "Nghỉ lễ", category: "PAID_LEAVE", color: "#f97316" }, // Cam
  {
    code: "R",
    name: "Nghỉ chế độ (Hiếu/Hỉ)",
    category: "PAID_LEAVE",
    color: "#60a5fa",
  }, // Xanh dương nhạt
  { code: "B", name: "Nghỉ bão lũ", category: "PAID_LEAVE", color: "#64748b" }, // Xám xanh
  { code: "ĐC", name: "Nghỉ đảo ca", category: "PAID_LEAVE", color: "#94a3b8" }, // Xám nhạt

  // --- NHÓM 3: CHẾ ĐỘ ỐM / TAI NẠN (BHXH chi trả hoặc Lương cty) ---
  { code: "Ô", name: "Nghỉ ốm", category: "SICK", color: "#eab308" }, // Vàng
  { code: "CÔ", name: "Nghỉ con ốm", category: "SICK", color: "#fbbf24" }, // Vàng cam
  { code: "T", name: "Tai nạn lao động", category: "SICK", color: "#ef4444" }, // Đỏ
  { code: "DS", name: "Nghỉ dưỡng sức", category: "SICK", color: "#facc15" }, // Vàng chanh
  { code: "CL", name: "Nghỉ cách ly", category: "SICK", color: "#84cc16" }, // Xanh nõn chuối

  // --- NHÓM 4: THAI SẢN ---
  {
    code: "TS",
    name: "Nghỉ thai sản",
    category: "MATERNITY",
    color: "#ec4899",
  }, // Hồng

  // --- NHÓM 5: KHÔNG LƯƠNG ---
  {
    code: "RO",
    name: "Nghỉ không lương",
    category: "UNPAID",
    color: "#d1d5db",
  }, // Xám trắng

  // --- NHÓM 6: NGHỈ VÔ LÝ DO (Kỷ luật) ---
  { code: "O", name: "Nghỉ vô lý do", category: "AWOL", color: "#000000" }, // Đen
];

async function main() {
  console.log("🌱 Bắt đầu nạp dữ liệu ký hiệu chấm công...");

  for (const item of attendanceCodes) {
    // Dùng upsert: Nếu có code rồi thì update, chưa có thì create (Tránh lỗi trùng)
    await prisma.attendanceCode.upsert({
      where: { code: item.code },
      update: item,
      create: item,
    });
  }

  // TẠO USER ADMIN
  const hashedPassword = await bcrypt.hash("150489", 10); // Mật khẩu là 150489

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: hashedPassword,
      fullName: "Quản trị viên",
      role: Role.ADMIN,
    },
  });

  console.log("✅ Đã nạp xong danh mục chấm công!");
  console.log({ admin });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
