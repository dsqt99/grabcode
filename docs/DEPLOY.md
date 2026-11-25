# Ai Code AI — Chạy thử và triển khai MVP

Tài liệu cho bản MVP nhận đơn và thu tiền thật. Luồng chạy như sau:

1. Khách (chủ shop/SME) đăng yêu cầu.
2. Khách chuyển khoản hoặc quét VietQR.
3. Admin kiểm tra app ngân hàng rồi bấm "Xác nhận đã nhận tiền".
4. Freelancer nhận đơn từ "Việc đang chờ nhận".
5. Freelancer bàn giao từng mốc bằng link (demo, repo GitHub, file Google Drive).
6. Khách duyệt mốc hoặc yêu cầu sửa, rồi nghiệm thu.
7. Tiền vào ví freelancer. Freelancer yêu cầu rút, admin chuyển khoản tay rồi bấm duyệt.

## 1. Chạy thử ở máy

Cần Node 22+, pnpm 10 (`corepack enable`) và Docker Desktop.

```bash
pnpm install
cp .env.example .env                   # để AUTH_DEV_LOGIN=true khi chạy ở máy
docker compose up -d                   # Postgres :5433, NATS :4223 (Centrifugo không bắt buộc)
pnpm --filter @grabcode/core-api db:migrate
```

Tạo file `.env.local` cho 3 app, mỗi file một dòng `NEXT_PUBLIC_API_URL=http://localhost:4000` (web thêm `NEXT_PUBLIC_SUPPORT_ZALO` / `NEXT_PUBLIC_SUPPORT_HOTLINE` nếu muốn thấy kênh hỗ trợ). `next build` của web và coder báo lỗi nếu thiếu `NEXT_PUBLIC_API_URL`; web còn cần ít nhất một kênh hỗ trợ:

- `apps/web/.env.local`
- `apps/coder/.env.local`
- `apps/admin/.env.local`

Chạy các tiến trình, mỗi lệnh ở một terminal (hoặc `pnpm dev` để chạy tất cả):

```bash
pnpm --filter @grabcode/core-api dev
pnpm --filter @grabcode/outbox-relay dev
pnpm --filter @grabcode/brief-worker dev   # không bắt buộc: thiếu LLM_API_KEY thì web dùng brief mẫu
pnpm --filter @grabcode/web dev            # http://localhost:3000
pnpm --filter @grabcode/coder dev          # mở qua http://localhost:3000/coder
pnpm --filter @grabcode/admin dev          # mở qua http://localhost:3000/admin
```

Thêm `http://localhost:3000` vào `WEB_ORIGIN` trong `.env`. Giá trị mặc định đã có sẵn.

**Thử cả luồng bằng tay:**

1. Mở `/login`, đăng ký một tài khoản vai trò **Khách hàng**, rồi đặt một đơn ở trang chủ.
2. Ở cửa sổ ẩn danh, đăng ký một tài khoản vai trò **Coder** và mở `/coder`.
3. Cấp quyền admin cho một tài khoản (xem mục 3.4). Ở máy có thể đăng nhập nhanh:
   `curl -X POST localhost:4000/v1/auth/dev-login -H 'content-type: application/json' -d '{"login":"admin","role":"ADMIN"}'`.
   Cách dễ hơn là cấp ADMIN cho chính tài khoản khách bằng câu SQL ở mục 3.4.
4. Vào `/admin`, tab "Đơn hàng & thanh toán", nhập số tiền và một mã giao dịch bất kỳ rồi bấm xác nhận. Đơn sẽ hiện ở "Việc đang chờ nhận" của coder.
5. Coder bấm nhận, nộp mốc kèm link. Khách duyệt mốc hoặc yêu cầu sửa, rồi nghiệm thu.

**Kiểm tra tự động** (cần core-api đang chạy với `AUTH_DEV_LOGIN=true`):

```bash
pnpm typecheck && pnpm lint && pnpm test
node api/core-api/scripts/smoke-mvp.mjs        # toàn bộ luồng MVP, 36 kiểm tra
node api/core-api/scripts/smoke-milestones.mjs
node api/core-api/scripts/smoke-admin.mjs
```

> Muốn một bản chạy thử có dữ liệu mẫu cho CEO/Tester: xem [STAGING.md](STAGING.md) (`infra/deploy/staging-up.sh`).

## 2. Chọn cách triển khai: 1 VPS + Docker Compose

