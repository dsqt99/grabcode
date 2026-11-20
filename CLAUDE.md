# CLAUDE.md — Quy chuẩn kiến trúc & Chỉ dẫn AI Agent cho GrabCode

> **Triết lý cốt lõi**: Phân rã hệ thống thành 4 khối thành phần độc lập (`app`, `admin`, `api`, `worker`) xoay quanh một **Shared Contract** duy nhất. AI Agent khi nhận task chỉ tập trung vào đúng domain của mình, không làm phình context, không phá vỡ logic chéo.

---

## 1. Bản đồ 4 thành phần & Trách nhiệm ranh giới

GrabCode tổ chức các module/repo theo 4 thành phần độc lập với ranh giới trách nhiệm nghiêm ngặt:

```
grabcode / multi-repo
├── [1] apps/ (hoặc repo-app)
│   ├── web/                     # Web App khách hàng: Đặt đơn, AI Briefing review, nạp tiền ký quỹ, theo dõi tiến độ POC realtime
│   └── coder/                   # PWA Coder: Nhận offer đơn (Grab-like), xem brief/milestones, nộp bài, chat
├── [2] admin/ (hoặc repo-admin)
│   └── admin-portal/            # Giao diện vận hành: Quản lý Coder tier, giải quyết tranh chấp (Dispute), giám sát Worker/Queue, cấu hình AI Model & Bảng giá
├── [3] api/ (hoặc repo-api)
│   ├── core-api/                # NestJS Modular Monolith: Auth (GitHub OAuth), State Machine đơn hàng, Ledger ký quỹ, Idempotency, Dispatch job
│   └── matching/                # Go Service: Matching engine thuật toán chấm điểm và gửi Wave offer (đường nóng latency thấp)
├── [4] workers/ (hoặc repo-worker)
│   ├── brief-worker/            # Gọi LLM OpenAI-compatible (vLLM, Qwen) phân tích brief, tạo spec & milestones JSON
│   ├── repo-worker/             # GitHub App bot: Tạo private repo, gán collaborator, khởi tạo CLAUDE.md cho Coder, parse webhook commit
│   ├── qa-worker/               # QA Gate: Chạy build test, static analysis, security scan trước khi bàn giao
│   ├── deploy-worker/           # Tạo sandbox preview trên Cloud Run
│   ├── notifier/                # Push notification (Zalo ZNS, FCM, WebPush)
│   └── outbox-relay/            # Transactional Outbox relay sang NATS JetStream
└── [0] contracts/ (Shared Schema - Single Source of Truth)
    ├── openapi/                 # OpenAPI 3.1 REST specs cho API endpoints
    ├── events/                  # JSON Schema cho NATS event payloads (Outbox events)
    └── types/                   # Code-gen DTOs (TypeScript & Go models)
```

---

## 2. Các nguyên tắc vàng (Bắt buộc tuân thủ)

### Nguyên tắc 1: CONTRACT FIRST — Cấm tuyệt đối việc tự đoán Schema
- Mọi dữ liệu trao đổi giữa `app`, `admin`, `api`, và `worker` **phải được định nghĩa trước tại `contracts/`**.
- Không bao giờ để `app` hay `admin` tự đoán payload (ví dụ: Frontend dùng `video` trong khi API trả `video_url`).
- Khi phát triển tính năng mới, **bước 1 luôn là cập nhật Contract** -> sinh types -> mới viết code cho API, Worker, App.

### Nguyên tắc 2: API KHÔNG LÀM VIỆC NẶNG (No Heavy Lifting in API)
- `core-api` chỉ chịu trách nhiệm: **Authentication, Authorization, Validation, Database Transaction (Postgres), và Ghi Outbox Event**.
- Tuyệt đối **KHÔNG** chạy long-running tasks, LLM generation, xử lý ảnh/video, gọi GitHub API đồng bộ, hay polling trong API request handler.
- Mọi việc tốn thời gian phải được đóng gói thành Job và chuyển sang `worker` qua NATS JetStream.

### Nguyên tắc 3: Worker Stateless & Idempotent
- Mọi Worker consumer phải xử lý chống trùng lặp qua bảng `processed_events` dựa trên `event_id`.
- Tác vụ ngoài (AI, GitHub, Cloud Run deploy) phải có retry policy với exponential backoff.

### Nguyên tắc 4: Postgres là Single Source of Truth
- Mọi thay đổi trạng thái nghiệp vụ (đơn hàng, thanh toán, mốc) lưu trong Postgres schema riêng của từng module.
- Redis, Vector index, Cache chỉ là dữ liệu dẫn xuất (phải tái tạo lại được 100% từ Postgres).

