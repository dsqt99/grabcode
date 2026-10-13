# GrabCode — Kiến trúc kỹ thuật và tài liệu triển khai

Oct 13, 2026 · @haidm99

## 1. Mục tiêu, phạm vi và yêu cầu phi chức năng

Tài liệu này là spec để đội dev build GrabCode từ MVP lên quy mô 100.000 đơn/tháng và 50.000 coder mà không phải viết lại kiến trúc. Mỗi phần nêu thiết kế, lý do chọn và tiêu chí hoàn thành; chỗ nào là giả định sẽ ghi rõ.

**Trong phạm vi phiên bản 1**: đặt đơn và AI Brief, duyệt spec và ký quỹ, matching và dispatch coder, tạo repo GitHub private kèm docs khởi tạo, tiến độ % realtime, QA Gate, deploy sandbox demo, nghiệm thu và giải ngân, chat trong đơn có che liên lạc, mở kết nối sau POC, trang quản trị vận hành.

**Ngoài phạm vi phiên bản 1**: giai đoạn triển khai có sàn trung gian (chỉ chuẩn bị mô hình dữ liệu), thanh toán quốc tế bằng USD, chợ template cho coder bán, ứng dụng mobile native cho khách.

| Yêu cầu phi chức năng | MVP (3.000 đơn/tháng) | Thiết kế cho (100.000 đơn/tháng) |
| --- | --- | --- |
| Từ lúc đơn sẵn sàng đến lúc offer đầu tiên tới coder (p95) | ≤ 2 giây | ≤ 500 ms |
| Từ lúc khách duyệt đến lúc có coder nhận (p50) | ≤ 5 phút | ≤ 2 phút |
| Từ commit đến khi % hiện trên màn hình hai bên (p95) | ≤ 5 giây | ≤ 2 giây |
| API đọc (p95) | ≤ 300 ms | ≤ 150 ms |
| Tìm kiếm template, đơn, coder trong admin (p95) | ≤ 500 ms | ≤ 200 ms |
| Đỉnh yêu cầu matching | 5/giây | 200/giây |
| Kết nối WebSocket đồng thời | 2.000 | 100.000 |
| Uptime luồng đặt đơn và thanh toán | 99,5% | 99,9% |
| RPO / RTO cơ sở dữ liệu | 15 phút / 4 giờ | 5 phút / 1 giờ |

**Thuật ngữ dùng trong tài liệu**

| Thuật ngữ | Nghĩa |
| --- | --- |
| Order (đơn) | Một yêu cầu POC từ lúc khách gửi đến lúc đóng |
| Brief / Spec | Bản chuẩn hóa do AI viết, khách duyệt: phạm vi, mốc, tiêu chí nghiệm thu, giá |
| Milestone (mốc) | Đơn vị công việc có trọng số %, là cơ sở tính tiến độ |
| Offer | Lời mời nhận đơn gửi tới một coder, có hạn trả lời |
| Wave | Một đợt gửi offer song song cho nhóm coder đứng đầu bảng điểm |
| Sandbox | Môi trường chạy demo riêng của từng đơn |
| Connection (kết nối) | Trạng thái hai bên đã cùng accept sau khi khách chấp thuận POC |

## 2. Tổng quan kiến trúc

Hệ thống gồm một Core API dạng modular monolith, một Matching service viết riêng vì nó là đường nóng cần độ trễ thấp, một realtime gateway cho WebSocket, và một nhóm worker xử lý mọi việc nặng hoặc phụ thuộc dịch vụ ngoài.

&#91;embedded content: kiến trúc hệ thống · 6 lớp, từ client đến dịch vụ ngoài\]

**Nguyên tắc thiết kế bắt buộc**

1. **Modular monolith trước, microservice sau.** Core API là một deployable, chia module có ranh giới cứng: mỗi module sở hữu schema Postgres riêng, không join chéo module, giao tiếp qua interface hoặc sự kiện. Khi một module cần scale riêng, tách ra không phải viết lại.
2. **Postgres là nguồn sự thật duy nhất.** Redis và OpenSearch chỉ là bản phái sinh, phải dựng lại được hoàn toàn từ Postgres bằng một lệnh reindex.
3. **Transactional outbox.** Mọi thay đổi trạng thái ghi sự kiện vào bảng outbox trong cùng transaction; một relay đọc outbox và publish lên NATS. Không bao giờ publish trực tiếp trong request handler.
4. **Idempotency mọi nơi.** API ghi nhận header Idempotency-Key; consumer chống xử lý trùng bằng bảng processed\_events theo event\_id; webhook GitHub và cổng thanh toán khử trùng theo delivery id.
5. **Service stateless.** Không giữ trạng thái trong bộ nhớ process; mọi instance thay thế được cho nhau để autoscale.
6. **Gọi dịch vụ ngoài chỉ từ worker.** LLM, GitHub, cổng thanh toán, deploy đều chạy qua job có retry và backoff, để lỗi bên ngoài không làm treo request của người dùng.

## 3. Tech stack và hạ tầng

Stack ưu tiên một ngôn ngữ chính (TypeScript) để đội nhỏ di chuyển nhanh, chỉ dùng Go cho Matching service vì cần độ trễ thấp và concurrency cao.

| Lớp | Lựa chọn | Lý do | Khi nào đổi |
| --- | --- | --- | --- |
| Web khách, admin | Next.js 15, TypeScript, Tailwind, TanStack Query | SSR cho trang landing và SEO, chung ngôn ngữ với backend | Không cần đổi |
| App coder | PWA (Next.js) ở giai đoạn 1, React Native (Expo) ở giai đoạn 2 | Offer cần push đáng tin cậy và âm báo; PWA đủ cho beta | Khi tỉ lệ offer bị lỡ do không nhận push > 5% |
| Core API | NestJS trên Node 22, Drizzle ORM, SQL thuần cho truy vấn có khóa | Module hóa sẵn, hợp modular monolith | Tách module khi một module chiếm > 40% tải |
| Matching | Go 1.23, go-redis, pgx | Đường nóng, xử lý hàng nghìn ứng viên mỗi lần chấm điểm | Không cần đổi |
| Realtime | Centrifugo v5, Redis engine | Server WebSocket chuyên dụng, scale ngang, có presence và history | NATS broker khi > 100.000 kết nối |
| Cơ sở dữ liệu | Cloud SQL PostgreSQL 16 (HA, 1 read replica), extension pgvector, pg\_trgm | Giao dịch, khóa hàng, JSONB, vector trong một hệ | Partition bảng sự kiện khi > 50 triệu dòng |
| Cache, trạng thái coder | Memorystore Redis 7 (HA) | Chỉ mục matching trong bộ nhớ, khóa phân tán, rate limit | Redis Cluster khi > 25 GB hoặc > 100.000 ops/giây |
| Event bus, job queue | NATS JetStream (3 node) | Nhẹ, có ack, retry, consumer group, đủ cho quy mô thiết kế | Kafka/Redpanda khi cần lưu stream dài hạn để phân tích |
| Tìm kiếm | Giai đoạn 1: Postgres full-text + pg\_trgm; giai đoạn 2: OpenSearch (managed, Singapore) | Không thêm hệ thống khi chưa cần | Khi > 50.000 template/đơn cần facet, hoặc p95 tìm kiếm > 300 ms |
| LLM | Claude API: claude-sonnet-5-5 cho Brief, claude-haiku-5-5 cho phân loại và che liên lạc | Chất lượng spec quyết định giá và matching | Đổi model qua cấu hình, không hard-code |
| Lưu trữ file | Cloud Storage, mã hóa CMEK, URL ký có hạn | File khách đính kèm, ảnh QA, artifact build | Không cần đổi |
| Chạy service | GKE Autopilot, region asia-southeast1 (Singapore) | WebSocket lâu dài, NATS, worker chạy liên tục | Không cần đổi |
| Sandbox demo | Cloud Run, mỗi đơn một service, scale về 0 | Cô lập, rẻ khi không ai xem, có URL riêng | Firecracker tự quản khi > 20.000 demo đang sống |
| Thanh toán | VNPay, MoMo (giai đoạn 1), Stripe (khi mở USD) | Thị trường Việt Nam trước | — |
| Thông báo | Zalo ZNS, Firebase Cloud Messaging, email qua Resend | Khách Việt Nam dùng Zalo, coder dùng push | — |
| Hạ tầng như code, CI/CD | Terraform, GitHub Actions, Argo CD | GitOps, dựng lại môi trường từ đầu được | — |
| Quan sát | OpenTelemetry, Grafana Cloud (Prometheus, Loki, Tempo), Sentry | Trace xuyên service, log, lỗi frontend | — |

Ba môi trường: dev (dùng chung), staging (bản sao prod thu nhỏ, dữ liệu giả), prod. Nếu sau này cần lưu dữ liệu tại Việt Nam theo yêu cầu pháp lý, Postgres và Cloud Storage là hai thành phần phải chuyển sang nhà cung cấp trong nước (Viettel IDC, FPT Cloud); kiến trúc không phụ thuộc dịch vụ độc quyền của GCP ngoài Cloud Run, nên chuyển được.

**Cấu trúc monorepo** (pnpm + Turborepo):

