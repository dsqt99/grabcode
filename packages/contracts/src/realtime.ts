import type { RealtimeHint, RealtimeToken } from './schemas/realtime';

// Minimal Centrifugo client (JSON protocol over the browser WebSocket, no SDK): one shared connection per tab,
// connect on first listener, close on last. Pushes are hints only; callers refetch over REST.
// The token is refreshed in place before it expires. Hints missed while the socket was down are not replayed:
// callers poll fast whenever the socket is not live (see pollDelay), which covers that gap.

type Listener = (h: RealtimeHint) => void;
const listeners = new Set<Listener>();
let ws: WebSocket | null = null;
let live = false;
let retry = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let apiBase = '';
let opening = false;
let refresher: ReturnType<typeof setTimeout> | undefined;

const fetchToken = () => fetch(`${apiBase}/v1/realtime/token`, { credentials: 'include' }).catch(() => null);

/** Sends a fresh token shortly before `ttl` seconds run out; on failure the server disconnects and we reconnect. */
function refreshIn(sock: WebSocket, ttl: number) {
  clearTimeout(refresher);
  refresher = setTimeout(async () => {
    const res = await fetchToken();
    if (ws !== sock || !res?.ok) return;
    const { token } = (await res.json()) as RealtimeToken;
    sock.send(JSON.stringify({ id: 2, refresh: { token } }));
  }, Math.max(5, ttl - 60) * 1000);
}

/** Poll interval for a caller that also listens to hints: slow while the socket is up, `fast` otherwise. */
export const pollDelay = (fast: number) => (live ? 30_000 : fast);

async function open() {
  if (ws || opening || !listeners.size) return;
  opening = true;
  const res = await fetchToken();
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
        if (msg.connect.expires) refreshIn(sock, msg.connect.ttl);
      } else if (msg.id === 2 && msg.refresh?.expires) {
        refreshIn(sock, msg.refresh.ttl);
      } else if (msg.push?.pub?.data) {
        for (const l of listeners) l(msg.push.pub.data as RealtimeHint);
      } else if (!Object.keys(msg).length && pong) {
        sock.send('{}');
      }
    }
  };
  sock.onclose = () => {
    if (ws === sock) ws = null;
    clearTimeout(refresher);
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
