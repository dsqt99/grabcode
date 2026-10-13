# GrabCode On-Demand POC Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng nền tảng GrabCode Monorepo (Turborepo + pnpm) hoàn chỉnh gồm shared contracts (`@grabcode/contracts`), ứng dụng Web khách hàng (`apps/web`) và ứng dụng Tài xế Coder PWA (`apps/coder`) chuyển đổi từ thiết kế Stitch, hỗ trợ tương tác đồng bộ thời gian thực hai chiều.

**Architecture:** Turborepo monorepo với contract-first typing; Next.js 15 App Router với Tailwind CSS theo Emerald Mobility Design System; đồng bộ trạng thái thời gian thực giữa Web và Coder PWA qua HTML5 BroadcastChannel và LocalStorage event bus.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Turborepo, pnpm workspaces, Lucide / Material Symbols Outlined, BroadcastChannel API.

---

## File Structure Map

```
grabcode/
├── package.json                         # Monorepo root scripts & dev dependencies
├── pnpm-workspace.yaml                  # Workspace packages & apps definition
├── turbo.json                           # Turborepo task pipelines (build, dev, lint)
├── packages/
│   └── contracts/
│       ├── package.json                 # @grabcode/contracts config
│       ├── tsconfig.json                # TypeScript build config
│       └── src/
│           ├── types/
│           │   ├── order.ts             # Order, OrderTier, OrderStatus, Escrow
│           │   ├── brief.ts             # AIBrief, Milestone, AcceptanceCriteria
│           │   ├── coder.ts             # CoderProfile, CoderTier
│           │   └── events.ts            # BroadcastChannel event types
│           ├── mock/
│           │   └── seedData.ts          # Templates mẫu, đơn hàng mẫu, coder mẫu
│           └── index.ts                 # Export barrel
├── apps/
│   ├── web/
│   │   ├── package.json                 # Dependencies: @grabcode/contracts, next, react, lucide-react
│   │   ├── tsconfig.json
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts           # Emerald theme tokens
│   │   ├── app/
│   │   │   ├── layout.tsx               # Root layout: Fonts & Global Providers
│   │   │   ├── globals.css              # Emerald design system styles
│   │   │   ├── page.tsx                 # [Màn 1] Landing Page & Instant Dispatch
│   │   │   └── order/
│   │   │       ├── new/page.tsx         # [Màn 2] AI Brief Builder & Escrow
│   │   │       └── [id]/page.tsx        # [Màn 3] Live Tracking & Sandbox Preview
│   │   └── components/
│   │       ├── Navbar.tsx               # Header, logo, currency switch, CTA
│   │       ├── InstantDispatch.tsx      # Dispatch widget tabs, prompt input
│   │       ├── TemplateShowcase.tsx     # Thư viện POC templates
│   │       ├── AIBriefViewer.tsx        # AI Spec, scope, milestone cards
│   │       ├── EscrowCheckout.tsx       # Tóm tắt ký quỹ, phương thức thanh toán
│   │       ├── LiveStepper.tsx          # 4-stage tracking stepper
│   │       ├── SandboxFrame.tsx         # Responsive preview iframe
│   │       └── ChatBox.tsx              # Trao đổi khách - coder
│   └── coder/
│       ├── package.json                 # Dependencies: @grabcode/contracts, next, react, lucide-react
│       ├── tsconfig.json
│       ├── next.config.ts
│       ├── tailwind.config.ts           # Emerald theme tokens
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── globals.css
│       │   └── page.tsx                 # [Màn 4] Coder Driver Dashboard
│       └── components/
│           ├── DriverHeader.tsx         # Hồ sơ tài xế, rank Vàng, ví thu nhập
│           ├── OnlineRadar.tsx          # Toggle online & Radar sonar animation
│           ├── WaveOfferModal.tsx       # Modal nhận cuốc đơn 30s đếm ngược
│           └── ActiveJobWorkspace.tsx   # CLAUDE.md download, milestone checklist, nộp bài
```

---

### Task 1: Thiết lập Root Monorepo & Cấu hình Turborepo

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `turbo.json`
- Create: `.gitignore`

