import { Order } from '../types/order';
import { CoderProfile } from '../types/coder';
import type { MenuItemCode } from '../schemas/pricing';

export interface POCTemplate {
  id: string;
  title: string;
  tagline: string;
  category: string;
  /** Menu item the template is priced as ("giá từ" of that item; the admin quotes the order). */
  menuItem: MenuItemCode;
  techStack: string[];
  features: string[];
  popular: boolean;
  thumbnail: string;
  previewUrl: string;
}

export const SEED_TEMPLATES: POCTemplate[] = [
  {
    id: "tpl-realestate-crm",
    title: "Mini CRM Bất Động Sản",
    tagline: "Quản lý khách nét F0, giỏ hàng căn hộ & thông báo Telegram bot tự động",
    category: "CRM & B2B",
    menuItem: "INTERNAL_TOOL",
    techStack: ["Next.js 15", "Tailwind CSS", "Supabase", "Telegram Bot"],
    features: ["Kanban quản lý lead", "Bản đồ mặt bằng SVG", "Bắn tin Telegram khi có cọc", "Phân quyền Sale/Admin"],
    popular: true,
    thumbnail: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=600&q=80",
    previewUrl: "https://demo.grabcode.dev/realestate-crm"
  },
  {
    id: "tpl-saas-billing",
    title: "SaaS Billing & Subscription",
    tagline: "Dashboard quản trị thành viên, gói thuê bao & đối soát thanh toán VietQR",
    category: "Fintech & SaaS",
    menuItem: "MVP",
    techStack: ["Next.js 15", "Recharts", "Prisma", "VietQR Hook"],
    features: ["Biểu đồ MRR/ARR thời gian thực", "Webhook tự động kích hoạt tài khoản", "Xuất báo cáo PDF", "Bảng so sánh gói dịch vụ"],
    popular: true,
    thumbnail: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80",
    previewUrl: "https://demo.grabcode.dev/saas-billing"
  },
  {
    id: "tpl-ecommerce-fast",
    title: "E-Commerce Checkout Siêu Tốc",
    tagline: "Luồng đặt hàng 1 trang (One-page Checkout) kèm VietQR động chuẩn hóa",
    category: "E-Commerce",
    menuItem: "SHOP",
    techStack: ["React 19", "Zustand", "Tailwind CSS", "Web Audio API"],
    features: ["Giỏ hàng kéo thả mượt mà", "Tự sinh QR theo số tiền", "Âm thanh chốt đơn", "Tối ưu chuyển đổi di động"],
    popular: false,
    thumbnail: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=600&q=80",
    previewUrl: "https://demo.grabcode.dev/fast-checkout"
  },
  {
    id: "tpl-voice-agent",
    title: "AI Voice Agent Booking",
    tagline: "Giao diện trợ lý đàm thoại AI giọng nói đặt lịch hẹn nha khoa / spa tự động",
    category: "AI & Automation",
    menuItem: "CHATBOT",
    techStack: ["Next.js 15", "ElevenLabs API", "FastAPI", "WebRTC"],
    features: ["Microphone visualizer thời gian thực", "Speech-to-Text độ trễ thấp", "Đồng bộ lịch Google Calendar", "Lưu biên bản cuộc gọi"],
    popular: true,
    thumbnail: "https://images.unsplash.com/photo-1589254065878-42c9da997008?auto=format&fit=crop&w=600&q=80",
    previewUrl: "https://demo.grabcode.dev/ai-voice-booking"
  }
];

export const SEED_CODER: CoderProfile = {
  id: "cdr-8891",
  name: "Bùi Minh H.",
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
  tier: "GOLD",
  rating: 4.98,
  completedOrders: 142,
  walletBalanceVnd: 14850000,
  isOnline: true,
  specialties: ["Next.js 15", "Tailwind CSS", "TypeScript", "Claude Code CLI"],
  phone: "0982***678"
};

export const SAMPLE_PROMPTS = [
  "Dựng Mini App đặt phòng homestay Đà Lạt có bản đồ phòng trống và thanh toán VietQR",
  "Làm Web App chấm công nhân viên qua GPS và camera nhận diện nụ cười",
  "Tạo Tool tự động tổng hợp tin tức thị trường chứng khoán gửi qua Telegram mỗi 8h sáng",
  "Xây dựng Landing Page tuyển sinh khóa học AI có form trắc nghiệm định hướng nghề nghiệp"
];

