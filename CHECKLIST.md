# GrabCode — Checklist tiến độ

> Cập nhật **ngay khi xong mỗi việc** (Nguyên tắc 5 trong `CLAUDE.md`): tick, ghi commit hash ngắn, thêm việc mới phát sinh.
> Ký hiệu: `[x]` xong · `[~]` đang làm / làm dở · `[ ]` chưa làm · 👤 cần chủ dự án làm (tài khoản, secret, quyết định).
> Thứ tự sprint theo phụ thuộc: S1 → S2 → S3 → S4 → S5 / S6 / S7.
> Mỗi việc làm theo contract-first: `contracts` → `generate` → `api` → `worker` → `app`.

**Đang ở (HON-8, branch `feat/hon-8-mvp-vn`):** MVP thị trường VN — thu tiền bằng chuyển khoản/VietQR (admin xác nhận tay), bảng việc cho freelancer, bàn giao bằng link, gỡ số liệu marketing giả, bảng giá một chỗ, vá bảo mật, deploy 1 VPS (`docs/DEPLOY.md`). Trước đó: S4 Milestone & nghiệm thu xong (giữ milestones trong jsonb; bàn giao repo chờ GitHub App để test). S3 matching chạy in-process TS, Go service hoãn. S2 chờ 👤 tài khoản SePay để test tiền thật. S0 còn việc 👤 GitHub App → test webhook → PR. S5 xong phần code (QA Gate chạy thật bằng Docker; sandbox chờ 👤 GCP). S6 realtime + chat xong; `notifier` chờ 👤 Zalo/FCM/VAPID. S7 Admin portal xong (cấu hình AI/bảng giá DB hoãn). **Tiếp theo:** nợ còn lại + việc 👤.

---

## S0 — Nền tảng (branch `feat/s0-backend-core`)

### UI POC (mock)
- [x] Scaffold Next.js 15 web + coder, design tokens, proxy same-origin — `13b2429`
- [x] Contracts ban đầu: shared types, events, seed data — `7542ec3`
- [x] Web: landing + instant dispatch — `16dc3a0`
- [x] Web: AI brief generator + escrow checkout (mock) — `8adb1b5`
- [x] Web: theo dõi đơn live, sandbox preview, chat (mock) — `fea3c7a`
- [x] Coder PWA: driver dashboard, radar, wave offer (mock) — `61a7af9`

### Backend S0
- [x] pnpm workspace (bỏ turbo), docker-compose Postgres `5433` + NATS `4223`, `.env.example` — `db08fe8`
- [x] Bỏ qua `credentials/`, `.turbo/` trong `.gitignore` — `db08fe8`
- [x] Contracts zod → OpenAPI 3.1 + JSON Schema events (`generate`) cho auth, brief, repo — `23bb6c3`
- [x] Transactional outbox + `outbox-relay` sang NATS JetStream — `f11d7d3`
- [x] Auth: email/mật khẩu (scrypt), Google, GitHub OAuth, session `gc_session`, roles, dev login — `97d247a`
- [x] Trang `/login` chung, gate theo role, `/profile` (liên hệ, Coder, doanh nghiệp, đổi mật khẩu) — `4bd49e4`
- [x] Luồng AI brief: `POST /v1/briefs` → brief-worker (LLM) → poll; fallback brief mẫu — `97d247a`, `f11d7d3`
- [x] Repo-worker GitHub App: tạo repo private, `CLAUDE.md`, branch protection, mời coder; webhook push ký HMAC — `97d247a`, `f11d7d3`
- [x] Coder workspace dùng repo thật (clone URL, trạng thái, Thử lại) — `4bd49e4`
- [x] File `CHECKLIST.md` + Nguyên tắc 5 trong `CLAUDE.md` — `89bf74e`