```
grabcode/
  apps/
    web/            # Next.js – khách hàng
    coder/          # PWA – coder
    admin/          # Next.js – vận hành
  services/
    core-api/       # NestJS modular monolith
      src/modules/{identity,orders,briefs,payments,ledger,chat,connections,repos,progress,qa,deploy,admin}
    matching/       # Go
  workers/
    brief-worker/  repo-worker/  qa-worker/  deploy-worker/  indexer/  notifier/  outbox-relay/
  packages/
    contracts/      # OpenAPI 3.1 + JSON Schema cho sự kiện, sinh client TS và Go
    ui/             # design system dùng chung
    config/         # eslint, tsconfig
  infra/
    terraform/  k8s/  argocd/
  templates/        # repo khởi đầu cho từng loại POC
```

## 4. Mô hình dữ liệu

Mỗi module sở hữu một schema Postgres riêng; module khác chỉ đọc qua API nội bộ hoặc sự kiện, không join chéo schema. Quy ước chung: khóa chính UUIDv7 (tăng theo thời gian, index gọn), tiền lưu bằng bigint theo đơn vị nhỏ nhất (VND là đồng) kèm cột currency, mọi bảng có created\_at và updated\_at, bảng có cập nhật đồng thời dùng cột version để khóa lạc quan.

| Schema (module) | Bảng chính | Ghi chú |
| --- | --- | --- |
| identity | users, customer\_profiles, coder\_profiles, coder\_skills, skills, sessions | Coder bắt buộc liên kết GitHub qua OAuth |
| orders | orders, briefs, milestones, reviews, disputes | orders là aggregate trung tâm |
| matching | match\_requests, offers, coder\_stats\_daily | Matching service ghi offers, Core API đọc |
| repos | repos, commits, progress\_snapshots | Ghi từ webhook GitHub |
| qa, deploy | qa\_runs, deployments | Mỗi lần giao tạo một qa\_run và một deployment |
| payments, ledger | payments, ledger\_accounts, ledger\_entries, payouts | Sổ cái kép, chỉ thêm không sửa |
| chat | conversations, messages, redaction\_flags | Lưu cả bản gốc (mã hóa) và bản đã che |
| connections | connections | Trạng thái mở liên lạc sau POC |
| platform | outbox, processed\_events, audit\_logs, templates | Hạ tầng sự kiện và nhật ký |

DDL các bảng lõi (rút gọn cột hiển thị, giữ đủ ràng buộc quan trọng):

```sql
-- identity
CREATE TABLE identity.coder_profiles (
  user_id          uuid PRIMARY KEY REFERENCES identity.users(id),
  github_id        bigint UNIQUE NOT NULL,
  github_login     text NOT NULL,
  tier             smallint NOT NULL DEFAULT 1,      -- 1 Đồng .. 4 Kim cương
  rating_avg       numeric(3,2) NOT NULL DEFAULT 0,
  rating_count     int NOT NULL DEFAULT 0,
  on_time_rate     numeric(4,3) NOT NULL DEFAULT 0,   -- 0..1
  first_pass_rate  numeric(4,3) NOT NULL DEFAULT 0,
  accept_rate      numeric(4,3) NOT NULL DEFAULT 0,
  completed_count  int NOT NULL DEFAULT 0,
  max_concurrent   smallint NOT NULL DEFAULT 1,
  kyc_status       text NOT NULL DEFAULT 'none',      -- none|pending|verified
  status           text NOT NULL DEFAULT 'active',    -- active|suspended|banned
  profile_embedding vector(1024),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE identity.coder_skills (
  coder_id  uuid REFERENCES identity.coder_profiles(user_id),
  skill_id  int  REFERENCES identity.skills(id),
  level     smallint NOT NULL CHECK (level BETWEEN 1 AND 5),
  verified  boolean NOT NULL DEFAULT false,          -- true khi đã giao đơn dùng skill này
  PRIMARY KEY (coder_id, skill_id)
);

-- orders
CREATE TABLE orders.orders (
  id            uuid PRIMARY KEY,
  code          text UNIQUE NOT NULL,                 -- GC-261013-7K2Q
  customer_id   uuid NOT NULL,
  package       text NOT NULL,                        -- express|standard|pro
  status        text NOT NULL,                        -- xem state machine, mục 5
  title         text NOT NULL,
  raw_request   text NOT NULL,
  current_brief_id uuid,
  price_amount  bigint,
  currency      char(3) NOT NULL DEFAULT 'VND',
  coder_id      uuid,
  deadline_at   timestamptz,                          -- tính khi coder nhận
  progress_pct  smallint NOT NULL DEFAULT 0,
  version       int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON orders.orders (status, created_at);
CREATE INDEX ON orders.orders (coder_id) WHERE status IN ('assigned','building','qa','delivered');

CREATE TABLE orders.briefs (
  id               uuid PRIMARY KEY,
  order_id         uuid NOT NULL REFERENCES orders.orders(id),
  version          int NOT NULL,
  spec             jsonb NOT NULL,     -- mô tả, màn hình, tích hợp, ràng buộc
  acceptance       jsonb NOT NULL,     -- [{id, text, how_to_verify}]
  required_skills  jsonb NOT NULL,     -- [{skill_id, min_level, weight}]
  complexity       smallint NOT NULL,  -- 1..5
  est_hours        numeric(4,1) NOT NULL,
  embedding        vector(1024),
  approved_at      timestamptz,
  UNIQUE (order_id, version)
);

CREATE TABLE orders.milestones (
  id         uuid PRIMARY KEY,
  order_id   uuid NOT NULL REFERENCES orders.orders(id),
  code       text NOT NULL,                  -- M1, M2...
  title      text NOT NULL,
  weight_pct smallint NOT NULL CHECK (weight_pct BETWEEN 1 AND 100),
  status     text NOT NULL DEFAULT 'todo',   -- todo|claimed_done|verified
  done_sha   text,
  verified_at timestamptz,
  UNIQUE (order_id, code)
);
-- ràng buộc ở tầng ứng dụng: tổng weight_pct của một đơn = 100

-- matching
CREATE TABLE matching.offers (
  id             uuid PRIMARY KEY,
  order_id       uuid NOT NULL,
  coder_id       uuid NOT NULL,
  wave           smallint NOT NULL,
  score          numeric(6,4) NOT NULL,
  score_detail   jsonb NOT NULL,           -- từng thành phần điểm, để debug và giải thích
  status         text NOT NULL,            -- sent|accepted|declined|expired|cancelled
  sent_at        timestamptz NOT NULL,
  expires_at     timestamptz NOT NULL,
  responded_at   timestamptz,
  UNIQUE (order_id, coder_id)
);
-- chặn ở tầng DB việc hai coder cùng nhận một đơn
CREATE UNIQUE INDEX offers_one_accept ON matching.offers (order_id) WHERE status = 'accepted';

-- connections
CREATE TABLE connections.connections (
  id                   uuid PRIMARY KEY,
  order_id             uuid UNIQUE NOT NULL,
  customer_id          uuid NOT NULL,
  coder_id             uuid NOT NULL,
  poc_approved_at      timestamptz NOT NULL,  -- bắt buộc có trước khi tạo dòng
  customer_accepted_at timestamptz,
  coder_accepted_at    timestamptz,
  opened_at            timestamptz,           -- set khi cả hai đã accept
  mode                 text                   -- direct|managed
);

-- platform
CREATE TABLE platform.outbox (
  id             uuid PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id   uuid NOT NULL,
  event_type     text NOT NULL,
  payload        jsonb NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  published_at   timestamptz
);
CREATE INDEX outbox_unpublished ON platform.outbox (created_at) WHERE published_at IS NULL;
```

Bảng commits, messages và audit\_logs tăng nhanh nhất; partition theo tháng bằng pg\_partman ngay từ đầu để sau này archive dễ, không phải migrate lớn.

## 5. Vòng đời đơn hàng (state machine)

Trạng thái đơn là xương sống của hệ thống: mọi module phản ứng theo sự kiện chuyển trạng thái, và chỉ module orders được đổi trạng thái.

&#91;embedded content: state machine của đơn · 11 trạng thái chính, 3 vòng lặp\]

| Từ | Sang | Kích hoạt bởi | Điều kiện và tác dụng phụ |
| --- | --- | --- | --- |
| draft | briefing | Khách gửi yêu cầu | Tạo job brief.generate |
| briefing | awaiting\_approval | Brief worker xong | Lưu brief version mới, thông báo khách |
| awaiting\_approval | briefing | Khách yêu cầu sửa | Tối đa 3 lần, sau đó chuyển nhân viên vận hành |
| awaiting\_approval | awaiting\_payment | Khách duyệt | Khóa brief version, chốt giá |
| awaiting\_payment | matching | Webhook thanh toán thành công | Ghi sổ cái vào tài khoản ký quỹ, phát order.ready\_for\_matching |
| matching | assigned | Coder accept offer | Set deadline\_at = now + SLA gói, phát order.assigned |
| matching | refunded | Hết số wave tối đa và quá thời gian chờ của gói | Hoàn tiền tự động, báo vận hành |
| assigned | building | Repo tạo xong và đã gửi lời mời collaborator | Bắt đầu đếm SLA |
| building | qa | Coder chạy lệnh deliver | Tạo qa\_run cho commit HEAD |
| qa | building | QA chưa đạt | Trả báo cáo cho coder, khách không thấy |
| qa | delivered | QA đạt, deployment live | Gửi link demo cho khách |
| delivered | building | Khách yêu cầu sửa | Tối đa 2 lượt miễn phí trong phạm vi spec |
| delivered | approved | Khách chấp thuận, hoặc tự động sau 24 giờ im lặng | Mở nút accept kết nối (mục 10) |
| delivered | disputed | Khách mở tranh chấp | Đóng băng giải ngân, giao vận hành xử lý |
| approved | closed | Job payout chạy xong | Giải ngân, gỡ quyền coder khỏi repo, lưu trữ sandbox 14 ngày |
| assigned, building | matching | Coder bỏ đơn, hoặc quá 50% thời hạn mà tiến độ dưới 20% | Gỡ quyền repo, ghép lại, giữ nguyên repo và code, trừ điểm coder |