- [ ] **Step 1: Khởi tạo pnpm-workspace.yaml**
```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

- [ ] **Step 2: Khởi tạo Root package.json với Turborepo**
```json
{
  "name": "grabcode",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^2.4.0",
    "typescript": "^5.7.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

- [ ] **Step 3: Khởi tạo turbo.json**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {}
  }
}
```

- [ ] **Step 4: Commit cấu hình Monorepo**
```bash
git add pnpm-workspace.yaml package.json turbo.json
git commit -m "chore(root): initialize turborepo and pnpm workspaces"
```

---

### Task 2: Triển khai Package `@grabcode/contracts` (Single Source of Truth)

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/types/order.ts`
- Create: `packages/contracts/src/types/brief.ts`
- Create: `packages/contracts/src/types/coder.ts`
- Create: `packages/contracts/src/types/events.ts`
- Create: `packages/contracts/src/mock/seedData.ts`
- Create: `packages/contracts/src/index.ts`

- [ ] **Step 1: Tạo cấu hình package.json cho `@grabcode/contracts`**
```json
{
  "name": "@grabcode/contracts",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Viết TypeScript Types cho Domain GrabCode**
  - Định nghĩa `Order`, `OrderTier` (`EXPRESS`, `STANDARD`, `PRO`, `TEMPLATE`), `OrderStatus`.
  - Định nghĩa `AIBrief`, `Milestone`, `AcceptanceCriteria`.
  - Định nghĩa `CoderProfile`, `CoderTier`, `WaveOffer`.
  - Định nghĩa `GrabCodeEvent` cho `BroadcastChannel` ("ORDER_DISPATCHED", "ORDER_ACCEPTED", "MILESTONE_UPDATED", "ORDER_DELIVERED", "ORDER_COMPLETED").

- [ ] **Step 3: Viết dữ liệu mẫu `seedData.ts`**
  - Cung cấp sẵn các mẫu POC thực tế: "Mini CRM Bất Động Sản", "SaaS Billing Dashboard", "E-Commerce Checkout Fast", "AI Voice Agent Booking".
  - Đơn hàng demo ban đầu để màn hình live tracking có dữ liệu sẵn sàng hiển thị.

- [ ] **Step 4: Commit package contracts**
```bash
git add packages/contracts
git commit -m "feat(contracts): implement shared types, events and seed data"
```

---

### Task 3: Cấu hình Next.js 15 & Emerald Design System cho `apps/web`

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/app/layout.tsx`

- [ ] **Step 1: Cấu hình dependencies cho `apps/web`**
  - Khai báo dependency `"@grabcode/contracts": "workspace:*"`
  - Khai báo `next`, `react`, `react-dom`, `lucide-react`, `tailwindcss`.