### Còn lại để đóng S0
- [x] 👤 Tạo GitHub App trên org `grabcode-sandbox` (quyền Administration RW, Contents RW, Metadata R; event Push), cài vào org — events `push`, webhook → smee
- [x] 👤 Điền `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY_PATH`, `GITHUB_APP_WEBHOOK_SECRET` trong `.env`
- [x] Webhook local qua smee.io / ngrok → `/v1/github/webhook`; test 1 đơn end-to-end (repo tạo, coder được mời, push hiện commit) — GC-1074: repo `gc-1074` private + `CLAUDE.md` + mời `dsqt99` OK, push thật qua smee → `core.repo_commits` (author `dsqt99`)
- [x] Commit `CLAUDE.md` đầu tiên không vào timeline (push tới trước READY): webhook khớp `gc-<n>` với order_repos PENDING — `d70d2bb`
- [x] Xoá dòng test `GC-3428` (FAILED) trong `core.order_repos` (migration 0006 xoá repo không có đơn) — `b73486c`
- [ ] Mở PR `feat/s0-backend-core` → `main`

---

## S1 — Order core (thay mock đơn hàng)

- [x] Contract: `Order`, `OrderStatus`, `OrderCreate`, events `order.created|funded|dispatched|delivered|accepted|disputed` — `e449228`
- [x] API: bảng `core.orders` (+ milestones của đơn) + migration — `f8665de`
- [x] API: state machine DRAFT → FUNDED → DISPATCHED → IN_PROGRESS → DELIVERED → ACCEPTED / DISPUTED, chặn chuyển trạng thái sai (409) — `f8665de`
- [x] API: `POST /v1/orders`, `GET /v1/orders/:id`, `GET /v1/orders` (khách: đơn của mình; coder: đơn được giao) — `f8665de`
- [x] API: tách module NestJS theo domain (auth, briefs, repos, orders) — hết shortcut `main.ts:15` — `f8665de`
- [x] Phân quyền `GET /v1/repos/:orderId` chỉ khách + coder của đơn — hết shortcut `repos.controller.ts:48` — `f8665de`
- [x] `POST /v1/repos` kiểm coder đúng là người được giao đơn — `f8665de`
- [x] Web: đặt đơn + trang đơn gọi API, bỏ localStorage (`ORDERS_KEY`, `loadOrders`) — `cdcb2f2`
- [x] Coder: đơn đang làm lấy từ API, bỏ `coderStore` mock — `cdcb2f2`
- [x] Coder: tier/rating lấy từ hồ sơ Coder trong core-api — hết shortcut `DriverHeader.tsx:28` — `cdcb2f2`
- [x] Test state machine (chuyển hợp lệ / bị chặn) — `f8665de`
- [x] Nợ S1: `core.order_repos` FK sang `core.orders` — `b73486c`
- [x] Nợ S1: checkout web bỏ phí 5% tự bịa, tổng = giá server (nền tảng giữ 30% qua `payoutVnd`) — `c686c0a`
- [x] Nợ S1: `OrderDto.coder.stats` (tier, số đơn, rating null tới S4) — `dcfa2a6`, `b73486c`, `c686c0a`
- [x] Nợ S1: `POST /v1/orders` bắt brief có ≥1 milestone (400); `GENERIC_MILESTONES` chỉ còn cho đơn mock cũ — `dcfa2a6`

## S2 — Ledger ký quỹ (SePay chuyển khoản ngân hàng)

