import type { AIBrief, OrderTier } from '@grabcode/contracts';
import type { BriefJob, OrderCreate, OrderDto, OrderRepo, OrderStatus, PaymentInstructions } from '@grabcode/contracts/schemas';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const POLL_MS = 1500;
const TIMEOUT_MS = 120_000;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => (clearTimeout(t), reject(signal.reason)), { once: true });
  });

async function call(path: string, signal: AbortSignal, init?: RequestInit): Promise<BriefJob> {
  const res = await fetch(`${API_URL}${path}`, { ...init, signal, credentials: 'include', headers: { 'content-type': 'application/json' } });
  if (!res.ok) throw new Error(`core-api ${res.status}`);
  return res.json();
}

/**
 * Ask core-api for an AI brief (async job: POST, then poll until READY/FAILED).
 * Returns null when no API is configured; throws on FAILED, timeout or network error.
 */
export async function requestBrief(
  input: { prompt: string; tier: OrderTier; templateId: string | null; framework: string },
  signal: AbortSignal,
): Promise<AIBrief | null> {
  if (!API_URL || !input.prompt.trim()) return null;
  let job = await call('/v1/briefs', signal, { method: 'POST', body: JSON.stringify(input) });
  const deadline = Date.now() + TIMEOUT_MS;
  while (job.status === 'PENDING') {
    if (Date.now() > deadline) throw new Error('brief timeout');
    await sleep(POLL_MS, signal);
    job = await call(`/v1/briefs/${job.id}`, signal);
  }
  if (job.status === 'FAILED' || !job.brief) throw new Error(job.error ?? 'brief failed');
  return job.brief;
}

// ---- Orders (S1). All need the gc_session cookie; only used when API_URL is set. ----

export const ordersApiEnabled = !!API_URL;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { ...init, credentials: 'include', headers: { 'content-type': 'application/json' } });
  if (!res.ok) throw Object.assign(new Error(`core-api ${res.status}`), { status: res.status });
  return res.json();
}

export const createOrder = (input: OrderCreate) => api<OrderDto>('/v1/orders', { method: 'POST', body: JSON.stringify(input) });
export const getOrder = (id: string) => api<OrderDto>(`/v1/orders/${encodeURIComponent(id)}`);
export const transitionOrder = (id: string, status: OrderStatus) =>
  api<OrderDto>(`/v1/orders/${encodeURIComponent(id)}/transitions`, { method: 'POST', body: JSON.stringify({ status }) });
/** Repo + commits of the order; null until the coder has opened one. */
export const getOrderRepo = (id: string) => api<OrderRepo>(`/v1/repos/${encodeURIComponent(id)}`).catch(() => null);

// ---- Escrow (S2): customer pays by bank transfer, SePay webhook funds the order. ----
export const getOrderPayment = (id: string) => api<PaymentInstructions>(`/v1/orders/${encodeURIComponent(id)}/payment`);
/** Dev only (AUTH_DEV_LOGIN): simulate the transfer of the remaining amount. */
export const devDeposit = (orderId: string) => api<PaymentInstructions>('/v1/payments/dev-deposit', { method: 'POST', body: JSON.stringify({ orderId }) });
