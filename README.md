# Bằng chứng HON-35 (review UI P0) — không merge nhánh này

Chụp 20/11/2026, Chromium headless 390×844 (isMobile, DPR 2), code `main@06ce793` (thư mục `truoc-sua/`) và nhánh `fix/ux-review-p0` (`sau-sua/`).
Stack chạy local không Docker: core-api + NATS thật, Postgres thay bằng PGlite (pglite-socket), dữ liệu từ `seed-staging.mjs`,
thêm trạng thái chuyển thiếu / tranh chấp / đã xử lý / huỷ qua API admin. Web chạy `next dev` với `NEXT_PUBLIC_API_URL`.
Ngân hàng và Zalo là số giả của staging. Script: `uxr-shots.mjs` (ảnh + axe + tràn ngang + tap target), `uxr-flow.mjs` (sheet, sao chép, báo chuyển khoản).