- [ ] **Step 2: Cài đặt Tailwind CSS với Emerald Mobility tokens trong `tailwind.config.ts`**
  - Đưa toàn bộ mã màu từ [DESIGN.md](file:///d:/code/dsqt/grabcode/DESIGN.md) vào:
    - `primary`: `#006e2e`, `primary-container`: `#00b14f`, `surface`: `#f8f9ff`, `on-surface`: `#0b1c30`, v.v.
    - Cấu hình fonts: `Plus Jakarta Sans`, `Inter`.

- [ ] **Step 3: Tích hợp Google Fonts trong `app/layout.tsx`**
  - Tải Plus Jakarta Sans và Inter.
  - Tải Google Material Symbols Outlined.

- [ ] **Step 4: Commit cấu hình web app**
```bash
git add apps/web/package.json apps/web/tailwind.config.ts apps/web/app/globals.css apps/web/app/layout.tsx
git commit -m "feat(web): configure next.js 15 with emerald design tokens"
```

---

### Task 4: Triển khai [Màn 1] Trang chủ & Instant Dispatch Widget (`apps/web`)

**Files:**
- Create: `apps/web/components/Navbar.tsx`
- Create: `apps/web/components/InstantDispatch.tsx`
- Create: `apps/web/components/TemplateShowcase.tsx`
- Create: `apps/web/components/ComparisonTable.tsx`
- Create: `apps/web/app/page.tsx`

- [ ] **Step 1: Tạo Navbar với phong cách Grab Super-App**
  - Top emergency banner: "⚡ Cam kết giao link demo chạy thật trong 2–8 giờ • Đã có 500+ Coder sẵn sàng".
  - Logo GrabCode màu Emerald, menu links, currency toggle VND/USD, nút CTA "Đặt POC ngay".

- [ ] **Step 2: Dựng Instant Dispatch Widget**
  - 4 tabs tốc độ: Express (3h), Standard (8h), Enterprise (24h), Mua Template.
  - Textarea nhập ý tưởng kèm các mẫu gợi ý prompt có sẵn.
  - Selector template xuất phát điểm và selector công nghệ (Next.js, FastAPI, Flutter...).
  - Báo giá tính tiền theo thời gian thực và thời gian hoàn thành dự kiến.
  - Chuyển tiếp người dùng sang `/order/new?prompt=...&tier=...`.

- [ ] **Step 3: Dựng Showcase Template & Comparison Table**
  - Grid danh sách template bàn đạp có sẵn giá và thời gian dựng.
  - Bảng so sánh 3 cột: Agency vs Freelancer vs GrabCode.

- [ ] **Step 4: Hoàn thiện `app/page.tsx` & Kiểm tra hiển thị**
- [ ] **Step 5: Commit Màn 1**
```bash
git add apps/web/components apps/web/app/page.tsx
git commit -m "feat(web): implement landing page and instant dispatch widget"
```

---

### Task 5: Triển khai [Màn 2] Đặt đơn & AI Brief Builder & Ký quỹ (`apps/web`)

**Files:**
- Create: `apps/web/components/AIBriefViewer.tsx`
- Create: `apps/web/components/EscrowCheckout.tsx`
- Create: `apps/web/app/order/new/page.tsx`

- [ ] **Step 1: Xây dựng AI Brief Simulator (`AIBriefViewer.tsx`)**
  - Nhận prompt từ URL query hoặc người dùng nhập vào.
  - Trạng thái phân tích: "Claude Sonnet 3.5 đang chuẩn hóa yêu cầu...".
  - Hiển thị tài liệu đặc tả:
    - Mục tiêu cốt lõi & Giới hạn phạm vi (Scope In / Scope Out).
    - Bộ 3 mốc [M1] Khởi tạo repo & Schema (20%), [M2] Core Logic & Data Flow (50%), [M3] Polish UI & Deploy (30%).
    - Tiêu chí nghiệm thu checklist.
    - Tab xem trước nội dung file `CLAUDE.md`.

- [ ] **Step 2: Xây dựng Escrow Checkout Card (`EscrowCheckout.tsx`)**
  - Tóm tắt chi phí, chính sách bảo hiểm tiền cọc 100%.
  - Tùy chọn phương thức nạp tiền ký quỹ (VietQR, Thẻ quốc tế, Chuyển khoản).
  - Nút bấm **"Ký quỹ bảo đảm & Dispatch tìm Coder"**.

- [ ] **Step 3: Xử lý sự kiện Dispatch Order**
  - Khởi tạo đơn mới trong LocalStorage.
  - Bắn sự kiện qua `BroadcastChannel("grabcode_channel")`: `EVENT_ORDER_DISPATCHED`.
  - Điều hướng người dùng sang `/order/[id]`.

- [ ] **Step 4: Commit Màn 2**
```bash
git add apps/web/components/AIBriefViewer.tsx apps/web/components/EscrowCheckout.tsx apps/web/app/order/new/page.tsx
git commit -m "feat(web): implement AI brief generator and escrow checkout flow"
```

---

### Task 6: Triển khai [Màn 3] Theo dõi đơn Live & Sandbox Preview (`apps/web`)

**Files:**
- Create: `apps/web/components/LiveStepper.tsx`
- Create: `apps/web/components/SandboxFrame.tsx`
- Create: `apps/web/components/GitTerminalLog.tsx`
- Create: `apps/web/components/OrderChatBox.tsx`
- Create: `apps/web/app/order/[id]/page.tsx`

- [ ] **Step 1: Dựng Live Stepper theo dõi 4 chặng**
  - Đang tìm Coder ➔ Coder đang làm việc ➔ QA Gate kiểm thử ➔ Sẵn sàng nghiệm thu.
  - Lắng nghe cập nhật real-time từ Coder.

- [ ] **Step 2: Dựng Sandbox Preview Frame**
  - Cửa sổ xem trước ứng dụng web demo live chạy thật.
  - Thanh địa chỉ URL giả lập, nút reload, toggle xem trên Desktop/Mobile, nút mở cửa sổ mới.

- [ ] **Step 3: Dựng Terminal Log commit & Box Chat**
  - Stream hiển thị các commit `[M1]`, `[M2]` từ Coder.
  - Box chat trao đổi trực tiếp giữa khách và coder.
  - Nút **"Nghiệm thu & Giải ngân"** kích hoạt khi các mốc hoàn thành.

- [ ] **Step 4: Commit Màn 3**
```bash
git add apps/web/components/LiveStepper.tsx apps/web/components/SandboxFrame.tsx apps/web/components/GitTerminalLog.tsx apps/web/components/OrderChatBox.tsx apps/web/app/order/[id]/page.tsx
git commit -m "feat(web): implement live order tracking, sandbox preview and chat"
```

---

### Task 7: Triển khai [Màn 4] Dashboard Tài xế Coder PWA (`apps/coder`)

**Files:**
- Create: `apps/coder/package.json`
- Create: `apps/coder/tsconfig.json`
- Create: `apps/coder/next.config.ts`
- Create: `apps/coder/tailwind.config.ts`
- Create: `apps/coder/app/layout.tsx`
- Create: `apps/coder/app/globals.css`
- Create: `apps/coder/components/DriverHeader.tsx`
- Create: `apps/coder/components/OnlineRadar.tsx`
- Create: `apps/coder/components/WaveOfferModal.tsx`
- Create: `apps/coder/components/ActiveJobWorkspace.tsx`
- Create: `apps/coder/app/page.tsx`

- [ ] **Step 1: Khởi tạo cấu hình ứng dụng Coder PWA**
  - Dependency: `@grabcode/contracts`, Tailwind Emerald theme tokens.

- [ ] **Step 2: Dựng Driver Header & Radar Online Toggle**
  - Thẻ profile: Tài xế Bùi Minh H. (Rank Vàng 4.98★), Ví thu nhập 14.850.000 đ.
  - Nút gạt chuyển Online/Offline.
  - Hiệu ứng sóng Sonar radar quét đơn động khi bật Online.

- [ ] **Step 3: Dựng Wave Offer Modal (Nổ cuốc Grab)**
  - Tự động hiển thị khi nhận được sự kiện `ORDER_DISPATCHED` từ khách.
  - Đếm ngược 30 giây kèm âm thanh thông báo.
  - Thông tin cuốc đơn: Tiền công ròng, deadline, tóm tắt brief, nút "Nhận cuốc đơn" hoặc "Từ chối".

- [ ] **Step 4: Dựng Coder IDE Workspace**
  - Hiển thị cuốc đơn đang thực hiện.
  - Nút tải `CLAUDE.md`, link clone GitHub repo.
  - Nút bấm hoàn thành từng mốc `[M1] Done`, `[M2] Done`, `[M3] Done` -> Bắn sự kiện cập nhật về màn hình khách.
  - Nút **"Nộp bài & Bàn giao POC"**.

- [ ] **Step 5: Commit Màn 4**
```bash
git add apps/coder
git commit -m "feat(coder): implement driver dashboard, radar sonar and wave offer modal"
```

---

### Task 8: Tích hợp Đồng bộ Real-time & Cross-App Event Bus

**Files:**
- Create: `packages/contracts/src/events/eventBus.ts`
- Modify: `apps/web/app/order/new/page.tsx`
- Modify: `apps/web/app/order/[id]/page.tsx`
- Modify: `apps/coder/app/page.tsx`

- [ ] **Step 1: Xây dựng Event Bus wrapper chuẩn qua BroadcastChannel**
  - Đóng gói kênh `grabcode_event_bus` với fallback `localStorage`.
  - Hỗ trợ subscribe / publish các sự kiện có type an toàn từ `@grabcode/contracts`.

- [ ] **Step 2: Kết nối toàn bộ chu trình đặt và nhận đơn**
  - Khách bấm Ký quỹ -> Coder nổ chuông nhận cuốc.
  - Coder bấm Nhận đơn -> Khách thấy trạng thái Coder đã bắt đầu.
  - Coder bấm tick mốc -> Khách thấy tiến độ nhảy % và commit log xuất hiện.
  - Coder bấm bàn giao -> Khách thấy link sandbox preview sáng lên.
  - Khách bấm Nghiệm thu -> Coder nhận thông báo tiền đã vào ví.

- [ ] **Step 3: Commit kết nối real-time**
```bash
git add packages/contracts/src/events/eventBus.ts apps/web apps/coder
git commit -m "feat: connect real-time cross-app event bus between web and coder pwa"
```

---

### Task 9: Kiểm thử Tích hợp & Kiểm tra Nghiệm thu Toàn diện

- [ ] **Step 1: Kiểm tra build TypeScript & Linting**
```bash
pnpm run build
```
- [ ] **Step 2: Chạy kiểm thử môi trường dev**
  - Mở đồng thời `apps/web` (cổng 3000) và `apps/coder` (cổng 3001).
  - Kiểm tra tính responsive trên Desktop và Mobile view.
  - Kiểm tra tính chuẩn xác của các mã màu Emerald `#00B14F`, font chữ Plus Jakarta Sans, Inter.
- [ ] **Step 3: Ghi nhận báo cáo nghiệm thu**
