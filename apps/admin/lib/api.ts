// Thin fetch wrapper for core-api: cookie session (gc_session), JSON in/out, error message from ErrorResponse.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) throw new ApiError(r.status, data?.message ?? `HTTP ${r.status}`);
  return data as T;
}

export const vnd = (n: number) => `${n.toLocaleString('vi-VN')} ₫`;
export const when = (iso: string) => new Date(iso).toLocaleString('vi-VN');