export const INITIAL_DEMO_ORDER: Order = {
  id: "GC-9821",
  tier: "EXPRESS",
  title: "Mini CRM Bất Động Sản Đô Thị Mới",
  customerName: "Khách demo (dữ liệu mẫu)",
  customerPrompt: "Cần gấp 1 web CRM quản lý 80 căn hộ phân khu Sun Grand, sale có thể kéo thả trạng thái chốt cọc và bắn tin qua Telegram cho giám đốc sàn.",
  templateId: "tpl-realestate-crm",
  templateName: "Mini CRM Bất Động Sản",
  framework: "Next.js 15 + Tailwind CSS + Supabase",
  priceVnd: 2800000,
  escrowStatus: "ESCROW_LOCKED",
  status: "BUILDING",
  etaHours: 3,
  createdAt: new Date().toISOString(),
  assignedCoder: SEED_CODER,
  demoUrl: "https://fastdemo-crm-preview.vercel.app",
  repoUrl: "https://github.com/fastdemo-sandbox/gc-9821-crm-poc",
  brief: {
    title: "Đặc tả kỹ thuật: Mini CRM Bất Động Sản Đô Thị Mới",
    scopeSummary: "Xây dựng Web App CRM tối giản cho sale bất động sản quản lý quỹ căn, đặt chỗ giữ chỗ và thông báo chốt cọc thời gian thực.",
    features: [
      "Bảng Kanban 4 cột: Đang mở bán, Giữ chỗ (15p), Đã cọc, Đã ký HĐ",
      "Popup thông tin chi tiết căn (Diện tích, Giá m2, Hướng, Chiết khấu)",
      "Nút gửi Telegram Alert khi khách chuyển tiền cọc",
      "Bộ lọc nhanh theo tầng, diện tích và mức giá"
    ],
    inScope: [
      "Giao diện Responsive Desktop + Mobile",
      "Mock dữ liệu 80 căn hộ với bộ filter client-side tức thì",
      "Trình duyệt giả lập thông báo Telegram Webhook",
      "Deploy live link Vercel preview"
    ],
    outOfScope: [
      "Tích hợp ngân hàng bảo lãnh vay vốn phức tạp",
      "Ký số điện tử bằng token USB"
    ],
    acceptanceCriteria: [
      { id: "ac-1", text: "Hiển thị đầy đủ danh sách căn hộ theo dạng lưới và Kanban", passed: true },
      { id: "ac-2", text: "Bộ lọc diện tích và mức giá phản hồi ngay lập tức < 50ms", passed: true },
      { id: "ac-3", text: "Thao tác đổi trạng thái căn sang 'Đã cọc' kích hoạt alert thành công", passed: false },
      { id: "ac-4", text: "Link demo chạy thật mở được trên điện thoại không vỡ layout", passed: false }
    ],
    milestones: [
      {
        id: "M1",
        title: "Khởi tạo Monorepo, Database Schema & Mock 80 căn hộ",
        description: "Dựng cấu trúc thư mục, khai báo TypeScript interfaces và tạo seed data căn hộ.",
        weightPercent: 20,
        status: "COMPLETED",
        completedAt: "10 phút trước",
        commitHash: "7b4a2e1"
      },
      {
        id: "M2",
        title: "Dựng Giao diện Kanban & Bộ Lọc Nhanh Tương Tác",
        description: "Hoàn thiện tương tác kéo thả căn hộ, modal chi tiết và bộ lọc nhiều tiêu chí.",
        weightPercent: 50,
        status: "IN_PROGRESS",
        completedAt: undefined,
        commitHash: "3f98bc4"
      },
      {
        id: "M3",
        title: "Tích hợp Telegram Mock Alert & Deploy Demo Sandbox",
        description: "Deploy bản build lên Vercel sandbox và bàn giao link nghiệm thu cho khách.",
        weightPercent: 30,
        status: "PENDING",
        completedAt: undefined,
        commitHash: undefined
      }
    ],
    claudeMdContent: `# HƯỚNG DẪN DÀNH CHO CODER (CLAUDE.md)
## Dự án: Mini CRM Bất Động Sản Đô Thị Mới (GC-9821)
- **Công nghệ yêu cầu:** Next.js 15 (App Router), Tailwind CSS v4/v3, Lucide React icons.
- **Tiêu chuẩn giao diện:** Tuân thủ FastDemo Design System (#4F46E5).
- **Mốc bàn giao:**
  1. [M1] Khởi tạo dữ liệu và layout cơ bản (20% thù lao)
  2. [M2] Hoàn thành Kanban và bộ lọc (50% thù lao)
  3. [M3] Deploy Vercel link và bàn giao (30% thù lao)
- **Quy tắc:** Không dùng thư viện ngoài chưa duyệt. Kiểm thử responsive mobile trước khi bàn giao.`
  },
  commits: [
    {
      hash: "7b4a2e1",
      message: "feat(core): init database schema and seed 80 apartments",
      timestamp: "10 phút trước",
      milestoneId: "M1",
      author: "Bùi Minh H. (Coder)"
    },
    {
      hash: "3f98bc4",
      message: "feat(ui): implement responsive kanban board with drag-drop status",
      timestamp: "3 phút trước",
      milestoneId: "M2",
      author: "Bùi Minh H. (Coder)"
    }
  ]
};
