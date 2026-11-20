import { z } from 'zod';
import type { AIBrief } from '@grabcode/contracts';
import type { BriefRequestedEvent } from '@grabcode/contracts/schemas';

/** What the LLM fills in. Ids, weights, statuses and CLAUDE.md are set by code, not the model. */
export const BriefDraftSchema = z.object({
  title: z.string().describe('Tên ngắn gọn của dự án POC, không có tiền tố'),
  scopeSummary: z.string().describe('1-2 câu tóm tắt phạm vi'),
  features: z.array(z.string()).describe('3-7 tính năng chính'),
  inScope: z.array(z.string()).describe('3-6 hạng mục trong phạm vi'),
  outOfScope: z.array(z.string()).describe('2-5 hạng mục ngoài phạm vi'),
  acceptanceCriteria: z.array(z.string()).describe('3-6 tiêu chí nghiệm thu kiểm chứng được'),
  milestones: z
    .array(z.object({ title: z.string(), description: z.string() }))
    .describe('Đúng 3 mốc: M1 khởi tạo/schema, M2 core logic, M3 polish UI & deploy sandbox'),
});
export type BriefDraft = z.infer<typeof BriefDraftSchema>;

const WEIGHTS = [20, 50, 30];
const DEFAULT_MILESTONES = [
  { title: 'Khởi tạo repo, schema & dữ liệu mẫu', description: 'Dựng cấu trúc dự án và seed data.' },
  { title: 'Core logic & luồng dữ liệu chính', description: 'Hoàn thiện tính năng cốt lõi.' },
  { title: 'Hoàn thiện UI & Deploy sandbox', description: 'Polish giao diện, deploy link nghiệm thu.' },
];

export function assembleBrief(draft: BriefDraft, req: BriefRequestedEvent['data']): AIBrief {
  // Payout split is fixed at 20/50/30, so always exactly 3 milestones regardless of model output.
  const milestones = WEIGHTS.map((weightPercent, i) => ({
    id: `M${i + 1}`,
    ...(draft.milestones[i] ?? DEFAULT_MILESTONES[i]),
    weightPercent,
    status: 'PENDING' as const,
  }));
  const title = draft.title.replace(/^Đặc tả kỹ thuật:\s*/, '').trim() || 'Dự án POC mới';

  const claudeMdContent = [
    '# HƯỚNG DẪN DÀNH CHO CODER (CLAUDE.md)',
    `## Dự án: ${title}`,
    `- **Gói dịch vụ:** ${req.tier}`,
    `- **Công nghệ yêu cầu:** ${req.framework}`,
    `- **Yêu cầu gốc của khách:** ${req.prompt}`,
    '- **Tiêu chuẩn giao diện:** FastDemo Design System (#4F46E5)',
    '',
    '## Mốc bàn giao',
    ...milestones.map((m, i) => `${i + 1}. [${m.id}] ${m.title} (${m.weightPercent}% thù lao)`),
    '',
    '## Phạm vi',
    ...draft.inScope.map((s) => `- ${s}`),
    '',
    '## Ngoài phạm vi',
    ...draft.outOfScope.map((s) => `- ${s}`),
    '',
    '## Tiêu chí nghiệm thu',
    ...draft.acceptanceCriteria.map((s) => `- ${s}`),
    '',
    '## Quy tắc',
    '- Commit theo từng mốc, tiền tố `feat(...)`.',
    '- Không dùng thư viện ngoài chưa được duyệt.',
    '- Kiểm thử responsive mobile trước khi bàn giao.',
  ].join('\n');

  return {
    title: `Đặc tả kỹ thuật: ${title}`,
    scopeSummary: draft.scopeSummary,
    features: draft.features,
    inScope: draft.inScope,
    outOfScope: draft.outOfScope,
    acceptanceCriteria: draft.acceptanceCriteria.map((text, i) => ({ id: `ac-${i + 1}`, text, passed: false })),
    milestones,
    claudeMdContent,
  };
}