- [x] Chọn cổng thanh toán: SePay (webhook biến động số dư, nội dung CK = mã đơn không gạch, VD `GC1006`) — `01911ed`
- [x] 👤 Tạo tài khoản SePay, liên kết tài khoản ngân hàng nhận, cấu hình mã thanh toán tiền tố `GC`
- [x] 👤 SePay → Webhooks: URL `{API_PUBLIC_URL}/v1/payments/sepay/webhook` (cần URL public: ngrok/smee), xác thực "API Key"; điền `SEPAY_WEBHOOK_API_KEY`, `SEPAY_BANK`, `SEPAY_ACCOUNT_NUMBER`, `SEPAY_ACCOUNT_NAME` trong `.env` — env đủ; webhook ký bằng key thật: sai key 401, TK khác bỏ qua, đúng → FUNDED, gửi lại không cộng 2 lần; QR `qr.sepay.vn` OK. Local public: `cloudflared tunnel --url http://localhost:4000` (tắt `AUTH_DEV_LOGIN`)
- [~] Test 1 giao dịch thật end-to-end (CK nhỏ → đơn DISPATCHED) — chờ 👤 CK 10.000đ nội dung `GC1077` qua tunnel
- [x] Contract: `SepayWebhook`, `PaymentInstructions`, `Wallet`, events `escrow.deposited|released`; DRAFT → FUNDED thành cạnh SYSTEM — `01911ed`
- [x] API: ledger double-entry `core.ledger_txs` / `core.ledger_entries` (migration 0007), tx id = idempotency key (`sepay:<id>`, `release:<orderId>`, `dev:<uuid>`) — `1ff520b`
- [x] API: webhook SePay (`Authorization: Apikey`, so sánh constant-time, bỏ qua `out` / sai tài khoản, mã không khớp → `suspense`) — `1ff520b`
- [x] API: FUNDED chỉ khi escrow ≥ giá → tự DISPATCHED; bỏ shortcut client tự FUNDED (`orders.service.ts`, `viewOrder.ts` escrowStatus) — `1ff520b`, `27d94c1`
- [x] API: ACCEPTED nhả tiền: 70% vào `coder:<id>`, còn lại `platform:revenue`; `GET /v1/me/wallet` — `1ff520b`
- [x] API: `GET /v1/orders/:id/payment` (QR `qr.sepay.vn`), `POST /v1/payments/dev-deposit` (chỉ khi `AUTH_DEV_LOGIN`) — `1ff520b`
- [x] Web: panel chuyển khoản (QR, STK, nội dung, số còn thiếu, nút giả lập dev) thay ký quỹ giả — `27d94c1`
- [x] Coder: ví + thu nhập hôm nay lấy từ ledger thay ví local — `27d94c1`
- [x] Test ledger: tổng luôn cân, chia tiền nhả; smoke: CK trùng id không cộng 2 lần, CK thiếu giữ DRAFT — `1ff520b`

## S3 — Dispatch + Matching

- [x] Contract: `DispatchOffer`/`OfferList`/`Presence`, events `dispatch.requested|offered|accepted|expired` (475ea2c)
- [x] Matching: chấm điểm coder (online + heartbeat 60s, chưa bận, chưa từ chối; ưu tiên chưa hỏi → nhận nhiều → hoạt động gần nhất), wave 3 coder / 30s (6eeec73)
  - Lệch kế hoạch: chạy in-process trong core-api (TS, sweep 2s, `FOR UPDATE SKIP LOCKED`) thay vì Go `api/matching` — máy chưa có Go/Redis
- [ ] `api/matching` Go 1.23 + Redis (tách ra khi cần latency thấp / nhiều coder)
- [x] API: `GET /v1/me/offers`, `POST /v1/offers/:id/accept|decline`; hết hạn → wave sau; chỉ 1 coder nhận được; bỏ claim `DISPATCHED→IN_PROGRESS` + open pool (6eeec73)
- [x] Coder: offer thật thay giả lập (`WaveOfferModal`) — poll `/v1/me/offers` (kiêm heartbeat) (da40a03)
- [x] Coder: trạng thái online/offline lưu server `PUT /v1/me/presence` (6eeec73, da40a03)
- [x] Test: 2 coder nhận cùng lúc → chỉ 1 thắng — `pnpm --filter @grabcode/core-api smoke:dispatch` 17 check (6eeec73, 87a517e)
- [x] Push offer qua Centrifugo thay vì poll — `2fe55c7`
- [x] Đơn đã nạp mà 30 phút không coder nào nhận → hiện ở tab Orders của admin, admin hoàn tiền + huỷ (offer mở hết hạn) — `0e34333` `e46db66` `a589ef7`
- [x] Web cảnh báo khách khi đơn chờ quá 30 phút; core-api tự huỷ + hoàn sau `AUTO_REFUND_HOURS` (mặc định 24h, quét 10 phút) — `81de9d0` `4582008`
- [x] Đồng hồ offer: API trả `secondsLeft` theo giờ DB, client đếm theo đó — `63ddacc` `5711771` `18ab6ed`

## S4 — Milestone & nghiệm thu