### Nguyên tắc 5: Cập nhật `CHECKLIST.md` sau mỗi việc
- Xong một việc (hoặc bắt đầu làm dở) → cập nhật ngay [CHECKLIST.md](CHECKLIST.md): `[x]` xong, `[~]` đang làm, kèm commit hash ngắn.
- Việc mới phát sinh (bug, nợ kỹ thuật, bước thiếu) → thêm dòng `[ ]` vào đúng sprint.
- Commit checklist cùng commit của việc đó, không để lệch với code.

---

## 3. Chiến lược phân vai Multi-Agent (AI Coding Workflow)

Khi giao nhiệm vụ cho AI (Claude Code, Codex, Antigravity), **phải chia theo từng Agent chuyên trách**:

| Agent | Phụ trách | Phạm vi đọc hiểu (Context) | Ràng buộc chính |
| :--- | :--- | :--- | :--- |
| **Agent 0 (Architect/Lead)** | `contracts/` | PRD, Architecture Spec, Database Models | Định nghĩa OpenAPI schema & Event JSON Schemas trước tiên. Sinh type definition. |
| **Agent 1 (API Engineer)** | `api/` (`core-api`, `matching`) | `contracts/`, `api/`, SQL Schemas | Implement Controller, Services, DB transactions. Dispatch event vào Outbox. Tuyệt đối không gọi 3rd party AI nặng. |
| **Agent 2 (Worker Engineer)** | `workers/` | `contracts/`, `workers/`, Queue specs | Lắng nghe event, gọi LLM / GitHub App / Cloud Run. Idempotent check, publish kết quả xong việc. |
| **Agent 3 (App Frontend)** | `apps/web`, `apps/coder` | `contracts/types`, UI components, Tailwind | Tạo giao diện người dùng, gọi API theo generated SDK client. Tuyệt đối không hardcode mock type lệch contract. |
| **Agent 4 (Admin Frontend)** | `apps/admin` | `contracts/types`, Admin layouts, Table/Chart | Xây dựng dashboard vận hành, màn hình cấu hình AI provider, bảng giá, duyệt tranh chấp. |

### Quy trình mẫu: Task "Tích hợp AI Provider mới (ví dụ: Seedance 2.5)"
1. **Contract**: Thêm `SeedanceProviderConfig` vào admin schema, thêm `GenerationJobPayload` có trường `provider: "seedance-2.5"`.
2. **API (`core-api`)**: Thêm validation check cho provider mới, lưu job record vào DB, bắn outbox event `job.created`.
3. **Worker (`brief/render-worker`)**: Lắng nghe `job.created`, gọi API Seedance, poll kết quả, tải output lên Cloud Storage, bắn `job.completed`.
4. **Admin (`apps/admin`)**: Thêm form cấu hình API Key, quota, pricing rate cho Seedance.
5. **App (`apps/web`)**: Bổ sung option chọn model Seedance trong UI kèm preview kết quả.

---

## 4. Công nghệ & Stack chuẩn

- **Frontend (`apps/web`, `apps/admin`)**: Next.js 15 (App Router), TypeScript, Tailwind CSS, TanStack Query, Lucide Icons.
- **Coder App (`apps/coder`)**: PWA Next.js (Phase 1) / Expo React Native (Phase 2).
- **Backend Core (`api/core-api`)**: NestJS (TypeScript), Drizzle ORM, PostgreSQL 16 (pgvector), Transactional Outbox pattern.
- **Matching Core (`api/matching`)**: Go 1.23, `go-redis`, `pgx`.
- **Workers (`workers/*`)**: Node.js 22 / Go worker microservices, NATS JetStream consumer.
- **Contract & Code-gen**: OpenAPI 3.1, JSON Schema, `openapi-typescript-codegen`, `buf` / JSON schema to Go.
- **Deploy & Sandbox**: Cloud Run, GKE Autopilot, Centrifugo (WebSocket).

---

## 5. Quy chuẩn phát triển (Development Guidelines)

### Lệnh chạy phổ biến (pnpm workspace)
- Root script gọi `pnpm -r` bên trong nên `npm run dev` hay `pnpm dev` đều được; cài deps vẫn bắt buộc `pnpm install` (repo dùng `workspace:*`).
- **Cài đặt dependencies**: `pnpm install`
- **Sinh mã từ Contract**: `pnpm --filter @grabcode/contracts run generate`
- **Chạy môi trường Dev toàn bộ**: `pnpm stack` (docker compose `--wait` + migrate + `pnpm dev` mọi app/worker); đã có infra thì `pnpm dev`
- **Chạy riêng từng thành phần**:
  * Chạy Web: `pnpm --filter @grabcode/web dev`
  * Chạy Coder PWA: `pnpm --filter @grabcode/coder dev`
  * Chạy Admin: `pnpm --filter @grabcode/admin dev`
  * Chạy API: `pnpm --filter @grabcode/core-api dev`
  * Chạy Worker: `pnpm --filter @grabcode/brief-worker dev`
