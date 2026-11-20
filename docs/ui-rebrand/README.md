# Ảnh chụp rebrand FastDemo – 390×844 (HON-43)

Chụp ngày 20/11/2026 trên nhánh `feat/rename-fastdemo`, Chromium headless, viewport 390×844, deviceScaleFactor 1.
`*.png` = màn hình đầu (390×844); `*-full.png` = cả trang. Thanh hành động dính đáy (sticky) có thể hiện giữa ảnh `-full`: đó là do cách chụp cả trang, không phải lỗi bố cục.

**Không phải staging thật.** Máy dev không có Docker/Postgres nên không dựng được core-api theo `docs/STAGING.md`.
Cách chụp: `apps/web` chạy `next dev` với `NEXT_PUBLIC_API_URL` trỏ tới một địa chỉ không tồn tại; Playwright chặn mọi request tới địa chỉ đó và trả dữ liệu mẫu đúng schema `@grabcode/contracts` (Order, PaymentInstructions, Me). Vì vậy:
- Tên, số tiền, số tài khoản, ảnh QR trong ảnh đều là **dữ liệu mẫu**; ô QR là ảnh giữ chỗ "QR mẫu (giả lập)", không phải VietQR thật.
- Giao diện là code thật của nhánh; chỉ dữ liệu là giả.
- Huy hiệu Next.js dev đã được ẩn khi chụp.

| Ảnh | Màn | Trạng thái |
|---|---|---|
| `00-home` | Trang chủ (slogan) | khách đã đăng nhập |
| `00-login` | Đăng nhập (logo nền tối + slogan) | chưa đăng nhập |
| `A-vietqr-GC-1001` | A – Thanh toán VietQR | DRAFT, đã báo giá |
| `B-trang-thai-moc-cho-duyet-GC-1002` | B – Trạng thái đơn | IN_PROGRESS, M2 chờ duyệt (nút "Duyệt & trả" / "Yêu cầu sửa") |
| `B-trang-thai-da-ban-giao-GC-1003` | B – Trạng thái đơn | DELIVERED, có bản chạy thử |
| `C-sheet-nghiem-thu-GC-1003` | C – Xác nhận giải ngân | sheet "Nghiệm thu & trả" |
| `C-sheet-yeu-cau-sua-GC-1003` | C – Yêu cầu sửa | sheet + chip gợi ý |
| `C-sheet-tranh-chap-GC-1002` | C – Mở tranh chấp | sheet |
| `C-dang-tranh-chap-GC-1004` | C – Đơn đang tranh chấp | DISPUTED |
| `D-don-cua-toi` | D – Đơn của tôi | tab "Cần bạn xử lý" |

Đo tự động trên từng ảnh (A–D): không cuộn ngang (scrollWidth = 390), Navbar cao 56px, không còn chữ "grabcode", không có "..", không còn phần tử bấm được cao < 44px (trừ link/nút nằm trong câu chữ).