- [x] Contract: `MilestoneSubmit/Reject`, status `SUBMITTED`, `milestoneShare`, events `milestone.submitted|approved|rejected`, `repo.handover.requested|handed_over`, `disputeReason` — 79c13e3
- [x] Coder: nộp mốc (`POST …/milestones/:id/submit`) gắn commit SHA mới nhất; API chỉ nhận SHA có trong `core.repo_commits` của đơn (prefix → full sha) — 2dcf509, efed16b
- [x] ~~API: tách milestones sang bảng riêng~~ **Quyết định giữ jsonb** `orders.brief.milestones`: mọi thao tác mốc chạy dưới row lock `orders FOR UPDATE`, idempotency nằm ở ledger tx id `release:<order>:<milestone>` — không cần bảng riêng — 2dcf509
- [x] Web: khách duyệt / yêu cầu sửa (bắt buộc ghi chú) từng mốc → duyệt nhả đúng phần ký quỹ của mốc (`milestoneShare`, tổng khớp giá); ACCEPTED quét nhả nốt mốc chưa trả (đơn cũ) — 2dcf509, efed16b
- [x] Tranh chấp: khách mở `IN_PROGRESS|DELIVERED → DISPUTED` kèm lý do (`orders.dispute_reason`), DISPUTED chặn duyệt mốc → ký quỹ còn lại bị khoá; banner lý do trên web — 2dcf509, efed16b
- [x] Bàn giao: ACCEPTED + repo READY → outbox `repo.handover.requested` → repo-worker cho khách quyền admin, hạ coder xuống pull → `repo.handed_over` → `order_repos.handed_over_at/to` — b4f40d7. test thật GC-1074 (GitHub App): 202 → `handed_over_to=dsqt99`; khách và coder cùng 1 tài khoản nên chỉ chứng minh API mời admin + hạ quyền chạy được
- [x] Admin xử lý tranh chấp (hoàn tiền / nhả tiền phần còn khoá) — làm ở S7 `4845b21`
- [x] Bàn giao khi khách không có GitHub login (hoặc lời mời bị từ chối): đơn ACCEPTED hiện nút "Nhận repo", khách nhập username → `POST /v1/repos/:orderId/handover` → repo-worker mời admin; kết quả trễ không xoá login đã giao — `a1ce99a`
- Smoke: `node api/core-api/scripts/smoke-milestones.mjs` (core-api chạy, `AUTH_DEV_LOGIN=true`)

## S5 — Workers bàn giao

- [x] Contract: `qa` theo mốc, `sandbox` theo đơn, event `qa.*` / `deploy.*` — `274f203`
- [x] API: nộp mốc → `qa.requested`; DELIVERED → `deploy.requested`; nhận kết quả về `brief.milestones[].qa` / `orders.sandbox` — `1da6a1b`
- [x] `qa-worker`: quét secret + install/lint/typecheck/build/test/audit, mỗi bước 1 container Docker (giới hạn RAM/CPU/pids, checkout không có `.git`); kết quả gắn vào mốc — `b533e51`
- [x] UI: badge QA + check lỗi theo mốc (web + coder), `SandboxFrame` iframe URL thật / đang dựng / lỗi / hết hạn — `af6546a`
- [x] Smoke `api/core-api/scripts/smoke-qa.mjs` (repo bare local qua `GIT_CLONE_BASE`): lộ `.env` → FAILED, sửa → PASSED, sandbox FAILED khi chưa có GCP — `4463cb4`
- [ ] 👤 Tài khoản GCP + project cho Cloud Run sandbox (`gcloud auth login`, bật Cloud Run + Cloud Build, điền `GCP_PROJECT`)
- [~] `deploy-worker`: `gcloud run deploy --source` → `deploy.ready` URL cho `SandboxFrame` — code xong `b533e51`, chưa deploy thật (chờ GCP)
- [~] Dọn sandbox hết hạn: tick 10 phút xóa service quá `SANDBOX_TTL_HOURS` (72h) → `deploy.expired` — code xong `b533e51`, chưa test với GCP
- [x] QA: lint/typecheck/test chạy `--network none`; install, build (next/font), audit vẫn có mạng; pnpm từ cache corepack theo gate — `2886397`
- [x] QA FAILED chặn khách duyệt mốc (409, nút Duyệt tắt), vẫn yêu cầu sửa được; ERROR/RUNNING không chặn để lỗi hạ tầng QA không giam tiền — `0d8c2d5` `24fa251`

## S6 — Realtime & thông báo