**Cách cài đặt**: bảng chuyển trạng thái khai báo tĩnh trong module orders dưới dạng hàm thuần `transition(order, event) → { next, effects[] }`, có unit test cho từng dòng của bảng trên. Ghi xuống DB bằng `UPDATE ... SET status = $next, version = version + 1 WHERE id = $id AND status = $from AND version = $v` cùng transaction với dòng outbox; nếu 0 dòng bị ảnh hưởng thì tải lại và thử lại, không bao giờ ghi đè. Job hẹn giờ (hết hạn offer, tự duyệt sau 24 giờ, kiểm tra trễ hạn) chạy qua delayed message của NATS, không dùng cron quét bảng.

## 6. Tìm kiếm và matching tốc độ cao

Matching phải trả lời trong vài trăm mili giây dù có 50.000 coder, nên mọi bước lọc đều chạy trên chỉ mục trong Redis, chấm điểm chạy trong bộ nhớ của Matching service, còn Postgres chỉ được chạm ở bước khóa cuối cùng.

&#91;embedded content: pipeline matching · từ đơn sẵn sàng đến đã gán\]

### 6.1 Chỉ mục trạng thái coder trong Redis

| Key | Kiểu | Nội dung | Cập nhật khi |
| --- | --- | --- | --- |
| `coder:{id}` | HASH | tier, active\_orders, max\_concurrent, rating\_bayes, on\_time, first\_pass, accept\_rate, median\_response\_s, last\_assigned\_at | Sự kiện từ Core API qua indexer |
| `idx:available` | SET | Coder đang online và còn slot (active\_orders < max\_concurrent) | Bật/tắt nhận đơn, nhận/đóng đơn, mất heartbeat |
| `idx:skill:{skill_id}:L{n}` | SET | Coder có skill đó ở level ≥ n (coder level 4 nằm trong L1..L4) | Sửa hồ sơ, skill được xác minh |
| `idx:pkg:{package}` | SET | Coder đủ hạng nhận gói (Express: mọi hạng; Standard: ≥ Bạc; Pro: ≥ Vàng) | Đổi hạng |
| `idx:lastseen` | ZSET | score = thời điểm heartbeat cuối | Mỗi heartbeat 30 giây |
| `offer_lock:coder:{id}` | STRING, TTL | Coder đang có một offer mở, không nhận offer thứ hai | Gửi offer, hết hạn, trả lời |
| `order:{id}:assignee` | STRING | Coder đã thắng đơn | Accept thành công |

Một sweeper chạy mỗi 15 giây lấy `ZRANGEBYSCORE idx:lastseen 0 (now-90s)` và gỡ các coder đó khỏi `idx:available`; không dùng keyspace notification vì Redis không đảm bảo giao. Toàn bộ chỉ mục dựng lại được từ Postgres bằng lệnh `matching reindex`, chạy dưới 30 giây cho 50.000 coder.

### 6.2 Lọc cứng và nới điều kiện

Ràng buộc cứng: còn slot, đang online, đủ hạng cho gói, có mọi skill bắt buộc ở level tối thiểu, không bị khóa, chưa từng nhận offer của đơn này, không có đánh giá xấu với cùng khách, không đang giữ offer khác. Skill bắt buộc là skill có weight ≥ 0,3 trong brief; các skill còn lại chỉ cộng điểm.

```lua
-- KEYS: idx:available, idx:pkg:{pkg}, idx:skill:{s1}:L{n1}, ...  ARGV[1] = limit
local tmp = 'tmp:cand:' .. redis.call('INCR', 'seq:cand')
redis.call('SINTERSTORE', tmp, unpack(KEYS))
redis.call('EXPIRE', tmp, 5)
local ids = redis.call('SRANDMEMBER', tmp, tonumber(ARGV[1]))  -- tối đa 500
local out = {}
for _, id in ipairs(ids) do
  if redis.call('EXISTS', 'offer_lock:coder:' .. id) == 0 then table.insert(out, id) end
end
return out
```

Nếu ít hơn 20 ứng viên, nới theo thứ tự và lọc lại sau mỗi bước: (1) chuyển skill bắt buộc có weight thấp nhất thành skill cộng điểm; (2) hạ level tối thiểu đi 1; (3) thêm coder offline dưới 2 giờ và gửi push mời online. Mỗi lần nới ghi vào match\_requests để đo tỉ lệ đơn phải nới theo từng skill, đây là tín hiệu tuyển thêm coder.

### 6.3 Chấm điểm

Điểm là tổng có trọng số của 8 đặc trưng đã chuẩn hóa về 0..1. Trọng số nằm trong bảng cấu hình theo gói, đổi được không cần deploy, và mọi offer lưu lại score\_detail để giải thích vì sao coder đó được chọn.

| Đặc trưng | Trọng số mặc định | Cách tính |
| --- | --- | --- |
| skill\_fit | 0,25 | Σ weight × min(1, level / min\_level) trên mọi skill của brief, cộng 10% cho skill đã xác minh |
| semantic\_sim | 0,10 | Cosine giữa embedding brief và embedding hồ sơ + 5 đơn gần nhất của coder |
| quality | 0,20 | Rating Bayes (C = 10, m = trung bình sàn) kết hợp first\_pass\_rate |
| reliability | 0,15 | on\_time\_rate và accept\_rate, làm mượt Bayes để coder mới không bị 0 |
| tier\_fit | 0,10 | 1 − \|tier − tier\_mục\_tiêu(complexity)\| / 3, giữ coder hạng cao cho đơn khó |
| fairness | 0,10 | min(1, log(1 + giờ từ lần gán cuối) / log(49)), chống top coder ôm đơn |
| responsiveness | 0,05 | Theo thời gian trả lời offer trung vị |
| load | 0,05 | 1 − active\_orders / max\_concurrent |

Khởi động lạnh: mỗi wave 1 có 10% xác suất chèn một coder mới (dưới 5 đơn) có điểm skill\_fit ≥ 0,8, để coder mới có cơ hội xây lịch sử. Embedding hồ sơ coder được rút xuống 256 chiều, lưu float16 trong RAM của Matching service (50.000 coder ≈ 25 MB), nên tính cosine cho 500 ứng viên mất dưới 1 ms.

### 6.4 Phân bổ và gửi offer theo wave

Khi nhiều đơn vào cùng lúc, xử lý từng đơn riêng lẻ sẽ gửi cùng một coder giỏi cho mười đơn. Vì vậy Matching service gom đơn mới theo micro-batch 2 giây, dựng ma trận đơn × ứng viên, rồi phân bổ tham lam theo điểm giảm dần với ràng buộc mỗi coder chỉ được giữ một offer mở. Thuật toán tham lam đủ tốt ở quy mô này; chỉ đổi sang min-cost flow nếu đo thấy chênh lệch tổng điểm > 5%.

| Wave | Số coder nhận offer cùng lúc | Hạn trả lời (Express / Standard / Pro) | Ghi chú |
| --- | --- | --- | --- |
| 1 | 3 | 30 / 45 / 90 giây | Top điểm, có thể chèn 1 coder mới |
| 2 | 5 | 30 / 60 / 120 giây | Bỏ qua người đã nhận offer |
| 3 | 10 | 45 / 60 / 120 giây |  |
| 4 | Mọi coder đủ điều kiện sau khi nới | 120 giây | Thưởng thêm 10% phần coder nhận, sàn trả |

Sau wave 4 vẫn không có ai: báo vận hành điều phối tay; quá thời gian chờ của gói (Express 20 phút, Standard 60 phút, Pro 4 giờ) thì tự hoàn tiền.

### 6.5 Accept nguyên tử

Nhiều coder có thể bấm nhận cùng một đơn trong cùng mili giây. Redis chọn người thắng, Postgres là chốt chặn cuối cùng qua unique index `offers_one_accept`.

```lua
-- KEYS[1]=order:{id}:assignee  KEYS[2]=coder:{cid}  KEYS[3]=idx:available
-- ARGV[1]=coder_id
if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', 3600) == false then
  return {0, 'taken'}
end
local active = tonumber(redis.call('HGET', KEYS[2], 'active_orders'))
local maxc   = tonumber(redis.call('HGET', KEYS[2], 'max_concurrent'))
if active >= maxc then
  redis.call('DEL', KEYS[1])
  return {0, 'no_capacity'}
end
active = redis.call('HINCRBY', KEYS[2], 'active_orders', 1)
if active >= maxc then redis.call('SREM', KEYS[3], ARGV[1]) end
return {1, 'ok'}
```

