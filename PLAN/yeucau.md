Đây là lỗi rất kinh điển trên iOS/Safari! Nguyên nhân gần như chắc chắn là:

---

## 🎯 Nguyên nhân: `-webkit-font-smoothing` + Font weight rendering trên iOS

Safari trên iPhone dùng cơ chế render font khác Chrome trên máy tính. Cụ thể:

**1. `font-weight` bị render nhẹ hơn thực tế**
iOS Safari tự áp dụng **antialiasing** làm chữ trông mỏng và nhạt hơn, đặc biệt với màu chữ không phải đen thuần (`#000`). Ví dụ chữ màu `#595959` hay `rgba` trên desktop trông ổn nhưng trên iPhone trông rất mờ.

**2. Tailwind CSS mặc định có `antialiased`**
Nếu layout dùng class `antialiased` (Tailwind thường thêm vào `body` mặc định trong `globals.css`), trên iOS nó kích hoạt `-webkit-font-smoothing: antialiased` làm chữ mỏng đi đáng kể.

---

## 🔧 Cách fix

**Fix 1 — Trong `globals.css`, bỏ hoặc override `antialiased`:**

```css
body {
  -webkit-font-smoothing: auto; /* thay vì antialiased */
}
```

**Fix 2 — Tăng font-weight cho các text mobile:**

```css
/* Với Tailwind, thêm vào các element text trên mobile */
@media (max-width: 768px) {
  body {
    font-weight: 500; /* thay vì 400 */
    -webkit-font-smoothing: auto;
  }
}
```

**Fix 3 — Kiểm tra màu chữ** — đổi các màu xám nhạt như `#8c8c8c`, `color: secondary` sang đậm hơn một chút cho phiên bản mobile.

---

## 🔍 Cách xác nhận chính xác

Mở `globals.css` hoặc `layout.tsx` tìm xem có dòng nào trong số này không:

```css
font-smoothing: antialiased
-webkit-font-smoothing: antialiased
class="antialiased"   /* trong <body> của layout.tsx */
```

Nếu có → đó chính là thủ phạm. Bạn thử kiểm tra xem nhé!
