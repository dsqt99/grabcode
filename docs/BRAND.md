# Đổi tên sản phẩm (checklist)

Tên, slogan, tên công ty hiển thị: `packages/contracts/src/brand.ts` (`BRAND`). Đổi tên lần sau = sửa file này, rồi:

1. `apps/web/public/sw.js` — chuỗi `title: 'FastDemo'` (file tĩnh, không import được `BRAND`).
2. Logo: hiện là wordmark chữ trong `apps/web/components/Navbar.tsx`; thay bằng logo thật khi có.
3. Docs trong `docs/` và `CHECKLIST.md`, `CLAUDE.md`, `DESIGN.md` (tìm tên cũ bằng grep).
4. Tên miền: không hardcode; dùng env `WEB_ORIGIN`, `DOMAIN`, `API_PUBLIC_URL`, `STAGING_DOMAIN`.

Cố ý giữ tên kỹ thuật nội bộ `grabcode` (scope `@grabcode/*`, user/DB Postgres, stream NATS `GRABCODE`, tên bảng/key localStorage, repo GitHub): người dùng không thấy, đổi cần migration/quyền admin.