Sau khi Lua trả ok, Core API mở một transaction: đánh dấu offer accepted, chuyển đơn matching → assigned có kiểm tra version, hủy các offer còn mở, ghi outbox. Nếu transaction lỗi thì bù lại Redis (xóa assignee, giảm active\_orders). Coder bấm trễ nhận thông báo "đơn đã có người nhận" trong vòng 100 ms, và offer trên màn hình của họ bị thu hồi qua Centrifugo.

### 6.6 Scale và ngân sách độ trễ

| Bước | Ngân sách p95 |
| --- | --- |
| Nhận sự kiện order.ready\_for\_matching từ NATS | 10 ms |
| Lua lọc cứng (kể cả nới 1 lần) | 10 ms |
| Đọc đặc trưng 500 ứng viên bằng pipeline HMGET | 10 ms |
| Chấm điểm và phân bổ trong bộ nhớ | 5 ms |
| Chờ gom micro-batch | tối đa 2.000 ms khi tải cao, 0 ms khi tải thấp |
| Ghi offers vào Postgres, publish | 20 ms |
| Centrifugo đẩy tới app đang mở | 100 ms |

Micro-batch chỉ bật khi có hơn 3 đơn chờ trong cùng cửa sổ; lúc vắng đơn được xử lý ngay, nên p95 ≤ 500 ms vẫn giữ được. Matching service chạy nhiều replica trong một NATS queue group, mỗi đơn chỉ một replica xử lý; phần phân bổ micro-batch chạy trên replica giữ leader lease trong Redis. Ở 200 yêu cầu/giây với khoảng 25 thao tác Redis mỗi yêu cầu, tải chỉ khoảng 5.000 ops/giây, dưới xa giới hạn một Redis primary. Khi mở rộng quốc tế, chia shard theo vùng bằng hash tag `{region}` trong Redis Cluster.

### 6.7 Tìm kiếm ngoài matching

Khách tìm template, admin tìm đơn và coder, AI Brief tự gợi ý template khởi đầu. Giai đoạn 1 dùng Postgres: cấu hình full-text `vi_unaccent` (simple + unaccent) để "thanh toan" tìm ra "thanh toán", pg\_trgm cho gõ sai, pgvector HNSW cho tìm theo ngữ nghĩa, gộp hai danh sách bằng Reciprocal Rank Fusion. Brief tự chọn template khi độ tương đồng cao nhất ≥ 0,8, nếu không thì để coder chọn.

Giai đoạn 2 chuyển sang OpenSearch với analyzer icu\_folding + edge n-gram và kNN; dữ liệu đồng bộ từ outbox qua indexer, reindex không downtime bằng cách dựng index mới rồi đổi alias.

### 6.8 Chỉ số theo dõi matching

Thời gian đến offer đầu tiên và đến khi có người nhận (p50, p95), tỉ lệ nhận theo wave, tỉ lệ đơn phải nới điều kiện theo skill, tỉ lệ hoàn tiền vì không có coder, hệ số Gini của số đơn chia cho coder (đo độ công bằng), và tỉ lệ nghiệm thu lần đầu của đơn theo khoảng điểm match để kiểm tra công thức điểm có dự đoán đúng chất lượng hay không.

## 7. Tích hợp GitHub và tiến độ realtime

Nền tảng là owner mọi repo; coder chỉ được cấp quyền push trong thời gian đơn mở, và tiến độ được tính từ chính lịch sử commit cộng kết quả CI, không dựa vào lời khai của coder.

### 7.1 Thiết lập GitHub

- **Organization riêng cho POC** (`grabcode-poc`), tách khỏi org nội bộ của công ty. Base permission của thành viên đặt là "No permission".
- **GitHub App "GrabCode Bot"** cài trên org với quyền: Administration (read/write, để tạo repo và cấp quyền), Contents (read/write), Metadata (read), Actions (read), Checks (read), Members (read/write). Webhook nhận các sự kiện: push, workflow\_run, check\_suite, repository, member, organization.
- **Coder vào org một lần khi onboarding**: coder liên kết GitHub bằng OAuth, sàn mời vào org, coder chấp nhận một lần. Từ đó mỗi đơn chỉ cần cấp quyền repo cho thành viên sẵn có, có hiệu lực ngay, không phải chờ coder bấm nhận lời mời qua email.
- **CI chạy trên self-hosted runner** (actions-runner-controller trên GKE), vì số phút Actions của gói miễn phí không đủ cho hàng nghìn đơn mỗi tháng.

Giới hạn của GitHub cần thiết kế quanh: token installation có hạn 1 giờ (cache trong Redis 50 phút); API REST có giới hạn số request mỗi giờ cho mỗi installation; và GitHub có giới hạn thứ cấp cho các request tạo nội dung, khoảng 80 mỗi phút và 500 mỗi giờ. Ở 100.000 đơn/tháng, giờ cao điểm có thể chạm giới hạn này, nên dùng hai biện pháp: **repo pool** (tạo sẵn repo rỗng từ template vào giờ thấp điểm, khi gán đơn chỉ đổi tên và cấp quyền) và **chia nhiều org** (`grabcode-poc-01..N`, mỗi org một installation riêng). Các con số giới hạn cần kiểm tra lại với tài liệu GitHub hiện hành trước khi chốt cấu hình.

### 7.2 Cấp repo khi ghép xong

Repo-worker nhận `order.assigned` và chạy các bước dưới, mục tiêu hoàn tất trong 15 giây:

1. Lấy một repo từ pool theo template đã chọn trong brief; pool rỗng thì tạo mới bằng API generate-from-template.
2. Đổi tên thành `gc-{order_code}-{slug}`, đặt private, mô tả là tiêu đề đơn.
3. Commit bộ khởi tạo bằng tài khoản bot: README.md, CLAUDE.md, docs/milestones.md, docs/acceptance.md, `.github/workflows/preview.yml`, `.grabcode.json` (order\_id, danh sách mốc).
4. Cấp quyền `push` cho tài khoản GitHub của coder.
5. Ghi bảng repos, phát `repo.provisioned`; đơn chuyển sang building, app coder hiện lệnh clone.

Mọi bước idempotent theo order\_id: chạy lại không tạo repo thứ hai. Khi đóng đơn hoặc ghép lại, worker gỡ quyền của coder; repo được archive sau 90 ngày nếu khách không mua chuyển giao.

**Nội dung docs/milestones.md** do AI Brief sinh, bot commit:

```markdown
# Milestones — GC-261013-7K2Q
<!-- grabcode:milestones v1 — không đổi mã mốc và trọng số -->
- [ ] M1 (15%) Khung dự án, đăng nhập giả lập
- [ ] M2 (30%) Màn hình danh sách và chi tiết đơn hàng
- [ ] M3 (30%) Tích hợp API thanh toán sandbox
- [ ] M4 (25%) Dữ liệu mẫu và preview chạy được
```

CLAUDE.md chứa spec, tiêu chí nghiệm thu, ràng buộc kỹ thuật (stack của template, không thêm dịch vụ trả phí, không dùng dữ liệu thật), và quy ước commit để Claude Code của coder làm theo ngay.

### 7.3 Tính phần trăm tiến độ

Coder đánh dấu một mốc theo một trong hai cách: commit có tag `[M2]` trong message, hoặc tick ô của mốc đó trong milestones.md. Mốc chuyển sang `claimed_done` với SHA tương ứng; chỉ khi workflow preview cho SHA đó (hoặc commit sau nó) chạy xanh thì mốc mới thành `verified`.

```
progress_pct     = Σ weight_pct của mốc verified
pending_pct      = Σ weight_pct của mốc claimed_done chưa verified
expected_pct(t)  = 100 × (t − assigned_at) / (deadline_at − assigned_at)
risk             = expected_pct − progress_pct  (> 30 thì cảnh báo vận hành)
```

Màn hình hai bên hiện progress\_pct là số chính, pending\_pct là phần nhạt hơn, kèm ETA và commit gần nhất. Không tính % theo số commit hay số dòng code, vì coder dễ thổi phồng. Commit revert làm mốc mất trạng thái verified thì % giảm theo.

### 7.4 Xử lý webhook

```ts
// POST /webhooks/github — phải trả lời trong 10 giây
verifySignature(req.headers['x-hub-signature-256'], rawBody, GH_WEBHOOK_SECRET); // sai → 401
const deliveryId = req.headers['x-github-delivery'];
if (!(await redis.set(`gh:dlv:${deliveryId}`, 1, 'EX', 86400, 'NX'))) return 200; // trùng
await nats.publish(`github.${req.headers['x-github-event']}`, rawBody, { msgID: deliveryId });
return 202; // mọi xử lý thật nằm ở progress-worker
```

Progress-worker đọc sự kiện push và workflow\_run, ánh xạ repo → đơn, cập nhật commits và milestones trong một transaction kèm outbox `progress.updated`. Một job đối soát chạy mỗi 10 phút gọi API GitHub lấy commit mới nhất của các đơn đang build, phòng trường hợp webhook bị mất.

### 7.5 Đẩy realtime cho hai bên