- [x] Contract: `RealtimeHint` / `RealtimeToken`, chat schemas + endpoints, client Centrifugo dùng chung (WebSocket thô, không SDK) — `ed1fa04` `a06df7b` `7a72052`
- [x] Centrifugo v6 trong docker-compose; trigger Postgres ghi hint vào `centrifugo_outbox` (cùng transaction, phủ API + worker consumer + webhook), kênh `user.<id>`; `GET /v1/realtime/token` (JWT HS256) — `7912d57`
- [x] Chat khách ↔ coder lưu Postgres (`core.order_messages`), `GET/POST /v1/orders/:id/messages`, chỉ 2 bên của đơn — `7912d57`
- [x] Web + coder: hint → refetch REST (đơn, thanh toán, repo/commit, offer, chat); poll giữ làm lưới an toàn 30s khi socket sống, 3s khi không — `2fe55c7`
- [x] Smoke `api/core-api/scripts/smoke-realtime.mjs`: hint order/chat tới đúng user, user khác không nhận, chat 400/404 — `c63070f`
- Brief vẫn poll: brief job ẩn danh (landing chưa login), không có kênh user
- [x] Token refresh tại chỗ trước hạn (`refresh` command, kiểm với Centrifugo thật) — `b6b4773`; hint lỡ khi offline không replay: socket không live thì poll 3s đã bù
- [x] `centrifugo_outbox` phình nếu Centrifugo không chạy → core-api xoá hint quá 10 phút, mỗi 10 phút — `a83414c`
- [x] Coder app verify trên browser: offer mới → fetch `/v1/me/offers` sau 85 ms và 0,7 s (poll đang 30 s) → modal offer hiện, từ chối OK
- [ ] 👤 Tài khoản Zalo ZNS, Firebase (FCM) — VAPID WebPush tự sinh được (`npx web-push generate-vapid-keys`), không cần 👤
- [~] `notifier`: WebPush xong — order.* + dispatch.offered → người liên quan có `notifications.push` bật, mọi trình duyệt đã đăng ký (`core.push_subscriptions`, nút bật/tắt ở `/profile`, `public/sw.js`), 404/410 tự xoá endpoint — c978a30 018277c bd84a77 45e180d. Test: push service giả (https) giải mã đúng payload, VAPID header OK; **chưa test Chrome thật** (pane không cho service worker). Chat push: `chat.posted` (outbox cùng transaction với tin) → bên kia (khách → `/order/<id>`, coder → `/coder`) — 6ef4c0b 2c82652 b0869ce, e2e push giả OK. Còn Zalo ZNS, FCM (chờ 👤)

## S7 — Admin portal

- [x] App `apps/admin` (Next.js 15, mở qua web `/admin`) + role ADMIN trong contract / API — `9ad6df4` `4845b21` `c4e59d0`
- [x] Quản lý coder tier (override), khoá / mở coder (khoá = offline, không nhận wave) — `4845b21` `c4e59d0`
- [x] Giải quyết tranh chấp: chia escrow hoàn khách / nhả coder qua ledger, DISPUTED → RESOLVED — `4845b21` `c4e59d0`
- [x] Đối soát tài khoản `suspense` (CK sai nội dung / không khớp đơn) — gán vào đơn hoặc hoàn — `4845b21` `c4e59d0`
- [x] Hoàn tiền thừa / huỷ đơn DRAFT đã nạp một phần → CANCELLED — `4845b21` `c4e59d0`
- [x] Coder rút tiền từ ví về ngân hàng (payout, duyệt thủ công) — `4845b21` `c4e59d0` `67c48b0`
- [x] Giám sát worker / queue (JetStream consumer lag, job FAILED, thử lại repo) — `4845b21` `c4e59d0`
- [x] Smoke `scripts/smoke-admin.mjs` (34 check) — `3a04826`
- [ ] Cấu hình AI model & bảng giá (đọc từ DB thay `.env`) — hoãn: bảng giá dùng chung với ước tính ở web qua contracts, chuyển DB phải đổi cả web + API
- [x] Thử lại sandbox FAILED từ admin (cùng repo) — `fa92323` `3d393a1` `abe9c8f`; brief không retry (khách tạo lại ở web), QA chạy lại khi coder nộp lại
- [ ] Chuyển khoản payout tự động (hiện admin CK tay rồi bấm duyệt) — chờ 👤: cần API chi hộ (hợp đồng doanh nghiệp với ngân hàng/cổng chi hộ); SePay chỉ báo tiền vào

---

## Xuyên suốt

