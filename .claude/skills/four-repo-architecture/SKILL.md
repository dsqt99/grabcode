---
name: four-repo-architecture
description: Kiến trúc phân rã ứng dụng thành 4 thành phần độc lập (repo-app, repo-admin, repo-api, repo-worker) cùng Shared Contract và quy trình điều phối Multi-Agent cho AI coding.
---

# 4-Repo Architecture & Multi-Agent Orchestration Skill

Kỹ năng này hướng dẫn cách thiết kế, phân chia trách nhiệm và điều phối AI Agents khi phát triển ứng dụng quy mô từ vừa đến lớn theo mô hình 4 thành phần độc lập: **App**, **Admin**, **API**, **Worker** xoay quanh **Shared Contract**.

---

## 1. Triết lý & Vì sao không nhét tất cả vào một khối duy nhất?

Khi một ứng dụng bắt đầu phát triển các tính năng như: AI Generation, Video/Audio processing, Queue, Payment, User auth, Admin portal, GPU compute... việc giữ chung một monolith khổng lồ mang lại nhiều rủi ro:
1. **AI Context Window Bloat**: Khiến Claude/Codex/Antigravity phải đọc hàng chục nghìn dòng code không liên quan, dễ dẫn đến hiện tượng hallucination hoặc sửa nhầm code của module khác (ví dụ: nhờ sửa giao diện landing page lại vô tình chạm vào backend payment).
2. **Nghẽn hiệu năng (Resource Contention)**: Biến API server thành nơi render video, gọi LLM hoặc xử lý file nặng làm nghẽn request của người dùng cuối.
3. **Scale bất đối xứng**: Frontend và Admin cần scale theo lượt truy cập, API cần scale theo request/s, còn Worker cần scale theo GPU/CPU và hàng đợi (Queue).

---

## 2. Bản đồ 4 thành phần & Ranh giới trách nhiệm

| Thành phần | Vai trò chính | Nhiệm vụ cụ thể | Những điều TUYỆT ĐỐI KHÔNG làm |
| :--- | :--- | :--- | :--- |
| **`repo-app`** *(Client App)* | Giao diện người dùng cuối | - Web app, Dashboard, Landing page<br>- Form tạo project, upload file, preview<br>- Real-time WebSocket listening<br>- Consume API theo generated SDK | - KHÔNG gọi trực tiếp cơ sở dữ liệu<br>- KHÔNG tự bịa type/schema khi chưa có Contract<br>- KHÔNG can thiệp nghiệp vụ quản trị |
| **`repo-admin`** *(Admin Portal)* | Giao diện quản trị vận hành | - Quản lý người dùng, phân quyền, KYC<br>- Cấu hình AI Provider (API keys, model params, rate limits)<br>- Quản lý hạn mức (quota), bảng giá, thanh toán<br>- Xử lý khiếu nại (disputes), xem log hệ thống | - KHÔNG can thiệp luồng thanh toán client<br>- KHÔNG tự ý đổi schema API mà không qua Contract |
| **`repo-api`** *(Backend/API Gateway)* | Trung tâm điều phối & nghiệp vụ | - Authentication & Authorization<br>- Database transactions (PostgreSQL, ACID)<br>- Business logic & State machine<br>- Validation dữ liệu đầu vào<br>- Ghi nhận job & Dispatch sự kiện (Outbox) | - **CẤM CHẠY TÁC VỤ NẶNG** (render video, TTS, AI generation kéo dài > 3s)<br>- KHÔNG chạy long-polling các dịch vụ bên ngoài |
| **`repo-worker`** *(Background Workers)* | Xử lý công việc nặng & chạy nền | - AI generation (LLM, Seedance, Midjourney, Veo, Minimax...)<br>- Render video, chỉnh sửa ảnh, TTS, lip-sync<br>- Polling API bên thứ 3 và tải output về Cloud Storage<br>- Tương tác GitHub App, CI/CD, deploy sandbox<br>- Gửi thông báo (Email, Zalo, Push) | - KHÔNG trực tiếp phục vụ HTTP request của người dùng<br>- KHÔNG được chạy tác vụ không có cơ chế Idempotency/Retry |
| **`contracts/`** *(Single Source of Truth)* | Hợp đồng giao tiếp chung | - OpenAPI 3.1 schema cho REST API<br>- JSON Schema / Protobuf cho Event Queue<br>- Code-gen models & types cho TypeScript/Go/Python | - Mọi thay đổi về cấu trúc dữ liệu **BẮT BUỘC** bắt đầu từ đây |

