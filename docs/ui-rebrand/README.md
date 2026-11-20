# Ảnh chụp rebrand FastDemo (tông cam) – 390×844 (HON-43 / HON-47)

Chụp ngày 20/11/2026 từ commit `8483ffa` (nhánh `feat/rename-fastdemo`), Chromium headless, viewport 390×844, deviceScaleFactor 1, `isMobile`.
`*.png` = màn hình đầu (390×844); `*-full.png` = cả trang. Thanh hành động dính đáy (sticky) có thể hiện giữa ảnh `-full`: đó là do cách chụp cả trang, không phải lỗi bố cục.

## Cách dựng: KHÔNG phải staging Docker

Máy chụp không có Docker/Postgres nên không chạy được `infra/deploy/staging-up.sh` (docs/STAGING.md). Thay vào đó dựng **backend thật** ở máy local:

- Postgres: PGlite (Postgres in-process, cùng thư viện test của core-api dùng) mở cổng qua `@electric-sql/pglite-socket`; chạy đủ migration bằng `drizzle-kit migrate`.
- NATS: `nats-server -js` cổng 4223.
- core-api: code thật (`tsx src/main.ts`) với biến giống `env.staging.example` (`APP_ENV=staging`, `AUTH_DEV_LOGIN=true`, STK giả `MB Bank (STAGING DEMO) / 0000000000`). Khác code repo đúng 1 chỗ, chỉ trong bản clone tạm, không commit: pool DB `max: 1, prepare: false` vì PGlite-socket không chịu nhiều kết nối song song.
- Dữ liệu: `api/core-api/scripts/seed-staging.mjs` (seed staging thật, đi qua API). Thêm 1 đơn `GC-1007` DISPUTED, cũng tạo qua API thật (đặt → báo giá → xác nhận tiền → coder nhận → nộp M1 → khách mở tranh chấp), vì seed không có đơn tranh chấp.
- `apps/web`: `next dev`, `NEXT_PUBLIC_API_URL=http://localhost:4000`, `NEXT_PUBLIC_SUPPORT_ZALO=0900000000` (số giả).
- Không có worker (brief, sandbox, notifier, outbox). Huy hiệu Next.js dev được ẩn khi chụp.

Nên: giao diện và dữ liệu đều do code thật sinh ra, nhưng tên, số tiền, STK, số Zalo là dữ liệu mẫu của staging. Ảnh QR là VietQR thật sinh từ STK giả, **không chuyển khoản được**.
Nút "Giả lập đã chuyển khoản (dev)" trong `A-…-full` có mặt vì bật `AUTH_DEV_LOGIN` như staging.
Link bàn giao `https://demo.staging.grabcode.test/...` là dữ liệu do seed tạo ra (tên miền cũ trong seed), không phải chữ trong giao diện.

| Ảnh | Màn | Trạng thái |
|---|---|---|
| `00-login` | Đăng nhập | chưa đăng nhập |
| `00-home` | Trang chủ | khách đã đăng nhập |
| `A-vietqr-GC-1005` | A – Thanh toán VietQR | DRAFT, đã báo giá, chờ chuyển khoản |
| `B-trang-thai-moc-cho-duyet-GC-1003` | B – Trạng thái đơn | IN_PROGRESS, M1 chờ duyệt (CTA "Xem & duyệt M1") |
| `B-trang-thai-da-ban-giao-GC-1002` | B – Trạng thái đơn | DELIVERED (CTA "Nghiệm thu đơn" / "Yêu cầu sửa") |
| `C-sheet-nghiem-thu-GC-1002` | C – Nghiệm thu & trả | sheet, chưa tích xác nhận |
| `C-sheet-yeu-cau-sua-GC-1002` | C – Yêu cầu sửa | sheet + chip gợi ý |
| `C-sheet-tranh-chap-GC-1003` | C – Mở tranh chấp | sheet |
| `C-dang-tranh-chap-GC-1007` | C – Đơn đang tranh chấp | DISPUTED |
| `D-don-cua-toi` | D – Đơn của tôi | tab "Cần bạn xử lý (3)" |

## Đo tự động trên từng ảnh

- Không cuộn ngang (scrollWidth = 390) ở cả 10 màn. Không lỗi JS (pageerror) nào.
- axe-core (WCAG 2 A/AA): màn A–D **0 lỗi tương phản**, 0 lỗi khác. Trang chủ có 5 lỗi tương phản + 1 `scrollable-region-focusable` (xem review).
- Không còn chữ "shipper", "tài xế", "..". Chữ "grabcode" chỉ xuất hiện trong link bàn giao do seed tạo (B/C).
- Phần tử bấm được cao < 44px ở A–D: chỉ còn link "Zalo 0900 000 000" (20px, nằm trong câu "Cần hỗ trợ? …") và ô checkbox 17×20 trong sheet nghiệm thu (nằm trong `<label>` 350×66, bấm cả dòng là tích được, đã thử).

Tương phản đo trên màu thực tế (computed style):

| Phần tử | Chữ / nền | Tỉ lệ | AA |
|---|---|---|---|
| Nút chính ("Nghiệm thu đơn", "Nghiệm thu & trả", "Đăng nhập") | #FFFFFF / #C2410C | 5.18 | đạt |
| Nút phụ ("Tôi đã chuyển khoản", "Yêu cầu sửa", "Sao chép") | #9A3412 / #FFF7ED | 6.88 | đạt |
| Chip "Chờ thanh toán" (12px) | #92400E / #FEF3C7 | 6.37 | đạt |
| Giá đơn | #9A3412 / #F8FAFC | 6.98 | đạt |
| Trang chủ: đầu cột "FastDemo" bảng so sánh (14px đậm) | #FFFFFF / #EA580C | 3.56 | **không đạt** |
| Trang chủ: nhãn danh mục template (`text-slate-400`, 12px) | #94A3B8 / #FFFFFF | 2.56 | **không đạt** |
