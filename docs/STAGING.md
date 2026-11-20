# GrabCode — Staging demo cho CEO và Tester

Staging là một bản chạy thật của GrabCode (web khách, app freelancer, trang admin) trên một VPS riêng, có sẵn dữ liệu mẫu. Mục đích:

- CEO/founder bấm thử cả luồng: đặt đơn → thanh toán → freelancer nhận → bàn giao → nghiệm thu.
- Tester chạy E2E và smoke test trên đó (HON-22).

Mặc định staging chạy trên VPS riêng. Nếu chỉ có VPS đang chạy production, dùng chế độ "shared VPS" ở mục 12 (không đụng cổng 80/443 và dữ liệu của production). Staging **không** có tiền thật (STK ngân hàng trên đó là STK giả).

## 1. Cần gì

| Thứ | Chi tiết |
| --- | --- |
| VPS | Ubuntu 22.04/24.04, **2 vCPU, 4 GB RAM, 40 GB SSD** (đủ cho demo). Khoảng 5–8 USD/tháng (Hetzner, DigitalOcean, Vultr Singapore) hoặc 150.000–350.000đ/tháng (Vietnix, BizFly, Viettel IDC). Kiểm tra lại giá trước khi mua. Lần build đầu cần ~3 GB RAM: bật swap 4 GB. |
| Tên miền | Một subdomain, ví dụ `staging.grabcode.vn`. |
| DNS | Bản ghi **A**: `staging.grabcode.vn` → IP của VPS. Mở cổng **80 và 443** trên firewall (Caddy cần cả hai để cấp HTTPS Let's Encrypt). |
| GitHub | Quyền thêm Deploy key và GitHub Secrets của repo `dsqt99/grabcode`. |

## 2. Dựng staging bằng 1 lệnh

Trên VPS (hoặc máy bất kỳ có Docker, kể cả máy cá nhân để chạy thử với `localhost`):

```bash
curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER && newgrp docker
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
git clone https://github.com/dsqt99/grabcode.git && cd grabcode      # repo private: dùng deploy key, xem mục 3
./infra/deploy/staging-up.sh staging.grabcode.vn
```

Script tự làm theo thứ tự:

1. Tạo `.env.staging` từ `infra/deploy/env.staging.example`, tự sinh mật khẩu Postgres, `STAGING_DEV_LOGIN_KEY` và `DEMO_PASSWORD` (file chỉ nằm trên máy chủ, đã có trong `.gitignore` và `.dockerignore`).
2. `docker compose up -d --build` (production compose + `docker-compose.staging.yml`): Postgres, NATS, migrate, core-api, outbox-relay, brief-worker, notifier, web, coder, admin, Caddy. Lần đầu 10–20 phút.
3. Chờ core-api khoẻ, rồi nạp dữ liệu mẫu (`api/core-api/scripts/seed-staging.mjs`).
4. In URL, mật khẩu demo và lệnh smoke test.

Chạy lại lệnh đó để cập nhật lên code mới: giữ nguyên bí mật và dữ liệu. Không truyền domain thì dùng domain đã lưu trong `.env.staging` (mặc định `localhost`, Caddy tự cấp chứng chỉ nội bộ, trình duyệt sẽ cảnh báo).

### Biến môi trường (`.env.staging`)

| Biến | Ý nghĩa |
| --- | --- |
| `APP_ENV=staging` | Đánh dấu máy staging. Chỉ khi có biến này core-api mới cho dev-login và seed mới chạy. Production **không bao giờ** có biến này. |
| `AUTH_DEV_LOGIN=true` | Bật dev-login cho smoke/E2E. Ở production giá trị này bị bỏ qua. |
| `STAGING_DEV_LOGIN_KEY` | Khoá 16+ ký tự, gửi trong header `x-dev-login-key`. Không có khoá thì dev-login tắt hẳn (URL staging là public, dev-login mở sẽ cho ai cũng thành admin). |
| `DEMO_PASSWORD` | Mật khẩu của các tài khoản demo. |
| `DOMAIN`, `WEB_ORIGIN`, `API_PUBLIC_URL` | Domain (không có `https://`) và hai URL `https://<domain>`. |
| `POSTGRES_PASSWORD` | Mật khẩu DB. |
| `PAYMENT_*`, `SUPPORT_ZALO` | STK giả để trang thanh toán hiện được QR; số Zalo giả vì build web bắt buộc có ít nhất một kênh hỗ trợ. Đổi sang số thật nếu muốn demo kênh hỗ trợ. |
| `TELEGRAM_*` | Tuỳ chọn, xem mục 5. |
| `LLM_*` | Tuỳ chọn. Trống thì web dùng brief mẫu (đủ để demo). |

Muốn sửa biến: sửa `.env.staging` rồi chạy lại `staging-up.sh`. Biến `NEXT_PUBLIC_*` được nhúng lúc build, nên đổi `DOMAIN` hay `SUPPORT_ZALO` cần build lại (script đã làm).

## 3. Tự động deploy bằng GitHub Actions

Workflow `.github/workflows/deploy-staging.yml` chạy khi bấm tay (Actions → deploy-staging → Run workflow) và khi push vào `main`. **Chưa có secrets thì workflow kết thúc xanh với thông báo "skipped"**, không làm CI đỏ.

Cài một lần:

1. Trên VPS, tạo user chạy deploy (thuộc nhóm `docker`) và clone repo vào `~/grabcode`. Repo private: tạo deploy key chỉ đọc (`ssh-keygen -t ed25519 -f ~/.ssh/grabcode_deploy`, thêm `.pub` vào GitHub → repo → Settings → Deploy keys, cấu hình `~/.ssh/config` cho github.com dùng khoá đó).
2. Tạo cặp khoá SSH riêng cho GitHub Actions (`ssh-keygen -t ed25519 -f gha_staging`), thêm `gha_staging.pub` vào `~/.ssh/authorized_keys` của user deploy.
3. Trong repo → Settings → Secrets and variables → Actions, thêm:

| Secret | Giá trị |
| --- | --- |
| `STAGING_SSH_HOST` | IP hoặc tên máy của VPS |
| `STAGING_SSH_USER` | user deploy |
| `STAGING_SSH_KEY` | nội dung file private key `gha_staging` |
| `STAGING_DOMAIN` | `staging.grabcode.vn` |
| `STAGING_SSH_PORT` (tuỳ chọn) | mặc định 22 |
| `STAGING_SSH_KNOWN_HOSTS` (tuỳ chọn) | kết quả `ssh-keyscan -H <host>` lấy từ máy tin cậy; không có thì workflow tự lấy host key lần chạy (tin ở lần đầu) |
| `STAGING_APP_DIR` (tuỳ chọn) | thư mục clone, mặc định `~/grabcode` |

Workflow SSH vào VPS, `git checkout` đúng commit, chạy `staging-up.sh`, rồi gọi thử `https://<domain>/v1/auth/providers`. Không có khoá hay domain nào nằm trong repo.

## 4. Đăng nhập từng vai trò

Mật khẩu của mọi tài khoản demo là `DEMO_PASSWORD` (xem trong `.env.staging` hoặc cuối output của `staging-up.sh`). Đăng nhập ở `https://<domain>/login` bằng email + mật khẩu.

| Vai trò | Email | Ghi chú |
| --- | --- | --- |
| Khách hàng | `khach@staging.grabcode.test` | Có đủ đơn ở các trạng thái. Trang chủ để đặt đơn mới, `/orders` để xem đơn. |
| Freelancer có việc | `freelancer1@staging.grabcode.test` | Đã làm xong 1 đơn (ví có tiền, đã gửi 1 yêu cầu rút), đang làm 1 đơn. Mở `/coder`. |
| Freelancer rảnh | `freelancer2@staging.grabcode.test` | Đã được duyệt, chưa có việc: dùng để nhận đơn "chờ nhận" khi demo. |
| Freelancer chờ duyệt | `freelancer-cho-duyet@staging.grabcode.test` | Admin chưa duyệt: thấy được cảnh bị chặn, rồi admin duyệt ngay trong buổi demo. |
| Admin | `admin@staging.grabcode.test` | Mở `https://<domain>/admin`. |

Mở khách và freelancer ở hai cửa sổ ẩn danh khác nhau (cùng domain nên dùng chung cookie).

**Dev-login cho Tester/E2E** (không cần mật khẩu, tạo user theo tên, kể cả ADMIN):

```bash
curl -X POST https://<domain>/v1/auth/dev-login \
  -H 'content-type: application/json' -H "x-dev-login-key: $STAGING_DEV_LOGIN_KEY" \
  -d '{"login":"tester-admin","role":"ADMIN"}'
```

Khoá nằm trong `.env.staging`; chỉ đưa cho Tester qua kênh an toàn, không dán vào chat công khai.

Dữ liệu mẫu (đơn nào ở trạng thái nào):

| Đơn | Trạng thái | Dùng để demo |
| --- | --- | --- |
| Landing cà phê rang xay | DRAFT, chưa báo giá | Admin báo giá |
| Chatbot Zalo phòng khám nha khoa | DRAFT, đã báo giá 4.500.000đ | Khách thấy QR, admin xác nhận đã nhận tiền |
| Trang đặt lịch tiệm tóc | FUNDED, chưa ai nhận | Freelancer rảnh nhận đơn |
| Web bán mỹ phẩm handmade | IN_PROGRESS, mốc 1 đã nộp | Khách duyệt mốc / yêu cầu sửa |
| Website công ty nội thất | DELIVERED | Khách nghiệm thu |
| Landing khóa học tiếng Anh | ACCEPTED | Xem kết quả cuối, ví freelancer, rút tiền |

## 5. Tạo bot Telegram báo admin (tuỳ chọn, ~5 phút)

Nhờ đó mỗi đơn mới, "Tôi đã chuyển khoản", tranh chấp, yêu cầu rút tiền sẽ bắn tin vào nhóm Telegram ngay lúc demo.

1. Nhắn [@BotFather](https://t.me/BotFather) lệnh `/newbot`, đặt tên (ví dụ `GrabCode Staging Ops`) và username kết thúc bằng `bot`. BotFather trả **token** dạng `123456789:AA...` (bí mật, không gửi qua chat, không commit).
2. Tạo một nhóm Telegram, thêm bot vào, gửi một tin bất kỳ trong nhóm.
3. Mở `https://api.telegram.org/bot<TOKEN>/getUpdates`, tìm `"chat":{"id":-100...}` (số âm) là chat id.
4. Điền vào `.env.staging`: `TELEGRAM_BOT_TOKEN=...`, `TELEGRAM_ADMIN_CHAT_ID=-100...`, `ADMIN_PUBLIC_URL=https://<domain>/admin`.
5. Chạy lại `./infra/deploy/staging-up.sh`. Log notifier phải có `admin notices started (Telegram on)`. Thử bằng cách đặt một đơn mới.

Thiếu Telegram thì mọi thứ vẫn chạy: nội dung thông báo chỉ in ra log (`docker compose -p grabcode-staging logs notifier`).

## 6. Kịch bản demo 5 phút cho CEO

Chuẩn bị: mở 3 cửa sổ (khách, freelancer, admin), đã đăng nhập sẵn bằng các tài khoản ở mục 4. Nếu có Telegram, để màn hình nhóm bên cạnh.

1. **Khách đặt đơn (1 phút).** Cửa sổ khách, trang chủ: chọn một món trong menu, mô tả ngắn, xem brief, đồng ý điều khoản, đặt đơn. Đơn mới ở trạng thái chờ báo giá; Telegram (nếu có) báo "đơn mới cần báo giá".
2. **Admin báo giá (30 giây).** Cửa sổ admin, tab "Đơn hàng & thanh toán": báo giá cho đơn vừa tạo (hoặc "Landing cà phê rang xay" có sẵn): nhập giá chốt và số ngày giao.
3. **Thanh toán (1 phút).** Khách mở đơn "Chatbot Zalo phòng khám nha khoa" (đã báo giá): thấy QR VietQR đúng số tiền và nội dung chuyển khoản. Bấm "Tôi đã chuyển khoản". Admin nhận tin, vào tab "Đơn hàng & thanh toán", nhập số tiền và một mã giao dịch bất kỳ (ví dụ `FT-DEMO-01`), bấm "Xác nhận đã nhận tiền". Đơn chuyển sang đã đủ tiền.
4. **Freelancer nhận đơn (30 giây).** Đăng nhập `freelancer2`, mở `/coder`, mục "Việc đang chờ nhận": nhận đơn "Trang đặt lịch tiệm tóc" (hoặc đơn vừa thanh toán ở bước 3).
5. **Bàn giao và duyệt mốc (1 phút).** Freelancer nộp mốc 1 kèm link demo bất kỳ. Khách mở đơn "Web bán mỹ phẩm handmade" (đã có mốc 1 chờ duyệt): thử "Yêu cầu sửa" với ghi chú, rồi duyệt mốc. Tiền của mốc đó vào ví freelancer.
6. **Nghiệm thu (30 giây).** Khách mở đơn "Website công ty nội thất" (DELIVERED), nghiệm thu. Phần tiền mốc cuối (giữ tới lúc nghiệm thu) vào ví freelancer; đơn thành ACCEPTED.
7. **Admin và rút tiền (30 giây, nếu còn thời gian).** Admin: tab "Coder" duyệt `freelancer-cho-duyet`; tab "Rút tiền" duyệt yêu cầu rút của `freelancer1` sau khi "chuyển khoản tay".

Lưu ý khi nói với CEO: thanh toán hiện là chuyển khoản/VietQR do admin xác nhận tay (đúng với bản MVP sẽ ra mắt), chưa có cổng tự động; staging dùng STK giả nên không có tiền thật chạy qua.

## 7. Smoke test và E2E trên staging

Các script nằm ở `api/core-api/scripts/`, chạy từ máy bất kỳ có Node 22:

```bash
export API_URL=https://<domain> DEV_LOGIN_KEY=<STAGING_DEV_LOGIN_KEY>
node api/core-api/scripts/smoke-mvp.mjs      # toàn bộ luồng MVP (đặt đơn, báo giá, thanh toán, nhận, mốc, nghiệm thu, ví)
```

- Script tự đăng nhập bằng dev-login (gửi `x-dev-login-key` từ `DEV_LOGIN_KEY`).
- `smoke-mvp.mjs` có bước thử chặn đăng nhập sai liên tục (giới hạn 30 lần sai/IP/15 phút). Chạy lại liên tiếp sẽ dính 429 ở bước này: đợi 15 phút hoặc chạy lại sau khi `staging-reset.sh`.
- Các script còn lại (`smoke-admin`, `smoke-milestones`, `smoke-dispatch`, `smoke-auth`, `smoke-realtime`, `smoke-qa`) gọi `docker compose exec postgres psql` ở thư mục gốc repo (cổng 5433, compose dev), nên chỉ chạy trên máy dev, **không** chạy từ xa vào staging. Chúng cũng chưa được rà lại sau gói P0 (đơn giờ cần `menuItem`, admin báo giá, coder phải được duyệt): `smoke-mvp.mjs` đã được cập nhật theo P0 ở HON-26, các script kia thì chưa, có thể lỗi thời.

## 8. Reset dữ liệu

```bash
./infra/deploy/staging-reset.sh --yes
```

Xoá toàn bộ volume (Postgres, NATS, chứng chỉ Caddy), dựng lại và nạp lại dữ liệu mẫu. Script từ chối chạy nếu thấy `.env.production` trên máy mà `.env.staging` không có `STAGING_HTTP_PORT` (chế độ shared, mục 12), hoặc `.env.staging` thiếu `APP_ENV=staging`. Chỉ muốn nạp lại mà giữ DB thì không có lệnh riêng: seed bỏ qua khi dữ liệu mẫu đã có.

Seed gặp lỗi giữa chừng (log in `lần seed trước dừng giữa chừng`): chạy `staging-reset.sh --yes`.

## 9. Xem log, khởi động lại, gỡ lỗi

```bash
dc() { docker compose -p grabcode-staging --env-file .env.staging -f infra/deploy/docker-compose.prod.yml -f infra/deploy/docker-compose.staging.yml "$@"; }
export GC_ENV_FILE=$PWD/.env.staging
dc ps
dc logs -f core-api
dc restart core-api
```

- Caddy không lấy được chứng chỉ: kiểm tra DNS A đã trỏ đúng và cổng 80/443 mở.
- Build web báo lỗi thiếu kênh hỗ trợ: `SUPPORT_ZALO` hoặc `SUPPORT_HOTLINE` trong `.env.staging` đang trống.
- `docker compose` báo `APP_ENV=staging is required`: bạn đang dùng overlay staging với env file khác, hoặc `.env.staging` thiếu dòng đó.

## 10. An toàn

- Dev-login chỉ hoạt động khi đủ ba điều kiện: `APP_ENV=staging`, `AUTH_DEV_LOGIN=true`, `STAGING_DEV_LOGIN_KEY` ≥ 16 ký tự, và request phải mang đúng khoá. Production không đặt `APP_ENV`, nên `AUTH_DEV_LOGIN=true` ở đó bị bỏ qua (có test `api/core-api/src/auth/dev-login-guard.test.ts`).
- `seed-staging.mjs`, `staging-up.sh`, `staging-reset.sh` đều từ chối chạy khi không phải staging.
- Tài khoản demo có mật khẩu chung: đừng dùng staging để chứa dữ liệu khách thật.

## 11. Khoảng thiếu đã biết

- **Chưa có Centrifugo** trong compose prod (cả staging): app tự về polling 3 giây, không có realtime. Đủ cho demo, chưa ảnh hưởng luồng MVP.
- **Chưa có repo-worker, qa-worker, deploy-worker** (cần GitHub App, Docker socket, GCP). Luồng MVP bàn giao bằng link nên không cần; không demo được repo riêng cho từng đơn và sandbox preview.
- **brief-worker** chạy nhưng không có `LLM_API_KEY` thì web dùng brief mẫu.
- **Chưa có backup** cho staging (không cần cho demo).
- Chưa kiểm tra bản build image trên Docker thật; xem phần báo cáo của HON-26 để biết đã chạy được gì.

## 12. Chạy trên VPS đang có production (shared VPS)

Dùng khi chỉ có một VPS và production đang chạy sẵn trên đó (reverse proxy của bạn giữ 80/443).

**Cách hoạt động.** `staging-up.sh --port <cổng> <domain>` chạy cả stack với project `grabcode-staging` (volume `grabcode-staging_*` và network riêng; không dùng chung gì với project `grabcode` của production). Caddy của staging chạy HTTP thuần (`auto_https off`) và chỉ publish `127.0.0.1:<cổng>` (mặc định 18080), không dùng 80/443. Bạn tự trỏ domain vào cổng đó bằng reverse proxy đang có; proxy lo TLS. Script phát hiện `.env.production` thì tự vào chế độ này (mặc định cổng 18080); cũng có thể bật bằng `--port` hoặc `STAGING_HTTP_PORT`.

Script dừng với lỗi rõ khi: cổng đang bận (trừ khi là Caddy staging của chính nó), project/volume trùng tên với production, đã có stack `grabcode-staging` từ thư mục clone khác, Compose cũ hơn 2.24, hoặc không có domain thật (domain được nhúng vào bản build web).

**Cảnh báo RAM.** Lần build đầu ngốn ~3 GB RAM. Chế độ này build tuần tự (`COMPOSE_PARALLEL_LIMIT=1`, `COMPOSE_BAKE=false`) và cảnh báo nếu RAM+swap trống dưới ~3,5 GB, nhưng vẫn có thể làm production chậm hoặc bị OOM-kill trong lúc build. Nên: bật swap trước, build ngoài giờ cao điểm, kiểm tra `free -h`. Lúc chạy bình thường staging tốn thêm khoảng 1–1,5 GB RAM (Postgres, NATS, 3 app Next, các worker).

### Founder tự chạy (copy-paste trên VPS)

```bash
# 1) Swap 4 GB (bỏ qua nếu `swapon --show` đã có swap đủ lớn)
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
# 2) Lấy code (repo private: dùng deploy key, xem mục 3)
git clone https://github.com/dsqt99/grabcode.git ~/grabcode-staging && cd ~/grabcode-staging
# 3) Dựng staging ở cổng 18080 (đổi domain thành domain staging của bạn)
./infra/deploy/staging-up.sh --port 18080 staging.example.com
```

Cuối output script in "Cổng để map domain: 18080" kèm cấu hình mẫu. Ví dụ nginx (đã có TLS cho `staging.example.com`):

```nginx
# ở cấp http {}
map $http_upgrade $connection_upgrade { default upgrade; '' close; }

server {
    # ... listen 443 ssl; server_name staging.example.com; ssl_certificate ...
    location / {
        proxy_pass http://127.0.0.1:18080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
    }
}
```

Hoặc Caddy:

```caddy
staging.example.com {
    reverse_proxy 127.0.0.1:18080
}
```

Quan trọng: giữ `Host` và `X-Forwarded-Proto: https` (nginx cần các `proxy_set_header` ở trên; Caddy làm sẵn). Thiếu thì cookie đăng nhập và redirect sai. Nếu proxy của bạn chạy trong container Docker (không tới được `127.0.0.1` của host), thêm `--public` (bind `0.0.0.0`; chặn cổng này từ internet bằng firewall) hoặc trỏ proxy tới IP bridge của host.

Realtime: hiện chưa có Centrifugo trong compose (mục 11), app dùng polling nên không cần WebSocket; cấu hình trên vẫn sẵn Upgrade cho sau này.

### Chạy sau reverse proxy: cookie, CORS, IP

- `DOMAIN`, `WEB_ORIGIN`, `API_PUBLIC_URL` đều là `https://<domain>` (script tự điền): CORS và cookie `secure` khớp với địa chỉ trình duyệt thấy.
- Có hai lớp proxy (proxy của bạn → Caddy → app), nên script đặt `TRUST_PROXY=2` cho core-api để IP client (rate limit đăng nhập) lấy đúng từ `X-Forwarded-For`.
- Caddy staging tin `X-Forwarded-*` chỉ từ dải IP trong `STAGING_TRUSTED_PROXIES` (mặc định `private_ranges`, tức mọi proxy cục bộ/docker). Proxy của bạn ở IP public khác (dùng `--public` từ máy khác): đặt `STAGING_TRUSTED_PROXIES=<IP proxy>` trong `.env.staging`.
- Next.js nhận `Host` và `X-Forwarded-Proto` do Caddy chuyển tiếp nguyên vẹn.

### Chạy bằng GitHub Actions (SSH)

Thêm secret `STAGING_HTTP_PORT` (ví dụ `18080`) bên cạnh các secret ở mục 3 (`STAGING_BIND_PUBLIC=true` nếu cần `--public`). Workflow sẽ gọi `staging-up.sh --port ...`, rồi kiểm tra `http://127.0.0.1:<cổng>/v1/auth/providers` ngay trên VPS qua SSH (không phụ thuộc domain đã map xong chưa). Cẩn thận: workflow tự chạy ở mỗi push vào `main`, tức build ~3 GB RAM trên VPS đang chạy production. Trên VPS dùng chung nên chỉ chạy tay (xoá `push:` trong workflow hoặc không đặt secret cho tới khi sẵn sàng).

### Cập nhật, tắt, gỡ

```bash
cd ~/grabcode-staging && git pull && ./infra/deploy/staging-up.sh      # nhớ cổng/domain từ .env.staging
docker compose -p grabcode-staging down                                # tắt, giữ dữ liệu
./infra/deploy/staging-reset.sh --yes                                  # xoá dữ liệu staging và nạp lại seed
docker compose -p grabcode-staging down -v                             # gỡ hẳn (chỉ volume grabcode-staging_*)
```

Lệnh `docker compose -p grabcode-staging ...` ở mục 9 cần thêm `-f infra/deploy/docker-compose.staging-shared.yml` khi ở chế độ này.