---

## 3. Quy tắc Vàng: Shared Contract First

### Vấn đề thường gặp: "Frontend tự đoán Schema"
Frontend mong đợi:
```json
{
  "video": "https://cdn.example.com/demo.mp4"
}
```
Nhưng Backend API trả về:
```json
{
  "video_url": "https://cdn.example.com/demo.mp4"
}
```
=> Kết quả: UI vỡ, gãy liên kết, AI debug lòng vòng mất thời gian.

### Giải pháp bắt buộc:
1. **Một nguồn sự thật duy nhất (Single Source of Truth)**: Định nghĩa toàn bộ DTOs, Enums, Request/Response trong thư mục `contracts/` (hoặc repo `shared-contracts`).
2. **Tự động sinh Code (Code Generation)**:
   - TypeScript DTOs cho `repo-app` và `repo-admin`.
   - Backend Types/Validators cho `repo-api`.
   - Worker Event Types cho `repo-worker`.
3. Bất kỳ khi nào thêm/sửa một trường dữ liệu (field): **Sửa Contract trước -> Chạy lệnh build generate types -> Triển khai tới API, Worker và App.**

---

## 4. Multi-Agent Orchestration Playbook

Khi giao việc cho AI Coding Agents, hãy chia nhỏ bài toán thành các phiên làm việc độc lập với prompt chuyên biệt:

### Bước 0: Agent Lead (Định nghĩa Contract)
```text
Task: Định nghĩa Contract cho tính năng [Feature Name].
- Target: contracts/
- Nhiệm vụ:
  1. Thêm schema request/response vào OpenAPI.
  2. Thêm Event payload schema cho Worker queue.
  3. Chạy lệnh sinh types cho các repo khác.
- Ràng buộc: Không viết logic xử lý, chỉ định nghĩa contract và validate rule.
```

### Bước 1: Agent 1 (Backend Core API)
```text
Task: Triển khai API cho tính năng [Feature Name].
- Target: repo-api (hoặc services/core-api)
- Context nạp vào: contracts/types, DB schema
- Nhiệm vụ:
  1. Viết controller & service theo contract đã định nghĩa.
  2. Thực hiện validation & lưu trạng thái DB.
  3. Ghi Transactional Outbox event để đẩy job cho Worker.
- Ràng buộc: KHÔNG gọi trực tiếp dịch vụ xử lý nặng. Phải trả response nhanh (< 200ms).
```

### Bước 2: Agent 2 (Background Worker)
```text
Task: Triển khai Worker xử lý [Feature Name].
- Target: repo-worker (hoặc workers/)
- Context nạp vào: contracts/events, worker runtime
- Nhiệm vụ:
  1. Lắng nghe event từ Queue (NATS/RabbitMQ/Redis).
  2. Kiểm tra Idempotency chống trùng lặp.
  3. Gọi AI provider/xử lý nặng với exponential backoff retry.
  4. Lưu kết quả vào Storage và bắn event hoàn thành.
```

### Bước 3: Agent 3 (Client App Frontend)
```text
Task: Xây dựng UI cho tính năng [Feature Name].
- Target: repo-app (hoặc apps/web)
- Context nạp vào: contracts/types (chỉ import type, không tự tạo mock type tự chế)
- Nhiệm vụ:
  1. Dựng màn hình, component form, preview.
  2. Tích hợp hook gọi API và lắng nghe WebSocket tiến độ.
  3. Xử lý UI states: idle, loading, processing, success, error.
```

