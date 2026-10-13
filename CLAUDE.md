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
│   ├── brief-worker/            # Gọi Claude Sonnet 3.5 phân tích brief, tạo spec & milestones JSON
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

### Lệnh chạy phổ biến (Turborepo / Monorepo)
- **Cài đặt dependencies**: `pnpm install`
- **Sinh mã từ Contract**: `pnpm --filter @grabcode/contracts run generate`
- **Chạy môi trường Dev toàn bộ**: `pnpm dev`
- **Chạy riêng từng thành phần**:
  * Chạy Web: `pnpm --filter @grabcode/web dev`
  * Chạy Coder PWA: `pnpm --filter @grabcode/coder dev`
  * Chạy Admin: `pnpm --filter @grabcode/admin dev`
  * Chạy API: `pnpm --filter @grabcode/core-api dev`
  * Chạy Worker: `pnpm --filter @grabcode/brief-worker dev`
- **Kiểm tra Lint & Typecheck**: `pnpm lint && pnpm typecheck`
- **Chạy Unit Test**: `pnpm test`

### Quy ước Git & Commit
- Tiền tố theo component:
  * `feat(contract): define schema for video generation`
  * `feat(api): handle brief creation and dispatch outbox event`
  * `feat(worker): implement seedance generator with exponential backoff`
  * `feat(app): add real-time milestone progress bar`
  * `feat(admin): add provider settings screen`
