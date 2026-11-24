'use client';

import { useEffect, useRef } from 'react';
import type { CommitLogItem } from '@grabcode/contracts';
import { formatTime } from '../lib/orderView';

export default function GitTerminalLog({ commits, repoUrl }: { commits: CommitLogItem[]; repoUrl?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [commits.length]);

  return (
    <section aria-label="Nhật ký Git" className="overflow-hidden rounded-xl bg-ink">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
        <span className="h-3 w-3 rounded-full bg-red-400" /><span className="h-3 w-3 rounded-full bg-amber-400" /><span className="h-3 w-3 rounded-full bg-teal-400" />
        <span className="ml-2 font-mono text-xs text-stone-400">git log --oneline {repoUrl ? `# ${repoUrl.replace('https://', '')}` : ''}</span>
      </div>
      <div ref={ref} className="max-h-56 overflow-y-auto p-4 font-mono text-xs leading-6" role="log" aria-live="polite">
        {commits.length === 0 && <p className="text-stone-400">$ chờ commit đầu tiên của freelancer...</p>}
        {commits.map((c) => (
          <p key={c.hash} className="animate-pop break-words">
            <span className="text-amber-300">{c.hash}</span> <span className="text-stone-100">{c.message}</span>{' '}
            <span className="text-stone-400">
              ({c.milestoneId ? `${c.milestoneId}, ` : ''}{c.author}, {formatTime(c.timestamp)})
            </span>
          </p>
        ))}
        <p className="text-brand-300">$ <span className="inline-block h-3 w-1.5 animate-pulse bg-brand-300 motion-reduce:animate-none align-middle" /></p>
      </div>
    </section>
  );
}
