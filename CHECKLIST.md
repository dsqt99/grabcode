# GrabCode — Checklist tiến độ

> Cập nhật **ngay khi xong mỗi việc** (Nguyên tắc 5 trong `CLAUDE.md`): tick, ghi commit hash ngắn, thêm việc mới phát sinh.
> Ký hiệu: `[x]` xong · `[~]` đang làm / làm dở · `[ ]` chưa làm · 👤 cần chủ dự án làm (tài khoản, secret, quyết định).
> Thứ tự sprint theo phụ thuộc: S1 → S2 → S3 → S4 → S5 / S6 / S7.
> Mỗi việc làm theo contract-first: `contracts` → `generate` → `api` → `worker` → `app`.

**Đang ở:** S1 Order core xong (chưa PR). S0 vẫn chờ cấu hình GitHub App thật. **Tiếp theo:** S2 Ledger ký quỹ.

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
- [ ] Xoá dòng test `GC-3428` (FAILED) trong `core.order_repos` sau khi test thật
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
- [ ] Nợ S1: `core.order_repos` chưa FK sang `core.orders`
- [ ] Nợ S1: ký quỹ giả lập, FUNDED tự chuyển DISPATCHED (thay ở S2)
- [ ] Nợ S1: coder tự nhận đơn từ open pool (`scope=open`), ai nhận trước thắng (thay ở S3)
- [ ] Nợ S1: milestones lưu trong `brief` jsonb, chưa bảng riêng
- [ ] Nợ S1: checkout web hiện phí nền tảng 5%, giá server không có phí — thống nhất ở S2
- [ ] Nợ S1: chat đơn vẫn localStorage/eventBus (S4)
- [ ] Nợ S1: `OrderDto` chưa có tier/rating coder được giao; ví coder vẫn local
- [ ] Nợ S1: đơn rỗng milestones → coder fallback `GENERIC_MILESTONES`, lệch server

## S2 — Ledger ký quỹ

- [ ] 👤 Chọn cổng thanh toán (VNPay / MoMo / Stripe) + lấy key chế độ test
- [ ] Contract: ledger entry, events `escrow.deposited|held|released|refunded`
- [ ] API: ledger double-entry (nạp, giữ, nhả theo mốc, hoàn) + bảng idempotency key
- [ ] API: webhook nạp tiền từ cổng thanh toán (xác thực chữ ký)
- [ ] Web: checkout ký quỹ thật thay `EscrowCheckout` mock
- [ ] Test ledger: tổng luôn cân, gọi trùng không trừ / cộng 2 lần

## S3 — Dispatch + Matching

- [ ] Contract: `WaveOffer`, events `dispatch.requested|offered|accepted|expired`
- [ ] `api/matching` (Go 1.23, `pgx`, `go-redis`): chấm điểm coder, gửi wave offer
- [ ] API: coder nhận / từ chối offer; hết hạn → wave sau; chỉ 1 coder nhận được
- [ ] Coder: offer thật thay giả lập (`WaveOfferModal`, `OnlineRadar`)
- [ ] Coder: trạng thái online/offline lưu server
- [ ] Test: 2 coder nhận cùng lúc → chỉ 1 thắng

## S4 — Milestone & nghiệm thu

- [ ] Contract: `MilestoneSubmission`, events `milestone.submitted|approved|rejected`
- [ ] Coder: nộp mốc gắn commit SHA (`core.repo_commits`)
- [ ] Web: khách duyệt / yêu cầu sửa từng mốc → nhả tiền theo mốc (S2)
- [ ] Tranh chấp: chuyển DISPUTED, khoá tiền, ghi nhận cho admin
- [ ] Bàn giao: chuyển repo / quyền sang khách khi ACCEPTED

## S5 — Workers bàn giao

- [ ] `qa-worker`: build, test, static analysis, security scan; kết quả gắn vào mốc
- [ ] 👤 Tài khoản GCP + project cho Cloud Run sandbox
- [ ] `deploy-worker`: deploy sandbox preview Cloud Run, trả URL cho `SandboxFrame`
- [ ] Dọn sandbox hết hạn

## S6 — Realtime & thông báo

- [ ] Centrifugo trong docker-compose; core-api phát kênh theo đơn / coder
- [ ] Web + coder thay polling (brief, repo, tiến độ, offer) bằng subscribe
- [ ] Chat backend khách ↔ coder (lưu Postgres) thay `OrderChatBox` / `CoderChat` mock
- [ ] 👤 Tài khoản Zalo ZNS, Firebase (FCM), VAPID key WebPush
- [ ] `notifier`: Zalo ZNS, FCM, WebPush theo cài đặt thông báo trong `/profile`

## S7 — Admin portal

- [ ] App `apps/admin` (Next.js 15) + role ADMIN trong contract / API
- [ ] Quản lý coder tier, khoá / mở coder
- [ ] Giải quyết tranh chấp (hoàn / nhả tiền qua ledger)
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