- [x] Root có `pnpm typecheck` (alias `pnpm -r lint` = `tsc --noEmit`) — `e06534b`; lint thật xem dòng ESLint
- [x] ESLint: `eslint.config.mjs` root (typescript-eslint recommended + react-hooks), `pnpm lint` chạy trong CI — 6231612
- [x] CI GitHub Actions: install, check contract drift, typecheck, test trên mỗi PR — `25fef4e` (chưa chạy trên GitHub, branch chưa có PR)
- [x] `.gitattributes` cố định line ending LF — `e06534b`
- [x] Một lệnh chạy cả stack local: `pnpm stack` (compose --wait + migrate + dev) — `00303ec`
- [x] Test API: unit (scrypt, chữ ký webhook, parse login GitHub) + `smoke-auth.mjs` (đăng ký/login/đổi mật khẩu/session hết hạn, briefs, repos: chữ ký sai, push trùng lưu 1 lần) — `353846a`
- [x] `POST /v1/briefs` công khai (landing trước login) → giới hạn 20 brief/IP/giờ, quá thì 429, web tự fallback brief mẫu — `1bd5659`
- [x] Dockerfile chung `infra/node-service.Dockerfile` (`PKG` = core-api / worker), non-root, đã build + chạy thử core-api, outbox-relay — `f6a2d0c`
- [x] Image Next.js web/coder/admin: `infra/next-app.Dockerfile` (đã build + chạy thử web) — 8ca643b
- [ ] 👤 Deploy thật: Cloud Run service cho core-api/workers/apps, Secret Manager cho secret `.env` (cần project GCP)

## MVP VN (HON-8) — branch `feat/hon-8-mvp-vn`

- [x] Bảng giá + tỷ lệ chia doanh thu một chỗ: `packages/contracts/src/schemas/pricing.ts`; `orders.payout_vnd` chốt theo đơn (migration 0017) — `112b2fd` `1216634`
- [x] Thu tiền: QR VietQR (`img.vietqr.io`, env `PAYMENT_*`), admin "Xác nhận đã nhận tiền" `POST /v1/admin/orders/:id/confirm-payment` (idempotent theo mã GD), tab Đơn hàng có DRAFT chờ thanh toán + "Tất cả đơn" — `112b2fd` `1216634`
- [x] Bảng việc freelancer `GET /v1/jobs`, `POST /v1/jobs/:id/claim` (song song với wave offer) — `112b2fd` `1216634`
- [x] Bàn giao mốc bằng link (`deliveryUrl`, chỉ http/https) — `112b2fd` `1216634`
- [x] Gỡ số liệu giả (500+ coder, 4.9/5, testimonial, "2–8 giờ", "hoàn 100%", nhãn Claude Sonnet, thẻ quốc tế) — `33e91b2`
- [x] Bảo mật: id mốc do server đặt (id trùng làm coder mất tiền), throttle login/brief nguyên tử, khoá tài khoản = đăng xuất + chặn, open redirect `?next=`, header chống clickjacking, QA scan bỏ symlink, push endpoint allowlist (SSRF), sandbox bắt buộc service account không quyền — `1216634` `7d2a510` `112b2fd`
- [x] Smoke `api/core-api/scripts/smoke-mvp.mjs` (36 check) — `1216634`
- [x] Deploy 1 VPS: `infra/deploy/docker-compose.prod.yml` + Caddy (HTTPS) + `env.production.example`, hướng dẫn `docs/DEPLOY.md`
- [ ] 👤 VPS + tên miền, điền `.env.production` (tài khoản ngân hàng nhận tiền), tạo tài khoản ADMIN
- [ ] 👤 (tuỳ chọn) SePay webhook để xác nhận tự động; LLM key cho AI brief
- [ ] MoMo / VNPay (cần hợp đồng merchant) — cách làm ở `docs/DEPLOY.md` mục 4
- [ ] Thông báo admin khi có đơn mới / khách báo đã chuyển (Zalo/Telegram/email)
- [ ] Upload file bàn giao trực tiếp (hiện dùng link Drive)
- [ ] Đánh giá sau nghiệm thu (rating thật thay cho `null`)

## Ra mắt VN — P0-A an toàn tiền (HON-19) — branch `feat/p0a-money-safety`