Đây là cách rẻ và đơn giản nhất cho giai đoạn có vài chục đơn mỗi tháng. Một máy chủ chạy tất cả:

- Postgres và NATS;
- core-api, outbox-relay, brief-worker;
- 3 app Next.js (web, coder, admin);
- Caddy làm reverse proxy, tự cấp HTTPS Let's Encrypt.

Mọi thứ dùng chung một tên miền, nên cookie đăng nhập hoạt động mà không cần cấu hình CORS phức tạp.

- **Cấu hình tối thiểu:** 2 vCPU, 4 GB RAM, 40 GB SSD, Ubuntu 22.04/24.04. Việc build 3 app Next.js cần khoảng 3 GB RAM, nên bật thêm 2–4 GB swap.
- **Chi phí tham khảo:**
  - VPS khoảng 150.000–350.000đ/tháng ở các nhà cung cấp trong nước (Vietnix, BizFly Cloud, Viettel IDC...) hoặc khoảng 5–8 USD/tháng ở nước ngoài (Hetzner, DigitalOcean, Vultr Singapore).
  - Tên miền .vn hoặc .com vài trăm nghìn đồng/năm.
  - Kiểm tra lại giá hiện tại trước khi mua.
- **Chưa cần ở giai đoạn này:**
  - Kubernetes, Cloud Run;
  - repo-worker (GitHub App), qa-worker (Docker-in-Docker), deploy-worker (GCP sandbox).

  Luồng MVP không phụ thuộc vào các thành phần trên: freelancer bàn giao bằng link.
- **Khi nào nên tách:** khi có nhiều đơn mỗi ngày, chuyển Postgres sang dịch vụ có backup tự động (Neon, Supabase, hoặc DB managed của nhà cung cấp VPS) và giữ phần còn lại trên VPS.

## 3. Triển khai lần đầu

### 3.1 Tên miền

Tạo bản ghi DNS **A** trỏ tên miền (ví dụ `example.com`, thay bằng tên miền thật khi đã mua) về IP của VPS. Mở cổng 80 và 443 trên firewall.

### 3.2 Cài Docker và lấy code

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
git clone https://github.com/dsqt99/grabcode.git && cd grabcode
```

Repo đang private: dùng deploy key (GitHub → Settings → Deploy keys, chỉ quyền đọc) hoặc personal access token để clone.

### 3.3 Điền biến môi trường

```bash
cp infra/deploy/env.production.example .env.production
nano .env.production
```

Biến bắt buộc:

| Biến | Giá trị |
| --- | --- |
| `DOMAIN` | `example.com` (không có https) |
| `WEB_ORIGIN`, `API_PUBLIC_URL` | `https://example.com` |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` |
| `PAYMENT_BANK_ID` | Mã ngân hàng VietQR hoặc BIN, ví dụ `MB`, `VCB`, `TCB`, `970422` |
| `PAYMENT_BANK_NAME` | Tên hiển thị, ví dụ `MB Bank` |
| `PAYMENT_ACCOUNT_NUMBER` | Số tài khoản nhận tiền |
| `PAYMENT_ACCOUNT_NAME` | Tên chủ tài khoản, IN HOA không dấu, đúng như ngân hàng hiển thị |

`.env.production` chỉ nằm trên máy chủ: đã có trong `.gitignore` và `.dockerignore`. Không gửi file này qua chat, không commit.

### 3.4 Chạy

```bash
docker compose --env-file .env.production -f infra/deploy/docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f infra/deploy/docker-compose.prod.yml logs -f core-api
```

Lần đầu build mất khoảng 10–20 phút. Migration database chạy tự động (service `migrate`) trước khi core-api khởi động.

**Tạo tài khoản admin:**

1. Mở `https://DOMAIN/login` và đăng ký bằng email của nhà sáng lập.
2. Chạy lệnh sau:

```bash
docker compose --env-file .env.production -f infra/deploy/docker-compose.prod.yml exec postgres \
  psql -U grabcode -c "update core.users set roles = array_append(roles, 'ADMIN') where email = lower('ban@example.com') and not 'ADMIN' = any(roles);"
```

3. Đăng xuất rồi đăng nhập lại, sau đó mở `https://DOMAIN/admin`.

### 3.5 Kiểm tra sau khi lên