### Bước 4: Agent 4 (Admin Portal Frontend)
```text
Task: Xây dựng màn hình quản trị cho [Feature Name].
- Target: repo-admin (hoặc apps/admin)
- Context nạp vào: contracts/types
- Nhiệm vụ:
  1. Màn hình cấu hình provider, API Key, quota, toggle feature flag.
  2. Bảng theo dõi tiến độ công việc, log lỗi của worker.
```

---

## 5. Ví dụ thực chiến

### Ví dụ 1: Tích hợp Provider AI mới (Seedance 2.5)
Khi có yêu cầu: *"Thêm provider Seedance 2.5 để sinh video"*:
1. **`contracts`**:
   - Thêm enum `AIProvider.SEEDANCE_2_5`.
   - Thêm `SeedanceJobConfig` (aspect_ratio, motion_level, duration).
2. **`repo-api`**:
   - Endpoint `POST /api/v1/generations`: validate input, tạo record `generation_job` trạng thái `queued`.
   - Publish outbox event `generation.seedance.requested`.
3. **`repo-worker`**:
   - Worker nhận event, gọi Seedance API, poll trạng thái đến khi hoàn tất.
   - Download video mp4, upload vào Cloud Storage riêng của hệ thống.
   - Cập nhật kết quả qua webhook hoặc event `generation.seedance.completed`.
4. **`repo-admin`**:
   - Thêm form nhập API Key của Seedance, thiết lập giá credit trên mỗi giây video, bật/tắt provider.
5. **`repo-app`**:
   - Thêm option "Seedance 2.5" vào dropdown chọn model video, hiển thị preview player khi nhận kết quả.

---

### Ví dụ 2: Quy trình sản xuất phim AI đa tầng (AI Film Pipeline)
Workflow: **Truyện -> Kịch bản -> Nhân vật -> Storyboard -> Ảnh -> Video -> Voice -> Film**

Phân bổ trách nhiệm cho 4 thành phần:
- **`repo-api`**:
  - Quản lý cấu trúc dữ liệu thực thể:
    ```
    Project
    ├── Story
    ├── Character
    ├── Scene
    ├── Shot
    ├── Asset
    └── Generation
    ```
  - State machine của từng shot/phim (draft -> generating -> ready -> failed).
- **`repo-worker`**:
  - Thực thi các lệnh phân rã & tạo media:
    * `story-to-script` (LLM prompt phân rã kịch bản)
    * `script-to-scene` (Trích xuất bối cảnh & danh sách nhân vật)
    * `scene-to-shot` (Phân chia camera angle, prompt miêu tả)
    * `generate-image` (Flux / Midjourney / Stable Diffusion)
    * `generate-video` (Kling / Runway / Seedance / Veo / Minimax)
    * `generate-voice` & `lip-sync` (ElevenLabs / FPT AI)
    * `render-film` (FFmpeg concatenate video, mux audio)
- **`repo-app`**:
  - Giao diện người dùng: Trình biên tập kịch bản phân cảnh, Timeline dựng phim, visual storyboard viewer, nút regenerate cho từng shot.
- **`repo-admin`**:
  - Quản lý tài nguyên GPU, theo dõi chi phí API từng provider, phân bổ quota cho từng gói người dùng.

---

## 6. Pre-flight Checklist trước khi Commit / Nghiệm thu

Trước khi bàn giao bất kỳ task nào theo kiến trúc này, hãy tự kiểm tra:

- [ ] **Contract Sync**: Schema tại `contracts/` đã được commit trước hoặc đồng thời với code logic chưa?
- [ ] **No Guessing**: Code frontend (`app`, `admin`) có dùng type sinh từ contract không, hay đang tự cast `any` / tự gõ interface?
- [ ] **API Lightness**: Trong `repo-api` có hàm nào chạy quá 500ms hoặc gọi trực tiếp dịch vụ sinh media nặng không? (Nếu có -> phải chuyển sang worker).
- [ ] **Worker Idempotency**: Worker có kiểm tra ID sự kiện đã xử lý chưa để chống duplicate khi network retry?
- [ ] **Data Ownership**: Mỗi module có tự quản lý dữ liệu của mình không, có vi phạm join chéo trực tiếp giữa các domain không?
