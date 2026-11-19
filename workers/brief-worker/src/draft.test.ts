import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AIBriefSchema } from '@grabcode/contracts/schemas';
import { assembleBrief } from './draft';

const req = {
  jobId: '00000000-0000-4000-8000-000000000000',
  prompt: 'Landing page quán cà phê có đặt bàn',
  tier: 'EXPRESS' as const,
  templateId: null,
  framework: 'Next.js 15 + Tailwind CSS',
};

test('assembleBrief always yields 3 milestones weighted 20/50/30 and a contract-valid brief', () => {
  const brief = assembleBrief(
    {
      title: 'Đặc tả kỹ thuật: Cafe Booking',
      scopeSummary: 's',
      features: ['f'],
      inScope: ['i'],
      outOfScope: ['o'],
      acceptanceCriteria: ['a1', 'a2'],
      milestones: [{ title: 'only one', description: 'd' }],
    },
    req,
  );
  assert.deepEqual(brief.milestones.map((m) => m.weightPercent), [20, 50, 30]);
  assert.equal(brief.milestones[0].title, 'only one');
  assert.equal(brief.title, 'Đặc tả kỹ thuật: Cafe Booking');
  assert.deepEqual(brief.acceptanceCriteria.map((a) => a.id), ['ac-1', 'ac-2']);
  AIBriefSchema.parse(brief);
});
