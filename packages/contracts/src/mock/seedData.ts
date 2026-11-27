import { Order } from '../types/order';
import { CoderProfile } from '../types/coder';
import { MENU, type MenuItemCode } from '../schemas/pricing';

export interface POCTemplate {
  id: string;
  title: string;
  /** Câu hỏi mẫu của gói (HON-60): điền vào ô mô tả khi bấm "Dùng mẫu". */
  tagline: string;
  category: string;
  /** Gói menu của mẫu: giá từ, thời gian giao; mỗi gói dưới trần MAX_ORDER_VND. */
  menuItem: MenuItemCode;
  techStack: string[];
  features: string[];
  popular: boolean;
}

/** Một mẫu cho mỗi gói trong MENU (cùng thứ tự); tên và câu hỏi mẫu lấy thẳng từ MENU để không lệch giá/gói. */
const TEMPLATE_DETAILS: Record<MenuItemCode, { category: string; techStack: string[]; features: string[]; popular?: boolean }> = {
  DEMO_LANDING: { category: 'Chủ shop online', techStack: ['Next.js', 'Tailwind CSS', 'Google Sheets'], features: ['Trang bán 1 sản phẩm chuẩn mobile', 'Form đặt hàng gửi về Zalo/Sheets'], popular: true },
  DEMO_SHOP: { category: 'Chủ shop online', techStack: ['Next.js', 'Tailwind CSS', 'Zustand'], features: ['Danh sách sản phẩm mẫu, chọn size', 'Giỏ hàng và đặt đơn COD'], popular: true },
  DEMO_CHATBOT: { category: 'Chủ shop online', techStack: ['Messenger/Zalo test', 'LLM API'], features: ['Trả lời 10 câu hỏi thường gặp về giá, ship', 'Chạy ở kênh thử'] },
  DEMO_SHEETS_SYNC: { category: 'Chủ shop online', techStack: ['Google Sheets', 'Apps Script', 'CSV'], features: ['Nhập file đơn xuất từ sàn', 'Tự tính doanh thu ngày'] },
  DEMO_BOOKING: { category: 'Chủ shop online', techStack: ['Next.js', 'Tailwind CSS'], features: ['Chọn dịch vụ, giờ, xác nhận', 'Lịch hiện ra cho chủ tiệm'] },
  APP_CHECKUP: { category: 'Founder có prototype AI', techStack: ['Code review', 'Claude Code'], features: ['Báo cáo khám 1–2 trang', 'Sửa mẫu 1 lỗi nặng nhất, video trước/sau'] },
  DEMO_AI_DOCS: { category: 'Founder có prototype AI', techStack: ['Next.js', 'LLM API', 'Vector search'], features: ['Chat hỏi đáp trên tối đa 10 tài liệu', 'Trả lời có trích nguồn'], popular: true },
  DEMO_APP_FLOW: { category: 'Founder có prototype AI', techStack: ['Next.js', 'Tailwind CSS'], features: ['1 luồng chính chạy trên điện thoại', 'Dữ liệu mẫu để show đối tác'] },
};

export const SEED_TEMPLATES: POCTemplate[] = MENU.map((m) => ({
  id: `tpl-${m.code.toLowerCase().replace(/_/g, '-')}`,
  title: m.name,
  tagline: m.sampleQuestion,
  menuItem: m.code,
  ...TEMPLATE_DETAILS[m.code],
  popular: TEMPLATE_DETAILS[m.code].popular ?? false,
}));

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

/** Câu hỏi mẫu trên trang chủ: đúng 8 câu của menu HON-60, gói 1–5 cho chủ shop, 6–8 cho founder. */
export const SAMPLE_PROMPTS: string[] = MENU.map((m) => m.sampleQuestion);

export const INITIAL_DEMO_ORDER: Order = {
  id: "GC-9821",
  tier: "EXPRESS",
  title: "Mini CRM Bất Động Sản Đô Thị Mới",
  customerName: "Khách demo (dữ liệu mẫu)",
  customerPrompt: "Cần gấp 1 web CRM quản lý 80 căn hộ phân khu Sun Grand, sale có thể kéo thả trạng thái chốt cọc và bắn tin qua Telegram cho giám đốc sàn.",
  templateId: "tpl-demo-shop",
  templateName: "Demo shop mini",
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
- **Tiêu chuẩn giao diện:** Tuân thủ Ai Code AI Design System (#0B44CC).
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
