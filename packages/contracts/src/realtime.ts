import type { RealtimeHint, RealtimeToken } from './schemas/realtime';

// Minimal Centrifugo client (JSON protocol over the browser WebSocket, no SDK): one shared connection per tab,
// connect on first listener, close on last. Pushes are hints only; callers refetch over REST.
// shortcut: no token refresh (24h token, a reconnect fetches a new one) and no recovery of hints missed while offline;
// callers keep a slow poll as the safety net (see pollDelay).

type Listener = (h: RealtimeHint) => void;
const listeners = new Set<Listener>();
let ws: WebSocket | null = null;
let live = false;
let retry = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let apiBase = '';
let opening = false;

/** Poll interval for a caller that also listens to hints: slow while the socket is up, `fast` otherwise. */
export const pollDelay = (fast: number) => (live ? 30_000 : fast);

async function open() {
  if (ws || opening || !listeners.size) return;
  opening = true;
  const res = await fetch(`${apiBase}/v1/realtime/token`, { credentials: 'include' }).catch(() => null);
  opening = false;
  if (!res?.ok) return res?.status === 404 ? undefined : schedule(); // 404: realtime not configured, stay on polling
  const { url, token } = (await res.json()) as RealtimeToken;
  if (ws || !listeners.size) return;
  const sock = (ws = new WebSocket(url));
  let pong = false;
  sock.onopen = () => sock.send(JSON.stringify({ id: 1, connect: { token, name: 'grabcode-web' } }));
  sock.onmessage = (e) => {
    // One frame may hold several newline-delimited replies; an empty {} is a server ping.
    for (const line of String(e.data).split('\n')) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      if (msg.id === 1 && msg.connect) {
        live = true;
        retry = 0;
        pong = !!msg.connect.pong;
      } else if (msg.push?.pub?.data) {
        for (const l of listeners) l(msg.push.pub.data as RealtimeHint);
      } else if (!Object.keys(msg).length && pong) {
        sock.send('{}');
      }
    }
  };
  sock.onclose = () => {
    if (ws === sock) ws = null;
    live = false;
    schedule();
  };
}

function schedule() {
  clearTimeout(timer);
  if (listeners.size) timer = setTimeout(() => void open(), Math.min(30_000, 1000 * 2 ** retry++));
}

/** Calls `fn` for every hint pushed to the signed-in user. Returns the unsubscribe function. */
export function onRealtimeHint(apiUrl: string, fn: Listener): () => void {
  apiBase = apiUrl;
  listeners.add(fn);
  void open();
  return () => {
    listeners.delete(fn);
    if (listeners.size) return;
    clearTimeout(timer);
    ws?.close();
    ws = null;
    live = false;
  };
}
