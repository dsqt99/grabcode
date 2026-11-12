'use client';

import { useCallback, useEffect, useState } from 'react';
import { onRealtimeHint, pollDelay } from '@grabcode/contracts';
import type { OrderRepo } from '@grabcode/contracts/schemas';
import { API_URL } from '@grabcode/auth-ui';

const POLL_MS = 3000;

const call = async (path: string, init?: RequestInit): Promise<OrderRepo> => {
  const res = await fetch(`${API_URL}${path}`, { ...init, credentials: 'include', headers: { 'content-type': 'application/json' } });
  if (!res.ok) throw new Error(`core-api ${res.status}`);
  return res.json();
};

/**
 * Real GitHub repo of the active order: requests it (idempotent per orderId) and polls until READY/FAILED; realtime hints refresh it (commits too).
 * Returns null without NEXT_PUBLIC_API_URL (mock mode: callers keep the mock repo URL).
 */
export function useOrderRepo(order: { id: string; title: string; brief: { claudeMdContent: string } } | null) {
  const [repo, setRepo] = useState<OrderRepo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const id = order?.id;

  useEffect(() => {
    if (!API_URL || !order) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = (r: OrderRepo) => {
      if (stop) return;
      setRepo(r);
      if (r.status === 'PENDING') timer = setTimeout(() => call(`/v1/repos/${encodeURIComponent(r.orderId)}`).then(poll, fail), pollDelay(POLL_MS));
    };
    const fail = (e: unknown) => !stop && setError(String(e));
    setError(null);
    call('/v1/repos', { method: 'POST', body: JSON.stringify({ orderId: order.id, title: order.title, claudeMd: order.brief.claudeMdContent }) }).then(poll, fail);
    // Repo status or a pushed commit (order hint) changed: refetch now.
    const off = onRealtimeHint(API_URL, (h) => {
      if (h.orderId === order.id && h.type !== 'chat') call(`/v1/repos/${encodeURIComponent(order.id)}`).then((r) => !stop && setRepo(r), console.warn);
    });
    return () => {
      stop = true;
      clearTimeout(timer);
      off();
    };
    // Re-run per order and on retry only; title/brief of a given order do not change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return API_URL ? { repo: repo?.orderId === id ? repo : null, error, retry } : null;
}
