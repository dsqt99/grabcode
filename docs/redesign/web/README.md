# Ảnh chụp redesign web khách (HON-52)

Chụp ngày 20/11/2026 trên nhánh `feat/redesign-web`, Chromium headless (playwright-core), deviceScaleFactor 1.
`*-390.png` = màn đầu 390×844 (`isMobile`), `*-390-full.png` = cả trang 390, `*-1280.png` = màn đầu 1280×800.
Trong ảnh `-full`, thanh hành động dính đáy hiện giữa trang: do cách chụp cả trang, không phải lỗi bố cục.

> **Ảnh PNG và `checks.json` chưa có trong PR**: máy agent không có quyền `git push`, PR được đẩy qua GitHub API chỉ nhận file văn bản.
> Toàn bộ ảnh + `checks.json` đính kèm ở task HON-52 (`redesign-web-screenshots.zip`, giải nén ra đúng thư mục này).

## Cách dựng: KHÔNG phải staging, KHÔNG phải backend thật

Máy chụp không có Docker. Dựng như sau:

- `apps/web`: `next dev` với `NEXT_PUBLIC_API_URL=http://localhost:4010`, `NEXT_PUBLIC_SUPPORT_ZALO=0900000000` (số giả).
- **API giả** `fake-api.mjs` (thư mục này): Node `http`, trả dữ liệu cố định theo đúng schema `packages/contracts` (OrderDto, PaymentInstructions, OrderRepo, ChatList, Me). Mỗi đơn GC-2001…GC-2011 là một trạng thái. Không có state machine, không ledger: thao tác (duyệt, nghiệm thu…) **không** được kiểm thử ở đây, ảnh chỉ kiểm giao diện.
- Ảnh QR là VietQR thật sinh từ STK giả `MB 0000000000`, không chuyển khoản được. Tên, số tiền, link `demo.example.com` là dữ liệu mẫu.
- Script chụp + đo: `shoot.cjs` (đường dẫn Chromium/axe trong script là của máy chụp; sửa lại nếu chạy máy khác).
- Chat có 2 dòng "Đơn … đã nhận …" trùng: 1 dòng từ API giả + 1 dòng trang tự tạo khi chưa có chat cục bộ (hành vi cũ, không đổi trong PR này).
- Chữ Plus Jakarta Sans ở một số nút/chip bị dính khoảng trắng (VD "Mởbảnbàngiao"): lỗi dựng font của Chromium headless trên máy chụp, ảnh HON-47 (`docs/ui-rebrand/`) cũng bị. Trên trình duyệt thật cần kiểm lại.

## Danh sách ảnh

| Ảnh | Màn | Trạng thái |
|---|---|---|
| `01-trang-chu` | Trang chủ | đã đăng nhập |
| `02-dang-nhap` | Đăng nhập | chưa đăng nhập |
| `03-dat-don` | `/order/new` | đặc tả đã soạn, chưa tích điều khoản |
| `04-don-cua-toi` | `/orders` | tab "Cần bạn xử lý (4)" |
| `10-cho-bao-gia-GC-2001` | `/order/[id]` | DRAFT chưa báo giá |
| `11-vietqr-GC-2002` | `/order/[id]` | DRAFT đã báo giá, VietQR |
| `12-tim-coder-GC-2003` | `/order/[id]` | FUNDED, >30 phút chưa ai nhận, đã khai tài khoản hoàn |
| `13-moc-cho-duyet-GC-2004` | `/order/[id]` | IN_PROGRESS, M1 chờ duyệt |
| `14-dang-lam-GC-2005` | `/order/[id]` | IN_PROGRESS, M2 đang làm sau yêu cầu sửa |
| `15-da-ban-giao-GC-2006` | `/order/[id]` | DELIVERED |
| `16-hoan-tat-GC-2007` | `/order/[id]` | ACCEPTED, có nút nhận repo |
| `17-tranh-chap-GC-2008` | `/order/[id]` | DISPUTED (form tài khoản hoàn mở sẵn) |
| `18-da-xu-ly-GC-2009` | `/order/[id]` | RESOLVED, hoàn 4.000.000 đ |
| `19-da-huy-GC-2010` | `/order/[id]` | CANCELLED, hoàn 5.000.000 đ |
| `20-moc-cuoi-qa-loi-GC-2011` | `/order/[id]` | mốc cuối chờ duyệt, QA không đạt (nút duyệt khoá có lý do) |
| `30`…`36` | Sheet | duyệt mốc, yêu cầu sửa mốc, nghiệm thu, yêu cầu sửa đơn, tranh chấp, nhận repo, duyệt mốc cuối (QA lỗi) |
| `40-ho-so`, `41-dieu-khoan` | Hồ sơ, trang tĩnh | chỉ đổi token/màu (P1) |

## Đo tự động (`checks.json`, cả 390 và 1280, 24 màn × 2)

- axe-core 4.13 (wcag2a, wcag2aa, wcag21aa): **0 vi phạm** ở mọi màn, kể cả sheet.
- Không cuộn ngang ở 390 (scrollWidth = 390) và 1280. Không lỗi JS (pageerror).
- Không còn chữ "cuốc", "tài xế", "shipper" trên các màn đã chụp.
- Phần tử bấm được nhỏ hơn 44px: chỉ 2 link "Điều khoản sử dụng", "Chính sách hoàn tiền" nằm trong câu "Tôi đồng ý …" của ô tích (ngoại lệ link trong câu; cả dòng `check-row` 48px bấm được).
- Ở 390, trạng thái "Chờ bạn duyệt mốc": link bàn giao và nút duyệt của mốc nằm trong ~900px đầu trang (yêu cầu ≤1.200px).

Chưa đo: bàn phím (Tab/Esc) và `prefers-reduced-motion` bằng tay; trình duyệt thật iOS/Android; desktop 1280 cho trang hồ sơ dạng thiết kế mới (chưa làm, P1).
