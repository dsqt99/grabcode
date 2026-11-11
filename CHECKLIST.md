# GrabCode — Checklist tiến độ

> Cập nhật **ngay khi xong mỗi việc** (Nguyên tắc 5 trong `CLAUDE.md`): tick, ghi commit hash ngắn, thêm việc mới phát sinh.
> Ký hiệu: `[x]` xong · `[~]` đang làm / làm dở · `[ ]` chưa làm · 👤 cần chủ dự án làm (tài khoản, secret, quyết định).
> Thứ tự sprint theo phụ thuộc: S1 → S2 → S3 → S4 → S5 / S6 / S7.
> Mỗi việc làm theo contract-first: `contracts` → `generate` → `api` → `worker` → `app`.

**Đang ở:** S4 Milestone & nghiệm thu xong (giữ milestones trong jsonb; bàn giao repo chờ GitHub App để test). S3 matching chạy in-process TS, Go service hoãn. S2 chờ 👤 tài khoản SePay để test tiền thật. S0 còn việc 👤 GitHub App → test webhook → PR. **Tiếp theo:** S5 Workers bàn giao.

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
- [ ] 👤 Tạo GitHub App trên org `grabcode-sandbox` (quyền Administration RW, Contents RW, Metadata R; event Push), cài vào org
- [ ] 👤 Điền `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY_PATH`, `GITHUB_APP_WEBHOOK_SECRET` trong `.env`
- [ ] Webhook local qua smee.io / ngrok → `/v1/github/webhook`; test 1 đơn end-to-end (repo tạo, coder được mời, push hiện commit)
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
- [ ] 👤 Tạo tài khoản SePay, liên kết tài khoản ngân hàng nhận, cấu hình mã thanh toán tiền tố `GC`
- [ ] 👤 SePay → Webhooks: URL `{API_PUBLIC_URL}/v1/payments/sepay/webhook` (cần URL public: ngrok/smee), xác thực "API Key"; điền `SEPAY_WEBHOOK_API_KEY`, `SEPAY_BANK`, `SEPAY_ACCOUNT_NUMBER`, `SEPAY_ACCOUNT_NAME` trong `.env`
- [ ] Test 1 giao dịch thật end-to-end (CK nhỏ → đơn DISPATCHED)
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
- [ ] Push offer qua Centrifugo thay vì poll
- [ ] Đơn không có coder nào online: chờ vô hạn — cần cảnh báo khách / admin, hoàn tiền sau N giờ
- [ ] Đồng hồ offer: client kẹp theo 30s; nên trả `secondsLeft` từ API nếu lệch giờ client/DB

## S4 — Milestone & nghiệm thu

- [x] Contract: `MilestoneSubmit/Reject`, status `SUBMITTED`, `milestoneShare`, events `milestone.submitted|approved|rejected`, `repo.handover.requested|handed_over`, `disputeReason` — 79c13e3
- [x] Coder: nộp mốc (`POST …/milestones/:id/submit`) gắn commit SHA mới nhất; API chỉ nhận SHA có trong `core.repo_commits` của đơn (prefix → full sha) — 2dcf509, efed16b
- [x] ~~API: tách milestones sang bảng riêng~~ **Quyết định giữ jsonb** `orders.brief.milestones`: mọi thao tác mốc chạy dưới row lock `orders FOR UPDATE`, idempotency nằm ở ledger tx id `release:<order>:<milestone>` — không cần bảng riêng — 2dcf509
- [x] Web: khách duyệt / yêu cầu sửa (bắt buộc ghi chú) từng mốc → duyệt nhả đúng phần ký quỹ của mốc (`milestoneShare`, tổng khớp giá); ACCEPTED quét nhả nốt mốc chưa trả (đơn cũ) — 2dcf509, efed16b
- [x] Tranh chấp: khách mở `IN_PROGRESS|DELIVERED → DISPUTED` kèm lý do (`orders.dispute_reason`), DISPUTED chặn duyệt mốc → ký quỹ còn lại bị khoá; banner lý do trên web — 2dcf509, efed16b
- [~] Bàn giao: ACCEPTED + repo READY → outbox `repo.handover.requested` → repo-worker cho khách quyền admin, hạ coder xuống pull → `repo.handed_over` → `order_repos.handed_over_at/to` — b4f40d7. **Chưa test thật** (cần 👤 GitHub App); smoke chỉ kiểm tra event được phát
- [ ] Admin xử lý tranh chấp (hoàn tiền / nhả tiền phần còn khoá) — sang S6 admin portal
- [ ] Bàn giao khi khách không có GitHub login: hiện chỉ log cảnh báo, repo nằm lại org; cần transfer repo hoặc UI nhập login
- Smoke: `node api/core-api/scripts/smoke-milestones.mjs` (core-api chạy, `AUTH_DEV_LOGIN=true`)

