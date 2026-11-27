# Đổi tên sản phẩm (checklist)

Tên, slogan, tên công ty hiển thị: `packages/contracts/src/brand.ts` (`BRAND`). Đổi tên lần sau = sửa file này, rồi:

1. `apps/web/public/sw.js` — chuỗi `title: 'Ai Code AI'` (file tĩnh, không import được `BRAND`).
2. Logo: wordmark `apps/web/components/Logo.tsx` (tự tách `BRAND.name` thành 2 màu) + mark SVG tạm (túi giao hàng + nút play + vạch tốc độ, tông cam kiểu app giao đồ ăn). Cùng hình đó ở `apps/web/app/icon1.svg` (Next chỉ gắn 1 file `icon.*`, nên SVG phải đánh số), `apps/web/app/icon.png`, `apps/web/app/apple-icon.png`, `apps/coder/app/icon.png`, `apps/coder/public/icon-{192,512,maskable-512}.png` (xuất bằng `sharp` từ SVG). Có logo thật thì thay cả các file này.
   Slogan `BRAND.tagline` là câu hoàn chỉnh, tự có dấu câu: component không bao giờ nối thêm dấu câu hay ghép nó vào giữa câu khác; luôn đặt trong phần tử riêng.
3. Docs trong `docs/` và `CHECKLIST.md`, `CLAUDE.md`, `DESIGN.md` (tìm tên cũ bằng grep).
4. Tên miền: không hardcode; dùng env `WEB_ORIGIN`, `DOMAIN`, `API_PUBLIC_URL`, `STAGING_DOMAIN`.

Cố ý giữ tên kỹ thuật nội bộ `grabcode` (scope `@grabcode/*`, user/DB Postgres, stream NATS `GRABCODE`, tên bảng/key localStorage, repo GitHub): người dùng không thấy, đổi cần migration/quyền admin.
