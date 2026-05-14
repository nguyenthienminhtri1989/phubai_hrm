Tìm ra thủ phạm rồi! Có **2 vấn đề cùng lúc**:

---

**Vấn đề 1 — Font Inter không load được trên mobile (quan trọng nhất)**

```tsx
// layout.tsx
const inter = Inter({ subsets: ["latin"] });
// ...
<body className={inter.className}>  // ← đây
```

`Inter` từ Google Fonts — nếu điện thoại không tải được font này (mạng chậm, block Google Fonts...) thì browser fallback sang font hệ thống và **class `inter.className` vẫn giữ nguyên các CSS variable của Inter**, gây ra rendering lạ, chữ mờ nhạt.

---

**Vấn đề 2 — Dark mode đang bật ngầm**

```css
@media (prefers-color-scheme: dark) {
  :root {
    --foreground: #ededed; /* chữ trắng */
    --background: #0a0a0a;
  }
}
```

Nếu điện thoại đang bật **Dark Mode** → chữ sẽ thành `#ededed` (trắng nhạt) trên nền `#0a0a0a`. Nhưng **Ant Design và Tailwind không biết** bạn đang dark mode → nền các component vẫn trắng → chữ trắng trên nền trắng = **mờ/vô hình!**

---

## Fix cụ thể

**`globals.css`** — bỏ dark mode tự động đi (vì app chưa hỗ trợ dark mode hoàn chỉnh):

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #1a1a1a; /* đậm hơn #171717 một chút */
}

/* XÓA TOÀN BỘ ĐOẠN NÀY */
/* @media (prefers-color-scheme: dark) { ... } */

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
  -webkit-font-smoothing: auto;
  -moz-osx-font-smoothing: auto;
}

@media (max-width: 768px) {
  body {
    font-weight: 500;
    -webkit-font-smoothing: auto;
  }
}
```

**`layout.tsx`** — bỏ Inter, dùng font hệ thống cho chắc:

```tsx
// Xóa dòng này
// const inter = Inter({ subsets: ["latin"] });

// Và đổi <body> thành
<body>   {/* bỏ className={inter.className} */}
```

Thử 2 fix này xem có hết mờ không nhé!
