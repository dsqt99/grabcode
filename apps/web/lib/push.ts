import type { PushKey } from '@grabcode/contracts/schemas';
import { API_URL } from '@grabcode/auth-ui';

const api = (path: string, init: RequestInit) =>
  fetch(`${API_URL}${path}`, { ...init, credentials: 'include', headers: { 'content-type': 'application/json' } });

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** null = WebPush not configured on core-api (GET /v1/push/key 404) or no API. */
export async function pushKey(): Promise<string | null> {
  if (!API_URL) return null;
  const r = await fetch(`${API_URL}/v1/push/key`);
  return r.ok ? ((await r.json()) as PushKey).publicKey : null;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Asks permission, subscribes this browser and stores it for the signed-in user. */
export async function subscribePush(publicKey: string): Promise<void> {
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Trình duyệt đã chặn thông báo. Mở quyền thông báo cho trang này rồi thử lại.');
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey }));
  const r = await api('/v1/me/push-subscriptions', { method: 'PUT', body: JSON.stringify(sub.toJSON()) });
  if (!r.ok) throw new Error(`Lưu đăng ký thất bại (${r.status})`);
}

export async function unsubscribePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await api('/v1/me/push-subscriptions', { method: 'DELETE', body: JSON.stringify({ endpoint: sub.endpoint }) });
  await sub.unsubscribe();
}
