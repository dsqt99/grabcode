# GrabCode On-Demand POC Marketplace — Design Specification

- **Date:** 2026-10-13
- **Author:** Antigravity AI
- **Status:** Approved by User
- **Reference Designs:** [Stitch Project 16736523020153035725](https://stitch.withgoogle.com/projects/16736523020153035725)
- **Architectural Guidelines:** [CLAUDE.md](file:///d:/code/dsqt/grabcode/CLAUDE.md), [DESIGN.md](file:///d:/code/dsqt/grabcode/DESIGN.md)

---

## 1. Executive Summary & Goals

GrabCode là sàn giao dịch đặt POC (Proof-of-Concept) theo yêu cầu với trải nghiệm siêu tốc tương tự ứng dụng gọi xe/đồ ăn Grab:
> *"Đặt POC như đặt đồ ăn — Có demo chạy thật trước bữa trưa."*

Mục tiêu của đợt triển khai này:
1. **Thiết lập Monorepo chuẩn (Turborepo + pnpm workspace)**:
   - `packages/contracts`: Định nghĩa Contract First (Types, Schemas, DTOs).
   - `apps/web`: Ứng dụng Web dành cho Khách hàng (Next.js 15 App Router).
   - `apps/coder`: Ứng dụng PWA dành cho Tài xế Coder (Next.js 15 App Router).
2. **Triển khai 5 màn hình tương tác chất lượng cao** chuyển đổi từ thiết kế Stitch Google:
   - Màn 1: Trang chủ / Landing page & Widget Instant Dispatch.
   - Màn 2: Đặt đơn & Trình tạo AI Brief tự động, chia mốc Milestone & Ký quỹ Escrow.
   - Màn 3: Theo dõi đơn trực tiếp (Live Tracking, Sandbox Preview, Git Stream, Chat).
   - Màn 4: Dashboard Tài xế Coder (Radar tìm đơn, Wave Offer nổ cuốc, IDE workspace).
3. **Cơ chế tương tác Real-time đa tab**: Đồng bộ thông suốt giữa Web Khách và Coder PWA thông qua `BroadcastChannel` và `LocalStorage` events để kiểm thử nghiệm thu toàn bộ hành trình người dùng.

---

## 2. Monorepo & File Structure

```
grabcode/
├── package.json                   # Root package & pnpm workspace scripts
├── pnpm-workspace.yaml            # packages/ & apps/ paths
├── turbo.json                     # Turborepo build pipeline
├── packages/
│   └── contracts/                 # @grabcode/contracts (Single Source of Truth)
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts           # Barrel export
│           ├── types/
│           │   ├── order.ts       # Định nghĩa Order, OrderTier, OrderStatus
│           │   ├── brief.ts       # Spec, Milestones, AcceptanceCriteria
│           │   ├── coder.ts       # CoderProfile, Tier (Bronze/Silver/Gold/Diamond)
│           │   └── wave.ts        # WaveOffer, DispatchEvent
│           └── mock/
│               └── initialData.ts # Dữ liệu mock ban đầu
├── apps/
│   ├── web/                       # Next.js 15 App (Port 3000)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── app/
│   │   │   ├── layout.tsx         # Plus Jakarta Sans, Inter, Material Symbols
│   │   │   ├── globals.css        # Emerald Mobility Design System CSS tokens
│   │   │   ├── page.tsx           # [Màn 1] Landing Page & Instant Dispatch
│   │   │   └── order/
│   │   │       ├── new/page.tsx   # [Màn 2] AI Brief & Escrow Checkout
│   │   │       └── [id]/page.tsx  # [Màn 3] Live Order Tracking & Sandbox
│   │   └── components/
│   │       ├── Header.tsx
│   │       ├── InstantDispatchWidget.tsx
│   │       ├── MilestoneList.tsx
│   │       ├── SandboxIframe.tsx
│   │       └── OrderChatBox.tsx
│   └── coder/                     # Next.js 15 PWA (Port 3001)
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── globals.css
│       │   └── page.tsx           # [Màn 4] Driver Dashboard, Radar, Wave Offer
│       └── components/
│           ├── DriverToggle.tsx
│           ├── RadarSonar.tsx
│           ├── WaveOfferModal.tsx
│           └── MilestoneUpdater.tsx
└── docs/
    └── superpowers/specs/         # Design & Architecture Specs
```

---

## 3. Shared Contract Specifications (`@grabcode/contracts`)

### 3.1. Các Enums và Kiểu dữ liệu chính

```typescript
export type OrderTier = 'EXPRESS' | 'STANDARD' | 'PRO' | 'TEMPLATE';

export type OrderStatus =
  | 'DRAFT'
  | 'DISPATCHING'
  | 'ACCEPTED'
  | 'BUILDING'
  | 'QA_TESTING'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface Milestone {
  id: string; // e.g. "M1", "M2", "M3"
  title: string;
  weightPercent: number; // e.g. 20, 50, 30
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  completedAt?: string;
  commitHash?: string;
}

export interface AIBrief {
  title: string;
  scopeSummary: string;
  features: string[];
  acceptanceCriteria: string[];
  milestones: Milestone[];
  claudeMdContent: string;
}

export interface Order {
  id: string;
  tier: OrderTier;
  title: string;
  customerPrompt: string;
  templateId?: string;
  priceVnd: number;
  escrowStatus: 'UNPAID' | 'ESCROW_LOCKED' | 'RELEASED' | 'REFUNDED';
  status: OrderStatus;
  brief: AIBrief;
  assignedCoder?: {
    id: string;
    name: string;
    avatar: string;
    tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND';
    rating: number;
    completedOrders: number;
  };
  demoUrl?: string;
  repoUrl?: string;
  createdAt: string;
  etaHours: number;
}
```

---

## 4. UI/UX & Design Tokens (Emerald Mobility Design System)

Hệ thống tuân thủ nghiêm ngặt bảng token trong [DESIGN.md](file:///d:/code/dsqt/grabcode/DESIGN.md):

- **Palette**:
  - `primary`: `#006E2E` / Dark hover `#00873D`
  - `primary-container`: `#00B14F` (Signature Emerald Grab-like color)
  - `surface`: `#F8F9FF` / `#F8FAFC`
  - `surface-container-lowest`: `#FFFFFF`
  - `on-surface`: `#0B1C30`
  - `on-surface-variant`: `#3D4A3D`
  - `secondary`: `#565E74`
  - `amber / tertiary`: `#F59E0B` (Rating, Cảnh báo, Wave timer)
- **Typography**:
  - Tiêu đề, Button, Status Badges: `Plus Jakarta Sans` (weights 600, 700, 800)
  - Body, Tabular data, Code snippets: `Inter` (weights 400, 500, 600)
- **Shape & Elevation**:
  - Nút bấm, Status Chips: `rounded-full` (Full Pill)
  - Thẻ Card: `rounded-2xl` hoặc `rounded-3xl`
  - Focus Ring: `ring-3 ring-[#00B14F]/20`

---

## 5. Screen Specifications & Flows

### 5.1. Màn 1: Trang chủ & Instant Dispatch Widget (`apps/web`)
- **Header**: Logo GrabCode, Navigation links ("Dịch vụ POC", "Bảng giá", "Menu Template", "Dành cho Coder", "Theo dõi đơn live"), Nút chuyển đổi tiền tệ VND/USD, Nút CTA "Đặt POC ngay".
- **Hero Section**: Tiêu đề ấn tượng, Badge động "🚀 Nền tảng Dispatch Code Siêu Tốc".
- **Instant Dispatch Widget**:
  - 4 tabs tốc độ (Express 3h, Standard 8h, Enterprise 24h, Mua Template).
  - Textarea nhập Prompt ý tưởng + Nút gợi ý prompt mẫu nhanh.
  - Dropdown chọn template bàn đạp + Selector framework (Next.js, FastAPI, Flutter...).
  - Báo giá tức thì và cam kết ETA.
  - Nút "Tạo AI Brief & Đặt đơn ngay" -> Điều hướng sang Màn 2.
- **Section phụ**:
  - Showcase Template có sẵn (CRM Mini, FinTech Dashboard, E-Commerce, Chatbot RAG).
  - Bảng so sánh 3 cột (GrabCode vs Agency vs Freelancer).
  - Testimonial và thống kê uy tín (99.4% đúng giờ, 500+ Coder).

### 5.2. Màn 2: Đặt đơn & AI Brief Chuẩn hóa (`apps/web`)
- **AI Brief Panel (Left Column)**:
  - Khung AI Simulator: Hiệu ứng phân tích prompt của khách thành Spec chi tiết.
  - Danh sách Milestone tự động chia trọng số [M1], [M2], [M3].
  - Tiêu chí nghiệm thu (Checklist) rõ ràng.
  - Tải trước nội dung file `CLAUDE.md` sẽ được cấp cho Coder.
- **Escrow Checkout Card (Right Column)**:
  - Tóm tắt chi phí & cam kết hoàn tiền 100%.
  - Chọn cổng thanh toán ký quỹ (VietQR, Thẻ, Chuyển khoản).
  - Nút "Ký quỹ & Bật Radar tìm Coder" -> Dispatch đơn hàng và mở Màn 3.

### 5.3. Màn 3: Theo dõi đơn Live (`apps/web`)
- **Status Stepper**: Đang ghép Coder ➔ Coder đang build ➔ QA Gate ➔ Sẵn sàng nghiệm thu.
- **Live Sandbox Preview**: Khung cửa sổ iframe hiển thị sản phẩm demo chạy thật kèm thanh điều hướng (URL bar, Device toggles).
- **Milestone Stepper**: Hiển thị trạng thái các mốc [M1], [M2], [M3] kèm commit hash và thời gian hoàn thành.
- **Git Commit Log Terminal**: Giả lập log commit của Coder đẩy về.
- **Chat Dock**: Khách chat trao đổi trực tiếp với Coder.
- **Action Buttons**: Nút "Nghiệm thu & Giải ngân" và "Yêu cầu sửa (Còn 2 lượt)".

### 5.4. Màn 4: Dashboard Tài xế Coder (`apps/coder`)
- **Driver Header**: Thông tin Coder (Cấp bậc Vàng 4.9★, Thu nhập hôm nay).
- **Status Toggle**: Nút gạt "Sẵn sàng nhận đơn (Online)" / "Offline".
- **Radar Sonar Animation**: Hiệu ứng sóng radar xoay quét tìm đơn khi bật Online.
- **Wave Offer Modal (Nổ cuốc)**:
  - Popup xuất hiện kèm âm thanh thông báo.
  - Thù lao net, deadline cam kết, tiêu chí brief.
  - Đếm ngược 30 giây: Nút "Nhận đơn" hoặc "Bỏ qua".
- **Active Job Workspace**:
  - Hiển thị task đang làm, nút tải `CLAUDE.md`, link repo.
  - Action tick hoàn thành các mốc [M1], [M2], [M3].
  - Nút "Bàn giao POC & Kích hoạt QA Gate".

---

## 6. Real-time Cross-App Synchronization Logic

```
[apps/web (Port 3000)]                             [apps/coder (Port 3001)]
        │                                                    │
        │── 1. Khách bấm 'Ký quỹ & Dispatch' ───────────────>│
        │   (BroadcastChannel: EVENT_ORDER_DISPATCHED)       │ (Hiện Wave Offer Modal 30s)
        │                                                    │
        │<── 2. Coder bấm 'Nhận đơn' ────────────────────────│
        │   (BroadcastChannel: EVENT_ORDER_ACCEPTED)         │
        │ (Chuyển stepper sang 'Coder đang build')           │
        │                                                    │
        │<── 3. Coder bấm 'Xong mốc [M2]' ───────────────────│
        │   (BroadcastChannel: EVENT_MILESTONE_UPDATED)      │
        │ (Tiến độ tăng lên 70%, Git log cập nhật)           │
        │                                                    │
        │<── 4. Coder bấm 'Bàn giao POC' ────────────────────│
        │   (BroadcastChannel: EVENT_ORDER_DELIVERED)        │
        │ (Sandbox Preview kích hoạt, hiện nút Nghiệm thu)   │
        │                                                    │
        │── 5. Khách bấm 'Nghiệm thu & Giải ngân' ──────────>│
        │   (BroadcastChannel: EVENT_ORDER_COMPLETED)        │ (Cộng tiền vào ví Coder)
```

---

## 7. Verification & Acceptance Criteria

1. **Turborepo Workspace build thành công**:
   - `pnpm install` cài đặt sạch sẽ.
   - `packages/contracts` biên dịch types không lỗi.
   - `apps/web` và `apps/coder` chạy song song mượt mà trên port 3000 và 3001.
2. **Giao diện chuẩn xác theo Stitch**:
   - Đúng màu sắc Emerald `#00B14F`, font chữ Plus Jakarta Sans và Inter.
   - Trực quan, responsive, đầy đủ icons và micro-interactions.
3. **Luồng tương tác End-to-End hoạt động**:
   - Tạo đơn ở `apps/web` -> Nổ thông báo ở `apps/coder`.
   - Coder nhận đơn & tick mốc -> `apps/web` tự động cập nhật tiến độ tức thì.