1. `https://DOMAIN` mở được và có ổ khoá HTTPS.
2. Đăng ký khách, đặt một đơn nhỏ. Trang thanh toán hiện QR VietQR đúng tài khoản, đúng số tiền, đúng nội dung (ví dụ `GC1006`).
3. Chuyển thử 10.000đ bằng một đơn giá thấp, hoặc xác nhận tay một khoản nhỏ trong `/admin` để thử luồng. Sau đó hoàn tiền bằng nút "Hoàn & huỷ đơn".

### 3.6 Cập nhật phiên bản mới

```bash
git pull
docker compose --env-file .env.production -f infra/deploy/docker-compose.prod.yml up -d --build
```

### 3.7 Sao lưu database (bắt buộc khi đã có tiền thật)

```bash
mkdir -p ~/backups
crontab -e
# thêm dòng sau (3h sáng mỗi ngày, giữ 14 bản):
0 3 * * * cd ~/grabcode && docker compose --env-file .env.production -f infra/deploy/docker-compose.prod.yml exec -T postgres pg_dump -U grabcode grabcode | gzip > ~/backups/grabcode-$(date +\%F).sql.gz && ls -t ~/backups/*.gz | tail -n +15 | xargs -r rm
```

Nên chép định kỳ thư mục `~/backups` ra ngoài máy chủ (Google Drive, S3...).

### 3.8 Thông báo admin qua Telegram

Service `notifier` gửi tin vào một nhóm Telegram của vận hành khi có:

- đơn mới (`order.created`), cần báo giá;
- khách bấm "Tôi đã chuyển khoản" (`payment.reported`);
- khách mở tranh chấp (`order.disputed`);
- freelancer gửi yêu cầu rút tiền (`payout.requested`).

Mỗi tin có mã đơn, số tiền, tên + SĐT khách (hoặc freelancer) và link `/admin`. Mỗi sự kiện chỉ gửi một lần: notifier chống trùng theo `event_id` trong bảng `notifier.processed_admin_events`.

**Tạo bot (khoảng 5 phút):**