- **Kiểm tra Lint & Typecheck**: `pnpm lint && pnpm typecheck` (ESLint flat config ở root `eslint.config.mjs`; typecheck = `tsc --noEmit` từng package)
- **Chạy Unit Test**: `pnpm test`

### Chạy luồng AI Brief local (S0)
1. `cp .env.example .env` rồi điền `LLM_API_KEY` (endpoint `LLM_BASE_URL`, model `LLM_MODEL`) (thiếu key: job thành `FAILED`, web tự fallback brief mẫu).
2. `docker compose up -d` — Postgres `127.0.0.1:5433`, NATS `127.0.0.1:4223`.
3. `pnpm --filter @grabcode/core-api db:migrate`
4. Chạy 3 tiến trình: `pnpm --filter @grabcode/core-api dev`, `pnpm --filter @grabcode/outbox-relay dev`, `pnpm --filter @grabcode/brief-worker dev`.
5. Web gọi API khi có `NEXT_PUBLIC_API_URL=http://localhost:4000` trong `apps/web/.env.local`; origin web phải nằm trong `WEB_ORIGIN` (CORS).
- Luồng: `POST /v1/briefs` → `core.outbox` → outbox-relay → NATS `brief.requested` → brief-worker (LLM) → `brief.generated|failed` → core-api cập nhật `core.brief_jobs` → web poll `GET /v1/briefs/:id`.

### Repo GitHub riêng cho mỗi đơn (repo-worker)
- GitHub App cài trên org `GITHUB_ORG` (mặc định `grabcode-sandbox`). Quyền: Administration RW, Contents RW, Metadata R. Webhook event Push → `{API_PUBLIC_URL}/v1/github/webhook` (cần URL public: smee.io/ngrok).
- `.env`: `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY` (hoặc `GITHUB_APP_PRIVATE_KEY_PATH`), `GITHUB_APP_WEBHOOK_SECRET`. Thiếu → job thành `FAILED`, coder app hiện lỗi + nút Thử lại.
- Chạy: `pnpm --filter @grabcode/repo-worker dev` (cùng core-api + outbox-relay).
- Luồng: coder nhận đơn → `POST /v1/repos` (idempotent theo `orderId`, FAILED thì xếp lại) → outbox `repo.requested` → repo-worker: tạo repo private (`gc-<số đơn>`), commit `CLAUDE.md`, branch protection (chặn force-push; org Free + repo private sẽ bị 403, chỉ cảnh báo), mời coder quyền push → `repo.provisioned|failed` → `core.order_repos`. Push webhook → `core.repo_commits` → `GET /v1/repos/:orderId`.
- Coder được mời theo `users.github_login` (login GitHub) hoặc link GitHub trong hồ sơ Coder; không có thì repo vẫn tạo nhưng chưa mời.
- Đơn ACCEPTED: `repo.handover.requested` → khách (`users.github_login`) thành admin, coder còn quyền đọc. Khách không có login → nút "Nhận repo" ở web gọi `POST /v1/repos/:orderId/handover {githubLogin}`.

### QA Gate & sandbox (qa-worker, deploy-worker)
- Chạy: `pnpm --filter @grabcode/qa-worker dev`, `pnpm --filter @grabcode/deploy-worker dev` (cùng core-api + outbox-relay). qa-worker cần Docker (image `QA_IMAGE`, mặc định `node:22-alpine`); deploy-worker cần `gcloud` đã login + `GCP_PROJECT` (thiếu → sandbox `FAILED`).
- Luồng QA: coder nộp mốc (repo READY) → `qa.requested` → clone commit (bỏ `.git`) → quét secret + install/lint/typecheck/build/test/audit, mỗi bước 1 container → `qa.completed` → `brief.milestones[].qa`.
- Luồng sandbox: đơn DELIVERED → `deploy.requested` → `gcloud run deploy --source` → `deploy.ready|failed` → `orders.sandbox`; quá `SANDBOX_TTL_HOURS` → xóa service, `deploy.expired`.
- Test không cần GitHub: `GIT_CLONE_BASE=file:///<dir>` cho cả 2 worker, rồi `REPOS=<dir> node api/core-api/scripts/smoke-qa.mjs`.