| Kênh Centrifugo | Ai subscribe | Nội dung |
| --- | --- | --- |
| `order:{id}` | Khách, coder của đơn, admin | progress.updated, commit mới, trạng thái QA, link demo, tin nhắn chat |
| `coder:{id}` | Riêng coder | Offer mới, offer bị thu hồi, nhắc deadline |
| `customer:{id}` | Riêng khách | Thông báo đơn, cần duyệt, cần nghiệm thu |

Core API cấp subscription token (JWT, hạn 15 phút) chứa đúng kênh người dùng được phép nghe, nên không ai nghe lén được đơn của người khác. Một consumer đọc outbox `progress.updated` và gọi API publish của Centrifugo sau khi dữ liệu đã nằm trong Postgres, nên màn hình không bao giờ hiện số chưa được lưu. Kênh bật history 50 tin, giữ 1 giờ, để client mất mạng kết nối lại vẫn nhận đủ; nếu WebSocket hỏng hẳn, client chuyển sang gọi `GET /orders/{id}/progress` mỗi 30 giây.

```json
{
  "type": "progress.updated",
  "order_id": "0192f1c2-...",
  "progress_pct": 45,
  "pending_pct": 30,
  "milestones": [{"code": "M1", "status": "verified"}, {"code": "M2", "status": "claimed_done"}],
  "last_commit": {"sha": "a1b2c3d", "message": "[M2] danh sách đơn hàng", "at": "2026-10-13T09:41:00+07:00"},
  "eta": "2026-10-13T12:30:00+07:00"
}
```

### 7.6 CLI grabcode (tùy chọn cho coder)

Gói npm `@grabcode/cli`, đăng nhập bằng device flow. Các lệnh: `grabcode open <order>` (clone repo), `grabcode checkpoint M2` (commit rỗng có tag, push), `grabcode status`, `grabcode deliver` (kích hoạt QA và deploy). Mọi việc CLI làm đều làm được bằng git và app coder, nên coder không bắt buộc cài.

## 8. QA Gate, deploy sandbox và hosting demo

Mọi bản giao đều được build lại từ repo trên hạ tầng của sàn, chạy trong sandbox cô lập và kiểm tự động trước khi khách thấy; coder không bao giờ tự đưa link ngoài cho khách.

### 8.1 Build và deploy

1. Workflow `preview.yml` chạy trên self-hosted runner ở mỗi lần push lên main và khi coder gọi deliver: build Docker image từ Dockerfile của template (thiếu Dockerfile thì dùng Cloud Native Buildpacks), giới hạn 10 phút và 2 GB.
2. Image đẩy lên Artifact Registry `asia-southeast1-docker.pkg.dev/grabcode/demos/{order_code}:{sha}`.
3. Workflow gọi webhook deploy của sàn bằng OIDC token của GitHub Actions, sàn kiểm token đúng repo của đơn thì mới nhận.
4. Deploy-worker tạo hoặc cập nhật Cloud Run service `demo-{order_code}`.

| Cấu hình Cloud Run cho mỗi demo | Giá trị |
| --- | --- |
| Instance tối thiểu / tối đa | 0 / 2 |
| CPU, bộ nhớ | 1 vCPU, 512 MiB (gói Pro: 2 vCPU, 1 GiB) |
| Timeout request | 60 giây |
| Service account | Riêng cho demo, không có quyền IAM nào |
| Mạng ra | Chỉ ra internet, chặn dải IP nội bộ của sàn |
| Biến bí mật | Lấy từ Secret Manager theo đơn, chỉ chứa khóa sandbox của dịch vụ bên thứ ba |
| Header phản hồi | `X-Robots-Tag: noindex`, CSP cơ bản |

Link demo ổn định có dạng `{order_code}.demo.grabcode.vn`, đi qua một HTTPS load balancer dùng serverless NEG với URL mask, chứng chỉ wildcard. Mỗi lần push còn có link preview nội bộ `{sha7}-{order_code}.preview.grabcode.vn` chỉ coder và QA xem được. POC thuần tĩnh (không backend) đi đường rẻ hơn: Cloud Storage + Cloud CDN.

**Vòng đời demo**: sống suốt thời gian đơn mở và 14 ngày sau khi đóng, sau đó xóa service, giữ image 90 ngày; khách mua hosting thì gia hạn. Chống lạm dụng (phishing, đào coin): CPU dùng trên 80% liên tục 10 phút thì tự tạm dừng và báo vận hành, giới hạn băng thông ra, quét nội dung trang bằng Google Web Risk khi deploy.

### 8.2 Các bước của QA Gate

QA-worker chạy khi nhận `order.delivery_requested`, mục tiêu hoàn tất trong 8 phút (p95).

| Kiểm tra | Công cụ | Chặn giao | Ghi chú |
| --- | --- | --- | --- |
| Lộ bí mật trong code và lịch sử git | gitleaks | Có |  |
| Dependency có lỗ hổng nghiêm trọng | osv-scanner | Có, với mức Critical | High chỉ cảnh báo |
| Build và health check | Pipeline 8.1, `GET /` trả 200 trong 60 giây | Có |  |
| Smoke test giao diện | Playwright, viewport desktop và mobile, đi qua các route chính | Có, nếu trang trắng hoặc lỗi JS chặn hiển thị |  |
| Từng tiêu chí nghiệm thu | AI agent dùng Playwright (mục 8.3) | Có | Mỗi tiêu chí phải có bằng chứng |
| Nguồn gốc code | So sánh commit với thời điểm gán đơn và tài khoản coder | Không, chỉ gắn cờ | Commit đầu tiên > 5.000 dòng ngoài template trong 10 phút đầu thì vận hành xem tay |

### 8.3 AI acceptance agent

Với mỗi tiêu chí `{id, text, how_to_verify}` trong brief, một agent Claude điều khiển trình duyệt headless qua Playwright, tự đi theo các bước để kiểm chứng, và trả về:

```json
{
  "criterion_id": "AC-3",
  "verdict": "pass",            // pass | fail | unclear
  "steps": ["Mở /orders", "Bấm đơn #1024", "Thấy trạng thái Đã thanh toán"],
  "evidence": ["gs://grabcode-qa/GC-261013-7K2Q/run-3/AC-3-1.png"],
  "note": ""
}
```

Chạy tối đa 3 tiêu chí song song, mỗi tiêu chí giới hạn 3 phút và một ngân sách token cố định. Kết luận: mọi kiểm tra chặn đều đạt và mọi tiêu chí đều pass thì giao; có tiêu chí fail thì trả báo cáo cho coder; chỉ có tiêu chí unclear (tối đa 1) thì đẩy vào hàng đợi kiểm tra tay của vận hành, cam kết xử lý trong 30 phút. Báo cáo và ảnh bằng chứng được gắn vào đơn khi giao, khách xem được, và là căn cứ khi có tranh chấp. Chi phí LLM cho mỗi lượt QA chưa có số đo; cần đo trong giai đoạn concierge để chốt giá gói.

## 9. Thanh toán, ký quỹ và sổ cái

Mọi dòng tiền đi qua một sổ cái kép chỉ ghi thêm; số dư của bất kỳ ai cũng tính lại được từ các bút toán, và mọi bút toán đều truy về một sự kiện nghiệp vụ.

### 9.1 Cấu trúc pháp lý của "ký quỹ"

Vì nền tảng là owner sản phẩm, mô hình tự nhiên là: sàn bán dịch vụ POC cho khách và mua dịch vụ build từ coder. Tiền khách trả là doanh thu nhận trước của sàn, chưa ghi nhận cho tới khi khách chấp thuận; "ký quỹ" chỉ là cam kết hoàn tiền của sàn, không phải giữ hộ tiền của bên thứ ba. Cách này tránh phải xin giấy phép trung gian thanh toán, nhưng cần luật sư và kế toán xác nhận trước khi ra mắt, gồm cả hai điểm sau:

- Xuất hóa đơn điện tử cho khách qua nhà cung cấp (VNPT, Viettel S-Invoice hoặc MISA meInvoice) khi đơn đóng.
- Khấu trừ thuế thu nhập cá nhân khi trả cho coder là cá nhân không ký hợp đồng lao động, theo ngưỡng và thuế suất hiện hành; hệ thống để ngưỡng và thuế suất trong cấu hình, không hard-code.

### 9.2 Luồng thanh toán

1. Khách duyệt brief, Core API tạo `payment` trạng thái pending với số tiền đã chốt và Idempotency-Key theo order\_id + brief\_version.
2. Chuyển khách sang VNPay hoặc MoMo.
3. Cổng gọi IPN (server-to-server) về sàn. Sàn kiểm chữ ký (VNPay: HMAC-SHA512 trên tham số; MoMo: HMAC-SHA256), khử trùng theo mã giao dịch của cổng, kiểm số tiền khớp, rồi ghi bút toán và chuyển đơn sang matching trong một transaction.
4. Return URL chỉ dùng để hiện màn hình kết quả, không bao giờ dùng để xác nhận thanh toán.
5. Job đối soát hàng ngày gọi API truy vấn giao dịch của cổng và so với sổ cái; lệch thì tạo ticket cho kế toán.

### 9.3 Sổ cái kép