## S5 — Workers bàn giao

- [ ] `qa-worker`: build, test, static analysis, security scan; kết quả gắn vào mốc
- [ ] 👤 Tài khoản GCP + project cho Cloud Run sandbox
- [ ] `deploy-worker`: deploy sandbox preview Cloud Run, trả URL cho `SandboxFrame`
- [ ] Dọn sandbox hết hạn

## S6 — Realtime & thông báo

- [ ] Centrifugo trong docker-compose; core-api phát kênh theo đơn / coder
- [ ] Web + coder thay polling (brief, repo, tiến độ, offer) bằng subscribe
- [ ] Chat backend khách ↔ coder (lưu Postgres) thay `OrderChatBox` / `CoderChat` mock (hiện localStorage/eventBus)
- [ ] 👤 Tài khoản Zalo ZNS, Firebase (FCM), VAPID key WebPush
- [ ] `notifier`: Zalo ZNS, FCM, WebPush theo cài đặt thông báo trong `/profile`

## S7 — Admin portal

- [ ] App `apps/admin` (Next.js 15) + role ADMIN trong contract / API
- [ ] Quản lý coder tier, khoá / mở coder
- [ ] Giải quyết tranh chấp (hoàn / nhả tiền qua ledger)
- [ ] Đối soát tài khoản `suspense` (CK sai nội dung / không khớp đơn) — gán vào đơn hoặc hoàn
- [ ] Hoàn tiền thừa / huỷ đơn DRAFT đã nạp một phần (tiền thừa hiện nằm lại escrow)
- [ ] Coder rút tiền từ ví về ngân hàng (payout, duyệt thủ công)
- [ ] Giám sát worker / queue (JetStream consumer lag, job FAILED, thử lại)
- [ ] Cấu hình AI model & bảng giá (đọc từ DB thay `.env`)

---

## Xuyên suốt

- [ ] Tách script: `lint` mọi package hiện là `tsc --noEmit` (thực chất typecheck); `CLAUDE.md` ghi `pnpm typecheck` nhưng root chưa có script này
- [ ] ESLint thật cho các package (chưa có linter nào)
- [ ] CI GitHub Actions: install, typecheck, lint, test trên mỗi PR
- [ ] `.gitattributes` cố định line ending (đang có cảnh báo LF → CRLF khi commit trên Windows)
- [ ] Một lệnh chạy cả stack local (api + relay + workers + apps)
- [ ] Test API: auth (đăng ký, login, session hết hạn), briefs, repos (webhook chữ ký sai, push trùng)
- [ ] Dockerfile / cấu hình deploy cho core-api + workers

## Nợ kỹ thuật (từ comment `shortcut:` trong code)

- [ ] Rate limit chống brute-force login theo IP / email — `api/core-api/src/auth/auth.service.ts:131` (**bắt buộc trước khi public**)
- [ ] Liên kết tài khoản cùng email giữa các provider — `api/core-api/src/db/schema.ts:33`
- [ ] Gộp `RequireAuth` + `lib/auth.tsx` trùng giữa web và coder vào package UI chung — `apps/*/components/RequireAuth.tsx`, `apps/*/lib/auth.tsx`
- [ ] Danh sách múi giờ đầy đủ trong `/profile` — `apps/web/app/profile/page.tsx:200`
