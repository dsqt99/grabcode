'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OrderRepo } from '@grabcode/contracts/schemas';
import { API_URL } from './auth';

const POLL_MS = 3000;

const call = async (path: string, init?: RequestInit): Promise<OrderRepo> => {
  const res = await fetch(`${API_URL}${path}`, { ...init, credentials: 'include', headers: { 'content-type': 'application/json' } });
  if (!res.ok) throw new Error(`core-api ${res.status}`);
  return res.json();
};

/**
 * Real GitHub repo of the active order: requests it (idempotent per orderId) and polls until READY/FAILED.
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
      if (r.status === 'PENDING') timer = setTimeout(() => call(`/v1/repos/${encodeURIComponent(r.orderId)}`).then(poll, fail), POLL_MS);
    };
    const fail = (e: unknown) => !stop && setError(String(e));
    setError(null);
    call('/v1/repos', { method: 'POST', body: JSON.stringify({ orderId: order.id, title: order.title, claudeMd: order.brief.claudeMdContent }) }).then(poll, fail);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
    // Re-run per order and on retry only; title/brief of a given order do not change.
  }, [id, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return API_URL ? { repo: repo?.orderId === id ? repo : null, error, retry } : null;
}