| Tài khoản | Loại | Ý nghĩa |
| --- | --- | --- |
| `cash:psp:vnpay`, `cash:psp:momo` | Tài sản | Tiền đang nằm ở cổng thanh toán |
| `cash:bank` | Tài sản | Tiền ở tài khoản ngân hàng của sàn |
| `liability:prepaid:{order_id}` | Nợ phải trả | Tiền khách trả trước cho đơn, chưa ghi nhận doanh thu |
| `liability:coder_payable:{coder_id}` | Nợ phải trả | Tiền sàn nợ coder |
| `liability:tax_withheld` | Nợ phải trả | Thuế đã khấu trừ, chờ nộp |
| `revenue:commission`, `revenue:rush_fee`, `revenue:transfer_fee` | Doanh thu | Hoa hồng, phí gấp, phí chuyển giao repo |
| `expense:psp_fee`, `expense:coder_bonus` | Chi phí | Phí cổng, thưởng wave 4 |

Ví dụ một đơn Standard 4.000.000 đ, coder nhận 78%:

| Sự kiện | Nợ (debit) | Có (credit) |
| --- | --- | --- |
| Khách thanh toán | cash:psp:vnpay 4.000.000 | liability:prepaid 4.000.000 |
| Phí cổng | expense:psp\_fee 44.000 | cash:psp:vnpay 44.000 |
| Khách chấp thuận, đóng đơn | liability:prepaid 4.000.000 | liability:coder\_payable 3.120.000; revenue:commission 880.000 |
| Trả coder (giả định khấu trừ 10%) | liability:coder\_payable 3.120.000 | liability:tax\_withheld 312.000; cash:bank 2.808.000 |
| Nếu hoàn tiền thay vì đóng đơn | liability:prepaid 4.000.000 | cash:psp:vnpay 4.000.000 |

Phí cổng và thuế suất trong ví dụ chỉ để minh họa cách hạch toán.

```sql
CREATE TABLE ledger.entries (
  id          bigserial PRIMARY KEY,
  txn_id      uuid NOT NULL,            -- một nghiệp vụ = một txn_id
  account     text NOT NULL,
  direction   char(1) NOT NULL CHECK (direction IN ('D','C')),
  amount      bigint NOT NULL CHECK (amount > 0),
  currency    char(3) NOT NULL,
  ref_type    text NOT NULL,            -- payment|order|payout|refund
  ref_id      uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ON ledger.entries (txn_id, account, direction);
-- Chỉ ghi qua hàm ledger.post(txn jsonb): hàm kiểm Σ debit = Σ credit rồi mới insert.
-- Role của ứng dụng không có quyền UPDATE/DELETE trên bảng này.
```

Số dư đọc nhanh từ bảng `ledger.balances` được cập nhật trong cùng transaction với bút toán; một job hàng đêm cộng lại toàn bộ entries để kiểm số dư không lệch.

### 9.4 Trả tiền cho coder

Coder xác minh tài khoản ngân hàng một lần (đối chiếu tên chủ tài khoản qua API tra cứu của đối tác chi hộ). Tiền chuyển vào số dư khả dụng ngay khi đơn đóng; coder rút về ngân hàng qua dịch vụ chi hộ của cổng thanh toán hoặc API ngân hàng đối tác, chạy qua chuyển khoản nhanh 24/7 nên về trong vài phút. Mỗi lệnh rút có Idempotency-Key; lệnh thất bại được hoàn lại số dư bằng bút toán ngược, không xóa bút toán cũ.

## 10. Chat, chống lộ liên lạc và mở kết nối sau POC

Trong giai đoạn POC, mọi kênh mà danh tính hoặc liên lạc có thể lọt qua đều phải được kiểm soát: chat, file đính kèm, hồ sơ coder, và cả metadata của git.

### 10.1 Che liên lạc trong chat

Tin nhắn gửi qua `POST /orders/{id}/messages`, được che đồng bộ trước khi lưu bản hiển thị và đẩy qua Centrifugo; ngân sách thời gian 150 ms.

1. **Chuẩn hóa**: bỏ khoảng trắng, dấu chấm, gạch giữa các chữ số; đổi số viết bằng chữ tiếng Việt ("không chín một...") sang chữ số; đổi ký tự thay thế (`0` ↔ `o`, `@` ↔ `(at)`).
2. **Luật cứng**: email, số điện thoại Việt Nam, URL tới mạng xã hội và nhắn tin (facebook, zalo.me, t.me, wa.me, linkedin, discord), số tài khoản ngân hàng, @handle. Phần trúng luật được thay bằng `[đã ẩn]`.
3. **Phân loại bất đồng bộ**: claude-haiku-5-5 đọc tin nhắn trong ngữ cảnh 5 tin trước để bắt cách lách tinh vi ("tìm tên mình trên Zalo nhé"). Trúng thì sửa tin đã gửi bằng sự kiện message.redacted và cộng một lần vi phạm.

```ts
const VN_PHONE = /(?:\+?84|0)(?:3|5|7|8|9)\d{8}/;               // sau khi đã chuẩn hóa
const EMAIL    = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const SOCIAL   = /(facebook\.com|fb\.me|zalo\.me|t\.me|wa\.me|linkedin\.com|discord\.gg)\/\S+/i;
```

Bản gốc được mã hóa bằng envelope encryption (Cloud KMS) và chỉ vận hành mở được khi xử lý tranh chấp, mỗi lần mở ghi audit log. Ảnh đính kèm được OCR bất đồng bộ (Cloud Vision) rồi chạy cùng bộ luật.

**Chính sách vi phạm**: lần 1 cảnh báo, lần 2 khóa 7 ngày, lần 3 khóa vĩnh viễn và áp dụng chế tài trong điều khoản (cần luật sư rà soát).

### 10.2 Ẩn danh tính trong giai đoạn POC

- Hồ sơ coder khách thấy chỉ gồm tên hiển thị, ảnh đại diện, hạng, điểm đánh giá và số đơn đã làm; không có GitHub login, họ tên thật hay liên kết ngoài.
- Khách không có quyền vào repo trong giai đoạn POC. Feed tiến độ chỉ hiện message, SHA rút gọn và thời gian của commit; **không hiện tên và email tác giả commit**, vì đó là chỗ lộ danh tính dễ nhất.
- Progress-worker chạy cùng bộ luật trên commit message và các file .md thay đổi; trúng thì chỉ gắn cờ cho vận hành, không viết lại lịch sử git.
- Link demo nằm trên tên miền của sàn; nội dung demo được quét số điện thoại, email lúc QA.

### 10.3 Mở kết nối sau POC

1. Đơn chuyển sang approved (khách đã chấp thuận POC) thì tạo dòng `connections` với `poc_approved_at`. Không có dòng này thì không có nút accept: đây là điều kiện cứng, kiểm ở cả API lẫn ràng buộc dữ liệu.
2. Hai bên thấy nút "Tiếp tục hợp tác" trong 30 ngày. Mỗi bên bấm thì ghi `customer_accepted_at` hoặc `coder_accepted_at`.
3. Khi cả hai đã accept: ghi `opened_at`, khách chọn hình thức `direct` (làm trực tiếp) hoặc `managed` (sàn làm trung gian), phát sự kiện connection.opened.
4. Từ lúc này mỗi bên thấy thông tin liên lạc mà bên kia đã chọn chia sẻ trong hồ sơ; bộ lọc che liên lạc tắt cho cặp này.

Mọi chỗ trả thông tin liên lạc đều đi qua một hàm chính sách duy nhất `canSeeContact(viewer, target)`, trả true khi và chỉ khi tồn tại connection đã opened giữa hai người; có test bao phủ mọi endpoint trả dữ liệu người dùng. Chế độ managed (dự án triển khai theo mốc, ký quỹ theo mốc) chỉ chuẩn bị mô hình dữ liệu ở phiên bản 1.

## 11. API và danh mục sự kiện

Hợp đồng API và schema sự kiện là nguồn sự thật chung của mọi đội: viết trước trong `packages/contracts` (OpenAPI 3.1 và JSON Schema), sinh client TypeScript và Go từ đó, CI chặn mọi thay đổi phá vỡ tương thích.

**Quy ước chung**: REST JSON dưới tiền tố `/v1`; lỗi theo định dạng problem+json (RFC 9457) có mã lỗi ổn định; phân trang bằng cursor; mọi POST thay đổi dữ liệu nhận header `Idempotency-Key` (lưu 24 giờ); xác thực bằng access token JWT hạn 15 phút và refresh token xoay vòng; rate limit theo người dùng bằng token bucket trong Redis.

### 11.1 Endpoint chính