### Realtime & chat (Centrifugo)
- `.env`: `CENTRIFUGO_CLIENT_TOKEN_HMAC_SECRET_KEY` (chuỗi ngẫu nhiên, dùng chung cho core-api ký JWT và Centrifugo), `REALTIME_WS_URL`. Thiếu secret → `GET /v1/realtime/token` trả 404, app tự về polling 3s.
- Chạy: `docker compose up -d centrifugo` (`127.0.0.1:8000`, config `infra/centrifugo.json`, `allowed_origins` phải có origin web/coder).
- Luồng: ghi DB (API, worker consumer, webhook) → trigger `core.realtime_hint()` ghi `public.centrifugo_outbox` cùng transaction → Centrifugo consumer `core_pg` broadcast kênh `user.<id>` → client (`onRealtimeHint` trong contracts) refetch REST. Hint chỉ `{type, orderId}`, không mang state.
- Chat: `GET/POST /v1/orders/:id/messages` (`core.order_messages`), chỉ khách/coder của đơn; tin SYSTEM ở web vẫn là local.
- Smoke: `node api/core-api/scripts/smoke-realtime.mjs` (core-api `AUTH_DEV_LOGIN=true` + Centrifugo chạy).

### Thông báo đẩy (notifier, WebPush)
- `.env`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (sinh: `npx web-push generate-vapid-keys`). Thiếu → `GET /v1/push/key` 404, nút ở `/profile` ẩn, notifier ack bỏ qua.
- Chạy: `pnpm --filter @grabcode/notifier dev` (cùng core-api + outbox-relay).
- Luồng: `/profile` bật "Thông báo đẩy" → "Bật trên trình duyệt này" → `public/sw.js` + `PUT /v1/me/push-subscriptions` (`core.push_subscriptions`) → notifier nghe `order.*` + `dispatch.offered` + `chat.posted` (tin chat, chỉ bên kia) → push tới user liên quan (`notifications.push` bật); endpoint 404/410 tự xoá. Zalo ZNS / FCM chưa làm.

### Đăng nhập (Auth) local
- core-api giữ session: cookie httpOnly `gc_session` (chỉ lưu SHA-256 token trong `core.sessions`), user ở `core.users` (`roles`: CUSTOMER/CODER, `currency`).
- GitHub OAuth: tạo GitHub OAuth App, callback `{API_PUBLIC_URL}/v1/auth/github/callback`, điền `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` trong `.env`.
- Google OAuth: Google Cloud Console → OAuth client (Web application), Authorized redirect URI `{API_PUBLIC_URL}/v1/auth/google/callback`, điền `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`. Provider chưa cấu hình thì nút ẩn, `/v1/auth/{provider}` trả 404.
- Email/mật khẩu: `POST /v1/auth/register` (409 nếu trùng email), `POST /v1/auth/login` (401 chung cho sai email/mật khẩu); hash scrypt. Đăng ký mới qua provider khác = user riêng; gộp bằng nút "Liên kết" ở /profile (`/v1/auth/{provider}?link=1`, cần đang login, lưu `core.user_identities`). Không tự gộp theo email (email mật khẩu chưa xác minh).
- Dev login không cần GitHub: `AUTH_DEV_LOGIN=true` (tự tắt khi `NODE_ENV=production`).
- `apps/web` và `apps/coder` cần `NEXT_PUBLIC_API_URL` trong `.env.local`; không có biến này = chế độ mock, bỏ qua đăng nhập.
- Một trang login duy nhất: web `/login` cho cả 2 vai trò. Role chỉ chọn lúc đăng ký (thẻ Khách hàng/Coder), 1 tài khoản có thể có cả 2 role. Sau login: về `?next=` hoặc theo role (CUSTOMER → `/`, chỉ CODER → `/coder`).
- Gate: web `/order/*` (role CUSTOMER), `/profile` (mọi user đã login); coder toàn app (role CODER). Chưa login → redirect `/login?next=...` (coder phải mở qua web `:3100/coder`, không mở trực tiếp `:3001`). Thiếu role → thẻ "Kích hoạt" gọi `POST /v1/me/roles`.
- `/profile` (kiểu Upwork): thông tin liên hệ (`PATCH /v1/me`), hồ sơ Coder (`PUT /v1/me/coder-profile`), hồ sơ doanh nghiệp (`PUT /v1/me/customer-profile`), thông báo + tiền tệ, đổi mật khẩu (`POST /v1/me/password`, đăng xuất các phiên khác).