1. Trong Telegram, nhắn [@BotFather](https://t.me/BotFather) lệnh `/newbot`, đặt tên (ví dụ `Ai Code AI Ops`) và username kết thúc bằng `bot`. BotFather trả về **token** dạng `123456789:AA...`. Token này là bí mật: không gửi qua chat, không commit.
2. Tạo một nhóm Telegram cho vận hành và thêm bot vào nhóm. Gửi một tin bất kỳ trong nhóm, ví dụ `/start`.
3. Lấy **chat id** của nhóm: mở `https://api.telegram.org/bot<TOKEN>/getUpdates` trên trình duyệt, tìm `"chat":{"id":-100...}`. Chat id của nhóm là số âm.
4. Điền vào `.env.production`:

   ```
   TELEGRAM_BOT_TOKEN=123456789:AA...
   TELEGRAM_ADMIN_CHAT_ID=-100...
   ADMIN_PUBLIC_URL=https://example.com/admin   # bỏ trống thì dùng {WEB_ORIGIN đầu tiên}/admin
   ```

5. Khởi động lại notifier: `docker compose --env-file .env.production -f infra/deploy/docker-compose.prod.yml up -d notifier`. Log phải có dòng `admin notices started (Telegram on)`.
6. Thử: đặt một đơn mới. Nhóm sẽ nhận tin "Đơn mới GC-… — cần báo giá".

Thiếu một trong hai biến `TELEGRAM_*` thì ứng dụng vẫn chạy bình thường: notifier chỉ in nội dung thông báo ra log (`docker compose ... logs notifier`). Telegram lỗi tạm thời (mạng, 429, 5xx) thì notifier thử lại tối đa 5 lần, giãn cách tăng dần. Lỗi 4xx (sai chat id, bot bị xoá khỏi nhóm) chỉ ghi log, không thử lại.

## 4. Thu tiền: hiện tại và sau này

**Hiện tại: admin báo giá, khách chuyển khoản / VietQR, admin xác nhận tay.**

- Khách chọn một món trong menu (mục 5). Đơn mới ở trạng thái DRAFT với "giá từ" của món đó và **chưa hiện QR**.
- Admin đọc yêu cầu (có tin Telegram, mục 3.8), vào `/admin` → "Đơn hàng & thanh toán" và bấm "Báo giá": nhập giá chốt và số ngày giao. Có thể báo giá lại khi đơn còn DRAFT, nhưng không thấp hơn số tiền khách đã chuyển.
- Sau khi báo giá, trang thanh toán của khách hiện giá chốt và QR (`img.vietqr.io`) đã điền sẵn số tiền và nội dung là mã đơn bỏ gạch, ví dụ `GC1006`.
- Admin mở app ngân hàng, thấy tiền vào, rồi vào `/admin` → "Đơn hàng & thanh toán". Nhập số tiền và **mã giao dịch ngân hàng** (FT...) rồi bấm "Xác nhận đã nhận tiền".
- Cùng một mã giao dịch không thể ghi nhận hai lần cho một đơn.
- Nhận đủ tiền thì đơn chuyển FUNDED và hiện cho freelancer.
- Tiền nằm trong sổ cái kép (`core.ledger_*`):
  - khách duyệt mốc nào thì nhả phần tiền của mốc đó, **trừ mốc cuối**: phần mốc cuối (mặc định 30%) được giữ tới khi khách nghiệm thu cả đơn;
  - khách "Yêu cầu sửa" sau bàn giao (ghi chú tối thiểu 10 ký tự) thì mốc cuối mở lại, freelancer nộp link mới cho mốc đó;
  - freelancer nhận `payoutVnd`, chốt theo tỷ lệ lúc tạo đơn và lúc báo giá;
  - nền tảng giữ phần còn lại.
- Rút tiền cho freelancer: freelancer gửi yêu cầu trong app, admin chuyển khoản tay rồi bấm duyệt ở tab "Rút tiền".

**Bước tiếp theo, không cần sửa luồng:** bật xác nhận tự động qua **SePay**. Code webhook đã có sẵn.

1. Đăng ký SePay và liên kết tài khoản nhận tiền.
2. Cấu hình webhook `https://DOMAIN/v1/payments/sepay/webhook`, xác thực bằng API Key.
3. Điền `SEPAY_WEBHOOK_API_KEY`.

Từ đó, trang thanh toán báo "chờ ngân hàng xác nhận" thay cho "admin xác nhận". Admin vẫn xác nhận tay được.

**Sau này: MoMo / VNPay (chưa làm).**

1. Cần đăng ký merchant (hợp đồng doanh nghiệp, giấy phép kinh doanh) để có `partnerCode`/`accessKey`/`secretKey` (MoMo) hoặc `vnp_TmnCode`/`vnp_HashSecret` (VNPay). Mỗi cổng có môi trường sandbox để thử trước.
2. Contract: thêm `POST /v1/orders/{id}/checkout {provider}`. API trả URL thanh toán đã ký HMAC.
3. API: thêm endpoint IPN (`/v1/payments/momo/ipn`, `/v1/payments/vnpay/ipn`):
   - kiểm chữ ký bằng so sánh constant-time;
   - kiểm số tiền khớp đơn;
   - ghi sổ bằng đúng hàm `recordDeposit(txId = 'momo:<transId>' | 'vnpay:<vnp_TransactionNo>', orderId, amount)` mà SePay và admin đang dùng. Idempotent sẵn, không đổi state machine.
4. Web: nút "Thanh toán MoMo/VNPay" cạnh QR, kèm trang return chỉ để hiển thị. Trạng thái thật luôn lấy từ IPN, không tin tham số trên URL return.
5. Phí cổng (khoảng 1–2,5%/giao dịch, tuỳ hợp đồng) cần tính vào bảng giá trong `packages/contracts/src/schemas/pricing.ts`.

## 5. Bảng giá và tỷ lệ chia doanh thu

Mọi con số nằm ở **một file**: `packages/contracts/src/schemas/pricing.ts`.

- `MENU`: các món theo HON-9: mã món, tên, phạm vi, "giá từ" và số ngày giao. Giá thật của từng đơn do admin báo (mục 4). Không có phụ phí theo độ dài mô tả.
- `CODER_PAYOUT_RATE`: tỷ lệ trả freelancer, hiện là 0,7. Đổi tỷ lệ chỉ cần sửa dòng này.
- `DEFAULT_MILESTONE_WEIGHTS`: trọng số mốc mặc định 20/50/30. Mốc cuối được giữ tới khi nghiệm thu (`releasesOnApproval` trong `order.ts`).

Web và API đều đọc từ file này. Khi đổi tỷ lệ, chỉ **đơn tạo hoặc báo giá sau đó** áp dụng tỷ lệ mới. Đơn cũ giữ `payout_vnd` đã chốt. Đơn tạo trước khi có menu được coi là đã báo giá (migration `0019_menu_quote`) và giữ nguyên giá.