- [x] B1: tự hoàn 24h + danh sách chờ 30 phút tính từ `orders.funded_at` (không phải `created_at`); test PGlite AC1 — b51e2ce
- [x] B2: mọi bút toán hoàn cho khách mở dòng `core.refunds` (PENDING); tab admin "Chờ chuyển trả", "Đã chuyển" + mã GD (unique); khách nhập STK nhận hoàn ở trang đơn — b51e2ce
- [x] P0-10: `GET /v1/admin/orders/:id` chỉ đọc (prompt, brief, mốc, chat, sổ cái, STK); non-admin 403 — b51e2ce
- [x] Trang đơn theo `OrderDto.status` gốc, stepper có "Thanh toán", ConfirmSheet trước khi trả tiền, chỉ VND ở màn tiền, bỏ số tiền trả coder khỏi chat khách — c7538c7
- [x] Admin: bắt buộc nhập số tiền đã nhận / số hoàn khi chốt tranh chấp, confirm ghi rõ hai bên
- [ ] 👤 Vận hành xác nhận câu chữ trạng thái CANCELLED/RESOLVED và quy trình chuyển trả
- [x] Q2 (founder): giữ mốc cuối tới khi nghiệm thu — làm ở HON-21 (P0-C)

## Ra mắt VN — P0-C quyết định founder (HON-21) — branch `feat/p0c-founder-decisions`

- [x] P0-3 / Q2: duyệt mốc cuối không nhả tiền, giữ tới ACCEPTED (`releasesOnApproval`); test PGlite — 299747d
- [x] P0-3 / B3: "Yêu cầu sửa" sau bàn giao bắt buộc ghi chú ≥10 ký tự, mở lại mốc cuối kèm ghi chú (app coder hiện), coder nộp lại link + ghi chú — 299747d
- [x] P0-3 / B4: tranh chấp sau bàn giao còn phần mốc cuối để chia; trang đơn "Đã giải ngân X / tổng Y"; sheet duyệt mốc cuối ghi rõ tiền giữ tới nghiệm thu — a1dafb3
- [x] P0-7 / Q3: menu 13 món HON-9 trong `pricing.ts` (giá từ, số ngày); bỏ 4 gói + `PROMPT_SURCHARGE`; admin báo giá đơn DRAFT (`POST /v1/admin/orders/:id/quote`); chưa báo giá thì không QR, không FUNDED; migration 0019 coi đơn cũ đã báo giá — 299747d a1dafb3
- [x] P0-4 / Q5: notifier gửi Telegram cho admin (`order.created`, `payment.reported`, `order.disputed`, `payout.requested`), idempotent theo event_id, thiếu env thì chỉ log; DEPLOY.md 3.8 — 20895cb
- [ ] P0-4: phát `payment.reported` từ nút "Tôi đã chuyển khoản" (HON-20 / P0-B; contract đã có)
- [ ] Báo khách khi admin báo giá xong (hiện khách thấy khi mở lại trang đơn; admin gọi theo SĐT)
- [ ] `tier` (4 gói cũ) còn trong DB/contract làm trường kế thừa mặc định `STANDARD`: gỡ hẳn khi dọn brief-worker
- [ ] 👤 Founder duyệt `CODER_PAYOUT_RATE` (HON-9 đề xuất 75%, đang 70%)

## Nợ kỹ thuật (từ comment `shortcut:` trong code)

- [x] Rate limit login: 10 lần sai / email, 30 / IP trong 15 phút → 429 — `91e898b` `a83414c`
- [x] `TRUST_PROXY` (vd `1` trên Cloud Run) bật express trust proxy để `req.ip` là IP khách — `52614af`
- [x] Rate limit dùng chung giữa replica: bộ đếm trong Postgres `core.rate_limits` (upsert atomic, không thêm Redis) — 5c03f28
- [x] Liên kết tài khoản giữa các provider: nút Liên kết ở /profile khi đang login (`?link=1`, `core.user_identities`), không gộp theo email — 5e0f38d
- [x] Gộp `RequireAuth` + `lib/auth.tsx` của web và coder vào `packages/auth-ui` (`@grabcode/auth-ui`) — 0f8e8a6
- [x] Múi giờ đầy đủ (`Intl.supportedValuesOf`) trong `/profile`, contract từ chối múi giờ lạ (400) — `d4cd6a6` `39b366c`