### MVP VN: thu tiền tay, bảng việc, bàn giao link (HON-8)
- Bảng giá + `CODER_PAYOUT_RATE`: chỉ sửa `packages/contracts/src/schemas/pricing.ts`. Tiền trả coder chốt vào `orders.payout_vnd` lúc tạo đơn.
- Thanh toán: `PAYMENT_BANK_ID` (mã VietQR/BIN), `PAYMENT_BANK_NAME`, `PAYMENT_ACCOUNT_NUMBER`, `PAYMENT_ACCOUNT_NAME` → QR `img.vietqr.io`. Admin xác nhận: `POST /v1/admin/orders/:id/confirm-payment {amountVnd, reference}` (tx `manual:<order>:<REF>`, chỉ đơn DRAFT). SePay webhook vẫn dùng được (`SEPAY_WEBHOOK_API_KEY` → `autoConfirm`).
- Bảng việc: `GET /v1/jobs`, `POST /v1/jobs/:id/claim` (FUNDED|DISPATCHED → IN_PROGRESS, 1 đơn đang làm / coder). Nộp mốc: `{deliveryUrl?, commitHash?, note?}` ít nhất 1.
- Id mốc luôn do server đặt (`M1..Mn`, `freshBrief`). Coder bị khoá: mất phiên, mọi API 403.
- Deploy: `docs/DEPLOY.md` (1 VPS, `infra/deploy/docker-compose.prod.yml` + Caddy). Smoke: `node api/core-api/scripts/smoke-mvp.mjs`.

### Admin portal (S7)
- Chạy: `pnpm --filter @grabcode/admin dev` (`:3002`, basePath `/admin`), mở qua web `:3100/admin` (rewrite `ADMIN_ORIGIN`, chung cookie `gc_session`).
- Cấp quyền: `update core.users set roles = array_append(roles, 'ADMIN') where email = '...'`; dev: `POST /v1/auth/dev-login {login, role: 'ADMIN'}`. Không có role ADMIN → `/v1/admin/*` trả 403.
- Đơn đủ tiền (`orders.funded_at`) quá 30 phút chưa coder nhận: web hiện cảnh báo, admin thấy ở tab Orders; quá `AUTO_REFUND_HOURS` (mặc định 24, 0 = tắt) tính từ `funded_at` core-api tự huỷ + hoàn (quét 10 phút/lần).
- Hoàn tiền chỉ là ghi sổ: mỗi bút toán hoàn cho khách (`postTx`) mở 1 dòng `core.refunds` PENDING → tab "Chờ chuyển trả" (`GET /v1/admin/refunds`), CK tay tới STK khách nhập ở trang đơn (`PUT /v1/orders/:id/refund-account`) rồi `POST /v1/admin/refunds/:id/paid {reference}` (mã GD unique). Chi tiết đơn chỉ đọc: `GET /v1/admin/orders/:id`.
- Test DB không cần Docker: `api/core-api/src/test/pglite.ts` (PGlite + toàn bộ migration).
- Tab: Coders (tier override, khoá), Orders (chia tranh chấp, hoàn DRAFT nạp dở), Suspense (gán đơn / hoàn), Payouts (duyệt sau khi CK tay), Monitor (outbox, JetStream, job FAILED). Coder gửi yêu cầu rút ở coder app.
- Smoke: `node api/core-api/scripts/smoke-admin.mjs` (core-api `AUTH_DEV_LOGIN=true`).

### Image deploy (core-api + workers)
- `docker build -f infra/node-service.Dockerfile --build-arg PKG=@grabcode/core-api -t grabcode/core-api .` (đổi `PKG` cho từng worker). Chạy bằng tsx, user `node`, cấu hình qua env (không copy `.env`/`credentials`).
- qa-worker cần Docker CLI + socket, deploy-worker cần `gcloud`: chạy nơi host có sẵn.
- Web/coder/admin: `docker build -f infra/next-app.Dockerfile --build-arg PKG=@grabcode/web --build-arg NEXT_PUBLIC_API_URL=<api> [--build-arg CODER_ORIGIN=… ADMIN_ORIGIN=…] -t grabcode/web .` (biến build-time, mỗi môi trường build lại; `next start` port 3000/3001/3002).

### Quy ước Git & Commit
- Tiền tố theo component:
  * `feat(contract): define schema for video generation`
  * `feat(api): handle brief creation and dispatch outbox event`
  * `feat(worker): implement seedance generator with exponential backoff`
  * `feat(app): add real-time milestone progress bar`
  * `feat(admin): add provider settings screen`
