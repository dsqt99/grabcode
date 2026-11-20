'use client';

import type { ReactNode } from 'react';
import type { AdminCoder, AdminCoderList } from '@grabcode/contracts/schemas';
import { api, vnd } from '../lib/api';
import { Chip, Table, loadingOf, useList } from './ui';

const TIERS: NonNullable<AdminCoder['tierOverride']>[] = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'];
const APPROVAL: Record<AdminCoder['approval'], ReactNode> = {
  PENDING: <Chip tone="warn">Chờ duyệt</Chip>,
  APPROVED: <Chip tone="success">Đã duyệt</Chip>,
  REJECTED: <Chip tone="danger">Đã từ chối</Chip>,
};

/** P0-8: new coders wait here (listed first) until approved; only approved coders get jobs and offers. */
export default function Coders() {
  const { data, error, busy, act } = useList<AdminCoderList>('/v1/admin/coders');
  const patch = (c: AdminCoder, body: object) => act(() => api(`/v1/admin/coders/${c.id}`, 'PATCH', body));
  const decide = (c: AdminCoder, approval: 'APPROVED' | 'REJECTED') => {
    if (confirm(approval === 'APPROVED' ? `Duyệt ${c.name}? Freelancer này sẽ thấy bảng việc và nhận được đơn đã thanh toán.` : `Từ chối ${c.name}?`))
      void patch(c, { approval });
  };
  return (
    <Table head={['Coder', 'Hồ sơ', 'Duyệt', 'Tier', 'Đơn xong', 'Ví', 'Trạng thái', '']} empty="Chưa có coder." error={error} loading={loadingOf(data, error)}>
      {(data?.coders ?? []).map((c) => (
        <tr key={c.id}>
          <td>
            <b>{c.name}</b>
            <div className="text-xs text-stone-600">{c.githubLogin ?? c.email}</div>
            {c.phone && <div className="text-xs text-stone-600">{c.phone}</div>}
          </td>
          <td className="max-w-xs text-xs">
            {c.profile ? (
              <details>
                <summary className="cursor-pointer font-semibold">{c.profile.headline || '(chưa có tiêu đề)'}</summary>
                <p className="mt-1">{c.profile.experienceLevel} · {c.profile.skills.join(', ') || 'chưa ghi kỹ năng'}</p>
                {c.profile.bio && <p className="mt-1 whitespace-pre-wrap">{c.profile.bio}</p>}
                {[c.profile.githubUrl, ...c.profile.portfolioUrls].filter(Boolean).map((u) => (
                  <a key={u} className="block break-all text-blue-700 underline" href={u!} target="_blank" rel="noopener noreferrer nofollow">
                    {u}
                  </a>
                ))}
              </details>
            ) : (
              <i>Chưa điền hồ sơ</i>
            )}
          </td>
          <td>
            {APPROVAL[c.approval]}
            <div className="mt-2 flex gap-1">
              {c.approval !== 'APPROVED' && (
                <button className="btn-primary btn-compact" disabled={busy} onClick={() => decide(c, 'APPROVED')}>Duyệt</button>
              )}
              {c.approval !== 'REJECTED' && (
                <button className="btn-outline btn-compact" disabled={busy} onClick={() => decide(c, 'REJECTED')}>Từ chối</button>
              )}
            </div>
          </td>
          <td>
            <select aria-label={`Tier của ${c.name}`} className="min-h-[36px] px-2" value={c.tierOverride ?? ''} disabled={busy} onChange={(e) => patch(c, { tierOverride: e.target.value || null })}>
              <option value="">Tự động{c.tierOverride ? '' : ` (${c.tier})`}</option>
              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </td>
          <td className="tabular-nums">{c.completedOrders}</td>
          <td className="tabular-nums">{vnd(c.balanceVnd)}</td>
          <td>{c.suspended ? <Chip tone="danger">Đã khoá</Chip> : c.online ? <Chip tone="success">Online</Chip> : <Chip tone="neutral">Offline</Chip>}</td>
          <td>
            <button className="btn-outline btn-compact" disabled={busy} onClick={() => patch(c, { suspended: !c.suspended })}>
              {c.suspended ? 'Mở khoá' : 'Khoá'}
            </button>
          </td>
        </tr>
      ))}
    </Table>
  );
}
