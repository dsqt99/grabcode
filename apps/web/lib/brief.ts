import { AIBrief, SEED_TEMPLATES } from '@grabcode/contracts';
import { daysLabel, getMenuItem, type MenuItemCode } from './pricing';

function titleFrom(prompt: string): string {
  const clean = prompt.trim().replace(/\s+/g, ' ');
  if (!clean) return 'Dự án POC mới';
  const first = clean.split(/[.,;\n]/)[0];
  return first.length > 70 ? `${first.slice(0, 67)}...` : first;
}

/** Deterministic, pure brief generator that stands in for the LLM brief when the AI service is unavailable. */
export function genBrief(
  prompt: string,
  item: MenuItemCode,
  templateId?: string | null,
  framework = 'Next.js 15 + Tailwind CSS'
): AIBrief {
  const tpl = SEED_TEMPLATES.find((t) => t.id === templateId);
  const cfg = getMenuItem(item);
  const title = !prompt.trim() && tpl ? tpl.title : titleFrom(prompt);
  const lower = prompt.toLowerCase();

  const features: string[] = [];
  if (tpl) features.push(...tpl.features.slice(0, 2).map((f) => `${f} (kế thừa template ${tpl.title})`));
  if (/(thanh toán|vietqr|qr)/.test(lower)) features.push('Thanh toán VietQR sinh mã theo số tiền');
  if (/(telegram|zalo|thông báo)/.test(lower)) features.push('Bắn thông báo tự động qua kênh nhắn tin');
  if (/(bản đồ|map|gps)/.test(lower)) features.push('Hiển thị bản đồ / vị trí tương tác');
  if (/(\bai\b|nhận diện|chatbot|trợ lý)/.test(lower)) features.push('Tích hợp tính năng AI cốt lõi (mock, có thể thay bằng API thật)');
  features.push('Giao diện responsive cho cả desktop và mobile');
  features.push('Dữ liệu mẫu đủ dùng để demo trọn luồng nghiệp vụ chính');

  const inScope = [
    `Xây dựng giao diện và luồng chính trên ${framework}`,
    'Mock dữ liệu và API nội bộ phục vụ demo',
    'Deploy sandbox preview có link truy cập công khai',
    'Bàn giao source code qua private GitHub repo',
  ];
  const outOfScope = [
    'Tích hợp cổng thanh toán / ngân hàng thật (production)',
    'Hạ tầng chịu tải lớn, bảo mật mức doanh nghiệp',
    'Ứng dụng native trên App Store / Google Play',
  ];

  const milestones: AIBrief['milestones'] = [
    { id: 'M1', title: 'Khởi tạo repo, schema & dữ liệu mẫu', description: 'Dựng cấu trúc dự án, khai báo kiểu dữ liệu và seed data.', weightPercent: 20, status: 'PENDING' },
    { id: 'M2', title: 'Core logic & luồng dữ liệu chính', description: 'Hoàn thiện tính năng cốt lõi theo đặc tả và tương tác chính.', weightPercent: 50, status: 'PENDING' },
    { id: 'M3', title: 'Hoàn thiện UI & Deploy sandbox', description: 'Polish giao diện, kiểm thử responsive, deploy link nghiệm thu.', weightPercent: 30, status: 'PENDING' },
  ];

  const acceptanceCriteria = [
    'Luồng nghiệp vụ chính chạy trọn vẹn từ đầu đến cuối',
    'Giao diện không vỡ layout trên điện thoại (375px)',
    'Link demo mở được công khai, tải trang dưới 3 giây',
    'Mã nguồn build thành công, vượt QA Gate (lint, build, security scan)',
  ].map((text, i) => ({ id: `ac-${i + 1}`, text, passed: false }));

  const claudeMdContent = [
    '# HƯỚNG DẪN DÀNH CHO CODER (CLAUDE.md)',
    `## Dự án: ${title}`,
    `- **Loại việc:** ${cfg.name} (${daysLabel(cfg.days)})`,
    `- **Công nghệ yêu cầu:** ${framework}`,
    `- **Yêu cầu gốc của khách:** ${prompt.trim() || '(trống)'}`,
    '- **Tiêu chuẩn giao diện:** Emerald Mobility Design System (#00B14F)',
    '',
    '## Mốc bàn giao',
    '1. [M1] Khởi tạo repo & Schema (20% thù lao)',
    '2. [M2] Core logic & Data flow (50% thù lao)',
    '3. [M3] Polish UI & Deploy sandbox (30% thù lao)',
    '',
    '## Phạm vi',
    ...inScope.map((s) => `- ${s}`),
    '',
    '## Ngoài phạm vi',
    ...outOfScope.map((s) => `- ${s}`),
    '',
    '## Quy tắc',
    '- Commit theo từng mốc, tiền tố `feat(...)`.',
    '- Không dùng thư viện ngoài chưa được duyệt.',
    '- Kiểm thử responsive mobile trước khi bàn giao.',
  ].join('\n');

  return {
    title: `Đặc tả kỹ thuật: ${title}`,
    scopeSummary: `${cfg.name}: "${title}". Chia 3 mốc 20% / 50% / 30%; mốc cuối được trả khi khách nghiệm thu cả đơn.`,
    features,
    inScope,
    outOfScope,
    acceptanceCriteria,
    milestones,
    claudeMdContent,
  };
}