| Method | Path | Người gọi | Mục đích |
| --- | --- | --- | --- |
| POST | /v1/orders | Khách | Tạo đơn từ mô tả, chọn gói |
| GET | /v1/orders/{id} | Khách, coder | Chi tiết đơn theo quyền |
| GET | /v1/orders/{id}/brief | Khách, coder | Brief hiện hành |
| POST | /v1/orders/{id}/brief/revisions | Khách | Yêu cầu AI sửa brief kèm góp ý |
| POST | /v1/orders/{id}/brief/approve | Khách | Duyệt brief, chốt giá |
| POST | /v1/orders/{id}/payments | Khách | Tạo thanh toán, trả URL cổng |
| GET | /v1/orders/{id}/progress | Khách, coder | % tiến độ, mốc, commit gần nhất (fallback khi mất WebSocket) |
| GET, POST | /v1/orders/{id}/messages | Khách, coder | Đọc và gửi chat (đã che liên lạc) |
| POST | /v1/orders/{id}/revision-requests | Khách | Yêu cầu sửa sau khi giao |
| POST | /v1/orders/{id}/approve | Khách | Chấp thuận POC |
| POST | /v1/orders/{id}/disputes | Khách | Mở tranh chấp |
| POST | /v1/orders/{id}/connection/accept | Khách, coder | Accept kết nối sau POC |
| GET | /v1/templates?q= | Khách | Tìm template |
| PUT | /v1/coder/availability | Coder | Bật hoặc tắt nhận đơn |
| POST | /v1/coder/heartbeat | Coder | Giữ trạng thái online (30 giây/lần) |
| GET | /v1/coder/offers/current | Coder | Offer đang mở |
| POST | /v1/offers/{id}/accept | Coder | Nhận đơn (mục 6.5) |
| POST | /v1/offers/{id}/decline | Coder | Từ chối, kèm lý do |
| POST | /v1/orders/{id}/deliver | Coder | Yêu cầu QA và giao |
| POST | /v1/orders/{id}/abandon | Coder | Bỏ đơn, kích hoạt ghép lại |
| GET, POST | /v1/coder/wallet, /v1/coder/payouts | Coder | Số dư và rút tiền |
| POST | /v1/realtime/token | Mọi người dùng | Token kết nối và subscribe Centrifugo |
| POST | /webhooks/github | GitHub | Push, workflow\_run, member |
| POST | /webhooks/vnpay/ipn, /webhooks/momo/ipn | Cổng thanh toán | Kết quả thanh toán |
| POST | /internal/deploy | GitHub Actions (OIDC) | Yêu cầu deploy image vừa build |
| GET | /admin/v1/search?q= | Vận hành | Tìm đơn, coder, khách |
| POST | /admin/v1/orders/{id}/reassign | Vận hành | Ghép lại thủ công |

### 11.2 Sự kiện

Subject NATS đặt theo mẫu `gc.{domain}.{event}`. Stream giữ 7 ngày; consumer durable, tối đa 10 lần giao lại với backoff tăng dần, quá thì vào subject `gc.dlq.{consumer}` và báo động.

```json
{
  "event_id": "0192f1d4-7b1e-7c2a-9f00-3c5e8a1b2d44",
  "type": "order.assigned",
  "version": 1,
  "occurred_at": "2026-10-13T09:12:03.512Z",
  "aggregate": { "type": "order", "id": "0192f1c2-..." },
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "data": { "coder_id": "0192e0aa-...", "deadline_at": "2026-10-13T17:12:03Z" }
}
```

| Sự kiện | Phát bởi | Ai nghe | Tác dụng |
| --- | --- | --- | --- |
| order.created | orders | brief-worker | Sinh brief |
| brief.generated | brief-worker | orders, notifier | Chờ khách duyệt |
| payment.succeeded | payments | orders, ledger | Ghi sổ, chuyển sang matching |
| order.ready\_for\_matching | orders | matching | Bắt đầu pipeline mục 6 |
| offer.sent, offer.expired, offer.revoked | matching | realtime, notifier | Hiện và thu hồi offer trên app coder |
| order.assigned | orders | repo-worker, realtime, notifier | Cấp repo, báo hai bên |
| repo.provisioned | repo-worker | orders, realtime | Chuyển sang building |
| milestone.claimed, milestone.verified | progress-worker | orders | Tính lại % |
| progress.updated | orders | realtime | Đẩy % cho hai bên |
| order.delivery\_requested | orders | qa-worker, deploy-worker | Chạy QA và deploy |
| qa.completed | qa-worker | orders | Giao hoặc trả lại coder |
| order.delivered | orders | notifier, realtime | Gửi link demo cho khách |
| order.approved | orders | connections, ledger | Mở nút accept kết nối, chờ đóng đơn |
| order.closed | orders | ledger, repo-worker, matching | Giải ngân, gỡ quyền repo, trả slot cho coder |
| message.created, message.redacted | chat | realtime | Cập nhật chat |
| connection.opened | connections | notifier | Gửi thông tin liên lạc cho hai bên |
| coder.availability\_changed | identity | matching | Cập nhật idx:available |
| payout.completed | payments | notifier | Báo coder tiền đã về |

## 12. Bảo mật, phân quyền và tuân thủ

Rủi ro bảo mật lớn nhất của GrabCode là chạy code do người ngoài viết trên hạ tầng của mình; mọi thứ liên quan đến build và demo vì thế bị cách ly hoàn toàn khỏi hệ thống lõi.

### 12.1 Cách ly theo project GCP

| Project | Chứa | Quyền truy cập |
| --- | --- | --- |
| `grabcode-core-prod` | GKE lõi, Cloud SQL, Redis, NATS, Secret Manager | Chỉ đội platform; cluster private, DB và Redis chỉ có IP nội bộ |
| `grabcode-build-prod` | Self-hosted runner, Artifact Registry | Runner tạm thời (mỗi job một pod), chạy trong GKE Sandbox (gVisor), không có Workload Identity, mạng ra chỉ tới GitHub, registry và kho package |
| `grabcode-demo-prod` | Cloud Run cho mọi demo | Không có đường mạng vào core; deploy-worker chỉ có quyền deploy vào project này |

Nếu một demo hoặc một job build bị chiếm quyền, kẻ tấn công không chạm được tới cơ sở dữ liệu, khóa thanh toán hay khóa GitHub App.

### 12.2 Xác thực và phân quyền

- **Khách**: email OTP, Google, Zalo.
- **Coder**: bắt buộc GitHub OAuth; bật 2FA (TOTP) trước khi rút tiền lần đầu và trước khi đổi tài khoản ngân hàng.
- **Nội bộ**: SSO Google Workspace, 2FA bắt buộc, admin chỉ truy cập qua Cloudflare Access.

Phân quyền kết hợp vai trò (customer, coder, ops, finance, admin) với kiểm tra theo tài nguyên (chỉ khách và coder của đơn mới đọc được đơn). Toàn bộ luật nằm trong một module policy duy nhất, mỗi endpoint khai báo policy của mình, CI chặn endpoint không khai báo.

### 12.3 Bảo vệ dữ liệu

- Số điện thoại, email, số tài khoản ngân hàng, tin nhắn gốc được mã hóa ở tầng ứng dụng bằng envelope encryption (Cloud KMS), kèm blind index (HMAC) để vẫn tra cứu được.
- File khách đính kèm nằm trong bucket riêng, chỉ truy cập qua signed URL ngắn hạn cấp cho coder của đơn, tự xóa sau khi đơn đóng 30 ngày.
- Khóa riêng GitHub App, khóa cổng thanh toán nằm trong Secret Manager, xoay vòng định kỳ; không bí mật nào nằm trong repo.
- Audit log bất biến cho mọi thao tác admin, mọi lần mở tin nhắn gốc, mọi lần lộ thông tin liên lạc.

### 12.4 Gian lận

Phát hiện khách và coder thông đồng (tạo đơn ảo để tăng điểm hoặc rút tiền khuyến mãi) bằng cách đối chiếu thiết bị, IP, số tài khoản ngân hàng và số điện thoại giữa hai bên; trùng thì giữ giải ngân và đẩy vận hành. Giới hạn số đơn mỗi khách mới mỗi ngày, và giới hạn số offer coder được từ chối liên tiếp trước khi tạm tắt nhận đơn.

### 12.5 Tuân thủ pháp lý tại Việt Nam

Các mục dưới đây phải được luật sư xác nhận trước khi ra mắt; hệ thống cần thiết kế sẵn để đáp ứng:

- **Bảo vệ dữ liệu cá nhân**: Nghị định 13/2023/NĐ-CP và Luật Bảo vệ dữ liệu cá nhân cùng văn bản hướng dẫn. Cần màn hình đồng ý theo từng mục đích, hồ sơ đánh giá tác động xử lý dữ liệu, và hồ sơ đánh giá chuyển dữ liệu ra nước ngoài vì dữ liệu lưu ở Singapore; tính năng xuất và xóa dữ liệu theo yêu cầu người dùng.
- **Lưu trữ dữ liệu trong nước**: kiểm tra GrabCode có thuộc diện phải lưu dữ liệu tại Việt Nam theo Nghị định 53/2022/NĐ-CP hay không; kiến trúc ở mục 3 đã chừa đường chuyển Postgres và Cloud Storage về nhà cung cấp trong nước.
- **Thương mại điện tử**: kiểm tra nghĩa vụ đăng ký sàn giao dịch thương mại điện tử với Bộ Công Thương.
- **Hóa đơn và thuế**: hóa đơn điện tử cho khách, khấu trừ thuế cho coder cá nhân (mục 9.1).

### 12.6 Kiểm thử bảo mật

Semgrep và osv-scanner trong CI cho mọi pull request; Trivy quét image; OWASP ZAP quét staging hàng tuần; pentest bởi bên thứ ba trước khi mở beta công khai; mở bug bounty khi đạt 1.000 đơn/tháng.

## 13. Quan sát, vận hành và lộ trình scale

Mỗi đơn phải truy được từ đầu đến cuối bằng một trace\_id, và mỗi cảnh báo phải gắn với một SLO có ý nghĩa với người dùng, không gắn với CPU hay RAM.

### 13.1 Quan sát

- **Trace**: OpenTelemetry trong mọi service và worker; trace\_id đi kèm phong bì sự kiện (mục 11.2), nên một đơn hiện thành một trace xuyên Core API, NATS, matching, repo-worker, QA.
- **Log**: JSON có cấu trúc, luôn kèm order\_id, user\_id, trace\_id; không ghi PII dạng rõ.
- **Metric kỹ thuật**: tốc độ, lỗi, độ trễ cho mọi endpoint; độ trễ consumer NATS; số job DLQ; số kết nối Centrifugo.
- **Metric nghiệp vụ**: đơn theo trạng thái, thời gian ở mỗi trạng thái, chỉ số matching (mục 6.8), tỉ lệ QA đạt lần đầu, số tiền chờ giải ngân.

| SLO | Mục tiêu | Cảnh báo khi |
| --- | --- | --- |
| Đặt đơn và thanh toán thành công (không tính lỗi người dùng) | 99,9% trong 30 ngày | Tốc độ đốt error budget gấp 14 lần trong 1 giờ |
| Đơn có offer đầu tiên trong 2 giây | 99% | p95 > 2 giây trong 10 phút |
| Đơn Express có coder nhận trong 10 phút | 95% | Dưới 90% trong 1 giờ |
| % tiến độ cập nhật trong 5 giây sau push | 99% | Độ trễ consumer progress > 30 giây |
| Repo sẵn sàng trong 30 giây sau khi gán | 99% | Bất kỳ đơn nào quá 5 phút |
| IPN thanh toán được xử lý | 100% | Bất kỳ IPN nào vào DLQ |

### 13.2 Runbook bắt buộc trước khi ra mắt

| Sự cố | Hành động chính |
| --- | --- |
| GitHub chậm hoặc sập | Matching vẫn chạy; repo-worker xếp hàng và retry; báo coder qua app; tạm giãn SLA đơn bị ảnh hưởng |
| Redis mất dữ liệu hoặc failover | Chạy `matching reindex` từ Postgres; offer đang mở được dựng lại từ bảng offers |
| NATS tồn đọng | KEDA tăng worker theo độ trễ; xem DLQ; outbox giữ sự kiện nên không mất |
| Cổng thanh toán lỗi | Ẩn cổng lỗi khỏi màn hình thanh toán; đối soát lại sau khi cổng hồi phục |
| Claude API lỗi hoặc chậm | Brief chuyển sang model dự phòng cấu hình sẵn; quá 10 phút thì vận hành viết brief tay theo template |
| Demo bị lạm dụng | Tạm dừng Cloud Run service, khóa coder, giữ image làm bằng chứng |

Sao lưu: Cloud SQL bật point-in-time recovery 7 ngày, export hằng ngày sang region khác (Jakarta), diễn tập khôi phục mỗi tháng. Kiểm thử tải bằng k6 cho API, và một bộ giả lập matching với 50.000 coder ảo, chạy trong CI mỗi đêm để bắt hồi quy độ trễ.

### 13.3 Autoscale

Core API và realtime scale theo CPU và số request (HPA); worker scale theo độ trễ consumer NATS (KEDA), về 0 khi không có việc với những worker không gấp; Matching service giữ tối thiểu 2 replica ở hai zone để luôn có người xử lý đơn mới.

### 13.4 Lộ trình scale

| Giai đoạn | Quy mô | Thay đổi hạ tầng |
| --- | --- | --- |
| 1. MVP | ≤ 3.000 đơn/tháng, ≤ 500 coder | Một GKE Autopilot cluster, Cloud SQL HA cỡ nhỏ, Redis 1 GB, NATS 3 node, tìm kiếm bằng Postgres |
| 2. Tăng trưởng | ≤ 10.000 đơn/tháng, ≤ 5.000 coder | Thêm read replica cho truy vấn admin và báo cáo; bật OpenSearch; bật repo pool; KEDA cho mọi worker |
| 3. Quy mô thiết kế | ≤ 100.000 đơn/tháng, ≤ 50.000 coder | Tách payments và chat thành service riêng; partition bảng lớn; nhiều GitHub org; Centrifugo ≥ 3 node; Redis cỡ lớn hoặc Cluster |
| 4. Quốc tế | Nhiều thị trường | Thêm region, chia shard matching theo vùng, Stripe và USD, lưu dữ liệu theo yêu cầu từng nước |

Chi phí hạ tầng từng giai đoạn cần tính bằng bảng giá GCP sau khi chốt cấu hình; tài liệu này chưa đưa con số.

## 14. Kế hoạch triển khai cho đội dev

MVP được chia thành một sprint nền móng và sáu sprint hai tuần, khớp với giai đoạn MVP tháng 2–3 trong kế hoạch sản phẩm; mỗi sprint kết thúc bằng một bản demo chạy trên staging.

### 14.1 Đội hình đề xuất

| Vai trò | Số người | Phụ trách chính |
| --- | --- | --- |
| Tech lead | 1 | Kiến trúc, review, hợp đồng API và sự kiện |
| Backend TypeScript | 2 | Core API: orders, brief, payments, ledger, chat, connections |
| Backend Go và hạ tầng | 1 | Matching service, Terraform, GKE, NATS, Redis |
| Frontend | 2 | Web khách, PWA coder, admin |
| DevOps/SRE (bán thời gian) | 1 | CI/CD, runner, sandbox, quan sát |
| QA automation | 1 | E2E Playwright, giả lập tải, kiểm thử QA Gate |
| Product owner, designer | 1 + 1 | Spec chi tiết từng màn hình, ưu tiên backlog |

### 14.2 Kế hoạch sprint

| Sprint | Nội dung | Demo được khi kết thúc |
| --- | --- | --- |
| S0 (1 tuần) | Monorepo, CI/CD, Terraform cho 3 môi trường, khung NestJS và Go, packages/contracts, đăng nhập cơ bản, outbox và relay | Deploy một endpoint qua GitOps lên staging, trace hiện trên Grafana |
| S1 | Đặt đơn, brief-worker gọi Claude, màn hình duyệt và sửa brief, 3 template đầu tiên, state machine với đầy đủ unit test | Khách tạo đơn và nhận brief có mốc, tiêu chí, giá |
| S2 | Thanh toán VNPay và MoMo (sandbox), IPN, sổ cái kép, onboarding coder: GitHub OAuth, mời vào org, kỹ năng, tài khoản ngân hàng | Khách trả tiền, sổ cái cân, đơn chuyển sang matching |
| S3 | Matching v1: chỉ mục Redis, lọc cứng, nới điều kiện, chấm điểm, wave, accept nguyên tử; Centrifugo; màn hình offer trên PWA | 20 coder giả lập online, đơn được nhận trong vài giây, không bao giờ có hai người cùng nhận |
| S4 | Repo-worker, docs khởi tạo, webhook GitHub, tính % theo mốc và CI, đẩy realtime hai bên, chat có che liên lạc | Coder push commit gắn tag mốc, khách thấy % đổi trong vài giây |
| S5 | Build và deploy sandbox, QA Gate v1 (gitleaks, osv, smoke, AI acceptance), giao, sửa, chấp thuận, giải ngân, rút tiền | Một đơn chạy trọn vòng từ đặt đến tiền về tài khoản coder |
| S6 | Mở kết nối sau POC, console vận hành, SLO và cảnh báo, runbook, test tải, sửa lỗi pentest | Beta đóng với khách và coder thật |

Đường găng là S3 → S4 → S5: matching, repo và QA phụ thuộc nhau theo chuỗi. Frontend chạy song song nhờ mock server sinh từ OpenAPI, nên không phải chờ backend.

### 14.3 Định nghĩa hoàn thành cho mọi tính năng

1. Đúng hợp đồng trong packages/contracts; thay đổi hợp đồng đã được review.
2. Unit test cho logic nghiệp vụ; module state machine, sổ cái và chấm điểm matching phủ ≥ 90% nhánh.
3. Có test E2E cho luồng chính nếu tính năng nằm trên luồng đặt → giao → giải ngân.
4. Có trace, metric và log có cấu trúc; có cảnh báo nếu tính năng gắn với một SLO.
5. Endpoint đã khai báo policy phân quyền; endpoint trả PII đã qua review bảo mật.
6. Bật được tắt được bằng feature flag; có runbook nếu tính năng có phụ thuộc bên ngoài.

### 14.4 Quyết định cần chốt trước S0

| Quyết định | Phương án mặc định trong tài liệu | Người chốt |
| --- | --- | --- |
| Nhà cung cấp cloud | GCP Singapore | Founder và tech lead, sau khi luật sư trả lời về lưu trữ dữ liệu |
| Cấu trúc pháp lý của ký quỹ và thuế coder | Sàn bán dịch vụ, mua dịch vụ từ coder (mục 9.1) | Founder, luật sư, kế toán |
| Đối tác chi hộ trả tiền coder | Dịch vụ chi hộ của cổng thanh toán | Founder |
| Nhà cung cấp hóa đơn điện tử | Chọn một trong VNPT, Viettel, MISA | Kế toán |
| Gói GitHub cho org POC và giới hạn API | Org miễn phí, runner tự quản | Tech lead, xác minh với tài liệu GitHub |
| Ngân sách LLM mỗi đơn (brief + QA) | Đo trong giai đoạn concierge | Founder và tech lead |
