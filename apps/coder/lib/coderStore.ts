'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SEED_CODER,
  INITIAL_DEMO_ORDER,
  eventBus,
  pollDelay,
  toViewOrder,
  type ChatMessage,
  type CoderProfile,
  type Milestone,
  type Order,
  type WaveOffer,
} from '@grabcode/contracts';
import { onRealtimeHint } from '@grabcode/contracts';
import { payoutOf } from '@grabcode/contracts/schemas';
import type { ChatList, DispatchOffer, JobList, OfferList, OrderDto, OrderList, OrderStatus, Presence, Wallet } from '@grabcode/contracts/schemas';
import { API_URL, useAuth } from '@grabcode/auth-ui';

const STORAGE_KEY = 'grabcode_coder_state';
const DEFAULT_OFFER_SECONDS = 30;

export interface HistoryItem {
  orderId: string;
  title: string;
  payoutVnd: number;
  at: string;
}

export interface PendingOffer {
  order: Order;
  offer: WaveOffer;
  expiresAt: number; // epoch ms
}

export interface CoderState {
  isOnline: boolean;
  walletVnd: number;
  todayEarningsVnd: number;
  todayKey: string;
  activeOrder: Order | null;
  activePayoutVnd: number;
  completedMilestones: string[];
  delivered: boolean;
  completed: boolean;
  history: HistoryItem[];
  seenOrderIds: string[];
  chat: ChatMessage[];
}

export interface ToastMsg {
  id: number;
  tone: 'ok' | 'warn' | 'info';
  text: string;
}

// ---- API mode (NEXT_PUBLIC_API_URL set): core-api orders are the source of truth ----

const POLL_MS = 3000;

async function api<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
  });
  if (!res.ok) throw Object.assign(new Error(`core-api ${res.status}`), { status: res.status });
  return res.status === 204 ? (undefined as T) : res.json();
}
const orderPath = (id: string) => `/v1/orders/${encodeURIComponent(id)}`;
/** Job board: paid orders nobody took yet (API mode only). */
export const listJobs = async () => (await api<JobList>('/v1/jobs')).jobs;

/** What the coder hands in with a milestone: a link (demo / repo / Drive file), a commit, and/or a note. */
export interface HandIn {
  deliveryUrl?: string;
  commitHash?: string;
  note?: string;
}
const transition = (id: string, status: OrderStatus) => api<OrderDto>(`${orderPath(id)}/transitions`, { status });

/** Server wave offer -> the modal's card. */
const pendingOf = ({ id, order: o, expiresAt, createdAt, secondsLeft }: DispatchOffer): PendingOffer => {
  const view = toViewOrder(o);
  const seconds = Math.round((Date.parse(expiresAt) - Date.parse(createdAt)) / 1000);
  // Countdown from the server's secondsLeft, not the client clock (skew-proof).
  return { order: view, offer: waveOf(id, o, view, seconds, createdAt), expiresAt: Date.now() + secondsLeft * 1000 };
};
const waveOf = (id: string, o: OrderDto, view: Order, expiresInSeconds: number, createdAt: string): WaveOffer => ({
  id,
  orderId: o.id,
  title: o.title,
  tier: o.tier,
  customerName: o.customer.name,
  netPayoutVnd: o.payoutVnd,
  deadlineHours: o.etaHours,
  summary: o.brief.scopeSummary,
  expiresInSeconds,
  createdAt,
  templateName: view.templateName,
});

const todayKey = () => new Date().toISOString().slice(0, 10);

const initialState = (): CoderState => ({
  isOnline: SEED_CODER.isOnline,
  // API mode starts empty until the ledger answers; the seed balance is mock-mode only.
  walletVnd: API_URL ? 0 : SEED_CODER.walletBalanceVnd,
  todayEarningsVnd: 0,
  todayKey: todayKey(),
  activeOrder: null,
  activePayoutVnd: 0,
  completedMilestones: [],
  delivered: false,
  completed: false,
  history: [],
  seenOrderIds: [],
  chat: [],
});

export const formatVnd = (n: number): string =>
  `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} đ`;

// Only for mock-mode orders saved before briefs had milestones; core-api orders always carry at least one.
const GENERIC_MILESTONES: Milestone[] = [
  { id: 'M1', title: 'Khởi tạo dự án & dữ liệu mẫu', description: 'Dựng khung dự án, schema và seed data.', weightPercent: 20, status: 'PENDING' },
  { id: 'M2', title: 'Hoàn thiện giao diện & tính năng chính', description: 'Làm các màn hình và luồng chính theo brief.', weightPercent: 50, status: 'PENDING' },
  { id: 'M3', title: 'Deploy demo & bàn giao', description: 'Deploy bản demo và gửi link nghiệm thu.', weightPercent: 30, status: 'PENDING' },
];

export const getMilestones = (order: Order): Milestone[] =>
  order.brief.milestones && order.brief.milestones.length > 0 ? order.brief.milestones : GENERIC_MILESTONES;

export const repoUrlOf = (order: Order): string =>
  order.repoUrl || `https://github.com/grabcode-sandbox/gc-${order.id.toLowerCase().replace(/^gc-/, '')}-poc`;

const randomHex7 = () =>
  Array.from({ length: 7 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

const nowIso = () => new Date().toISOString();

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 6)
    .join(' ');
}

export function buildDemoOrder(): { order: Order; offer: WaveOffer } {
  const n = Math.floor(1000 + Math.random() * 9000);
  const id = `GC-${n}`;
  const order: Order = {
    ...INITIAL_DEMO_ORDER,
    id,
    status: 'DISPATCHING',
    assignedCoder: undefined,
    repoUrl: undefined,
    demoUrl: undefined,
    createdAt: nowIso(),
    commits: [],
    brief: {
      ...INITIAL_DEMO_ORDER.brief,
      claudeMdContent: INITIAL_DEMO_ORDER.brief.claudeMdContent.split('GC-9821').join(id),
      milestones: INITIAL_DEMO_ORDER.brief.milestones.map((m) => ({
        ...m,
        status: 'PENDING',
        completedAt: undefined,
        commitHash: undefined,
      })),
    },
  };
  const offer: WaveOffer = {
    id: `offer-${id}`,
    orderId: id,
    title: order.title,
    tier: order.tier,
    customerName: order.customerName,
    netPayoutVnd: payoutOf(order.priceVnd),
    deadlineHours: order.etaHours,
    summary: order.brief.scopeSummary,
    expiresInSeconds: DEFAULT_OFFER_SECONDS,
    createdAt: nowIso(),
    templateName: order.templateName,
  };
  return { order, offer };
}

export function useCoder() {
  const [state, setState] = useState<CoderState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [offer, setOffer] = useState<PendingOffer | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const stateRef = useRef<CoderState>(state);
  const offerRef = useRef<PendingOffer | null>(null);
  const toastId = useRef(0);
  const meId = useAuth().me?.id;

  const commit = useCallback((next: CoderState) => {
    stateRef.current = next;
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const patch = useCallback(
    (p: Partial<CoderState>) => commit({ ...stateRef.current, ...p }),
    [commit]
  );

  const toast = useCallback((text: string, tone: ToastMsg['tone'] = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const setPending = useCallback((o: PendingOffer | null) => {
    offerRef.current = o;
    setOffer(o);
  }, []);

  const profile = useCallback(
    (): CoderProfile => ({
      ...SEED_CODER,
      isOnline: stateRef.current.isOnline,
      walletBalanceVnd: stateRef.current.walletVnd,
    }),
    []
  );

  /** Mirror a server order into the job workspace. Balance comes from the ledger (sync); this only logs history once. */
  const applyDto = useCallback(
    (o: OrderDto) => {
      const s = stateRef.current;
      const same = s.activeOrder?.id === o.id;
      const completed = o.status === 'ACCEPTED';
      const paid = completed && same && !s.completed;
      commit({
        ...s,
        activeOrder: toViewOrder(o),
        activePayoutVnd: o.payoutVnd,
        completedMilestones: o.brief.milestones.filter((m) => m.status === 'COMPLETED').map((m) => m.id),
        delivered: o.status === 'DELIVERED' || completed || o.status === 'DISPUTED',
        completed,
        chat: same ? s.chat : [],
        ...(paid && {
          history: [{ orderId: o.id, title: o.title, payoutVnd: o.payoutVnd, at: nowIso() }, ...s.history].slice(0, 20),
        }),
      });
      if (paid) toast(`Tiền đã vào ví +${formatVnd(o.payoutVnd)}`, 'ok');
    },
    [commit, toast]
  );

  /** Appends server chat messages for the active order (dedupe by id). */
  const mergeChat = useCallback(
    (msgs: ChatMessage[]) => {
      const s = stateRef.current;
      const fresh = msgs.filter((m) => m.orderId === s.activeOrder?.id && !s.chat.some((c) => c.id === m.id));
      if (fresh.length) patch({ chat: [...s.chat, ...fresh].slice(-100) });
    },
    [patch]
  );
  const loadChat = useCallback(async () => {
    const id = stateRef.current.activeOrder?.id;
    if (id) mergeChat((await api<ChatList>(`/v1/orders/${encodeURIComponent(id)}/messages`)).messages);
  }, [mergeChat]);

  const sync = useCallback(async () => {
    const [{ orders: mine }, wallet] = await Promise.all([api<OrderList>('/v1/orders?scope=mine'), api<Wallet>('/v1/me/wallet')]);
    const today = todayKey();
    patch({
      walletVnd: wallet.balanceVnd,
      todayEarningsVnd: wallet.entries.filter((e) => e.createdAt.startsWith(today)).reduce((sum, e) => sum + e.amountVnd, 0),
    });
    const s = stateRef.current;
    const assigned = mine.filter((o) => o.coder?.id === meId);
    const job =
      assigned.find((o) => o.id === s.activeOrder?.id) ?? assigned.find((o) => o.status === 'IN_PROGRESS' || o.status === 'DELIVERED');
    if (job) return applyDto(job), loadChat();
    if (s.activeOrder) patch({ activeOrder: null, completedMilestones: [], delivered: false, completed: false, chat: [], activePayoutVnd: 0 });
    if (!s.isOnline) return;
    // The offers poll is also the presence heartbeat (TTL 60s), so it keeps running, slower while the socket is live.
    const { offers } = await api<OfferList>('/v1/me/offers');
    const shown = offerRef.current;
    if (shown && !offers.some((o) => o.id === shown.offer.id)) {
      setPending(null);
      if (shown.expiresAt > Date.now()) toast(`Đơn ${shown.order.id} đã có Coder khác nhận.`, 'info');
    }
    const next = offers.map(pendingOf).find((p) => p.expiresAt > Date.now());
    if (!offerRef.current && next) setPending(next);
  }, [meId, applyDto, loadChat, patch, setPending, toast]);

  useEffect(() => {
    if (!hydrated || !API_URL || !meId) return;
    let stop = false;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => void sync().catch(console.warn).finally(() => !stop && (t = setTimeout(tick, pollDelay(POLL_MS))));
    api<Presence>('/v1/me/presence').then((p) => patch({ isOnline: p.online }), console.warn);
    tick();
    // Hint = something changed for this coder (offer, order, repo, chat): refetch now instead of waiting for the poll.
    const off = onRealtimeHint(API_URL, (h) => void (h.type === 'chat' ? loadChat() : sync()).catch(console.warn));
    return () => {
      stop = true;
      clearTimeout(t);
      off();
    };
  }, [hydrated, meId, sync, loadChat, patch]);

  const apiFail = useCallback((e: unknown) => (console.warn(e), toast('Thao tác chưa thành công, thử lại sau.', 'warn')), [toast]);

  // Rehydrate (client only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = { ...initialState(), ...(JSON.parse(raw) as Partial<CoderState>) };
        if (saved.todayKey !== todayKey()) {
          saved.todayKey = todayKey();
          saved.todayEarningsVnd = 0;
        }
        stateRef.current = saved;
        setState(saved);
      }
    } catch {
      /* corrupted state: start fresh */
    }
    setHydrated(true);
  }, []);

  // Event subscriptions
  useEffect(() => {
    if (!hydrated) return;
    const unsubs = [
      eventBus.subscribeTo('ORDER_DISPATCHED', (e) => {
        const { order, offer: wave } = e.payload;
        const s = stateRef.current;
        if (s.seenOrderIds.includes(order.id) || offerRef.current?.order.id === order.id) return; // duplicate
        if (!s.isOnline) {
          toast(`Bạn đang Offline — bỏ lỡ cuốc ${order.id}. Bật Online để nhận đơn.`, 'warn');
          return;
        }
        if ((s.activeOrder && !s.completed) || offerRef.current) {
          toast(`Đang có cuốc đơn — bỏ qua ${order.id}.`, 'info');
          return;
        }
        setPending({
          order,
          offer: wave,
          expiresAt: Date.now() + (wave.expiresInSeconds || DEFAULT_OFFER_SECONDS) * 1000,
        });
      }),
      eventBus.subscribeTo('ORDER_COMPLETED', (e) => {
        const s = stateRef.current;
        if (!s.activeOrder || s.activeOrder.id !== e.payload.orderId || s.completed) return;
        const payout = e.payload.payoutVnd;
        commit({
          ...s,
          completed: true,
          delivered: true,
          walletVnd: s.walletVnd + payout,
          todayEarningsVnd: s.todayEarningsVnd + payout,
          history: [
            { orderId: s.activeOrder.id, title: s.activeOrder.title, payoutVnd: payout, at: nowIso() },
            ...s.history,
          ].slice(0, 20),
        });
        toast(`Tiền đã vào ví +${formatVnd(payout)}`, 'ok');
      }),
      eventBus.subscribeTo('CHAT_MESSAGE_SENT', (e) => {
        const s = stateRef.current;
        const m = e.payload;
        if (!s.activeOrder || m.orderId !== s.activeOrder.id) return;
        if (s.chat.some((c) => c.id === m.id)) return;
        patch({ chat: [...s.chat, m].slice(-100) });
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [hydrated, commit, patch, toast, setPending]);

  // Actions
  const setOnline = useCallback(
    (isOnline: boolean) => {
      patch({ isOnline });
      if (API_URL) api<Presence>('/v1/me/presence', { online: isOnline }, 'PUT').catch((e) => (console.warn(e), toast('Chưa lưu được trạng thái Online.', 'warn')));
      eventBus.publish({
        type: 'CODER_STATUS_CHANGED',
        payload: { coderId: SEED_CODER.id, isOnline },
        timestamp: nowIso(),
      });
      if (!isOnline) setPending(null);
    },
    [patch, setPending, toast]
  );

  const acceptOffer = useCallback(() => {
    const o = offerRef.current;
    if (!o) return;
    const s = stateRef.current;
    const ms = getMilestones(o.order);
    setPending(null);
    if (API_URL) {
      // 409 when another coder accepted first or the offer expired.
      api<OrderDto>(`/v1/offers/${encodeURIComponent(o.offer.id)}/accept`, {}).then(applyDto, () =>
        toast(`Đơn ${o.order.id} đã có Coder khác nhận hoặc hết hạn.`, 'warn')
      );
      return;
    }
    commit({
      ...s,
      activeOrder: { ...o.order, status: 'ACCEPTED', assignedCoder: profile() },
      activePayoutVnd: o.offer.netPayoutVnd,
      completedMilestones: [],
      delivered: false,
      completed: false,
      seenOrderIds: [...s.seenOrderIds, o.order.id],
      chat: [],
    });
    eventBus.publish({
      type: 'ORDER_ACCEPTED',
      payload: { orderId: o.order.id, coder: profile() },
      timestamp: nowIso(),
    });
    eventBus.publish({
      type: 'MILESTONE_UPDATED',
      payload: { orderId: o.order.id, milestoneId: ms[0].id, status: 'IN_PROGRESS' },
      timestamp: nowIso(),
    });
  }, [commit, profile, setPending, applyDto, toast]);

  const rejectOffer = useCallback(
    (reason: 'DECLINED' | 'TIMEOUT') => {
      const o = offerRef.current;
      if (!o) return;
      const s = stateRef.current;
      setPending(null);
      if (API_URL) {
        // TIMEOUT needs no call: the server expires the offer and sends the next wave.
        if (reason === 'DECLINED') api(`/v1/offers/${encodeURIComponent(o.offer.id)}/decline`, {}).catch(console.warn);
        return;
      }
      patch({ seenOrderIds: [...s.seenOrderIds, o.order.id] });
      eventBus.publish({
        type: 'ORDER_REJECTED',
        payload: { orderId: o.order.id, reason },
        timestamp: nowIso(),
      });
    },
    [patch, setPending]
  );

  /** Takes a job from the board; 409 when someone was faster or the coder already has an order in progress. */
  const claimJob = useCallback(
    (orderId: string) =>
      api<OrderDto>(`/v1/jobs/${encodeURIComponent(orderId)}/claim`, {}).then(applyDto, (e: { status?: number }) => {
        toast(e.status === 409 ? `Đơn ${orderId} đã có người nhận, hoặc bạn đang có đơn chưa xong.` : 'Nhận đơn chưa thành công, thử lại sau.', 'warn');
        throw e;
      }),
    [applyDto, toast]
  );

  /** API mode: submit for customer review with the hand-in; mock mode: completes at once. */
  const completeMilestone = useCallback(
    (milestoneId: string, handIn: HandIn = {}) => {
      const s = stateRef.current;
      const order = s.activeOrder;
      if (!order || s.delivered) return;
      const ms = getMilestones(order);
      const idx = ms.findIndex((m) => m.id === milestoneId);
      const expected = ms.findIndex((m) => !s.completedMilestones.includes(m.id));
      if (idx < 0 || idx !== expected) return; // enforce order
      const m = ms[idx];
      if (API_URL) {
        const body = Object.fromEntries(Object.entries(handIn).filter(([, v]) => v));
        api<OrderDto>(`${orderPath(order.id)}/milestones/${encodeURIComponent(m.id)}/submit`, body).then(applyDto, apiFail);
        return;
      }
      patch({ completedMilestones: [...s.completedMilestones, m.id] });
      eventBus.publish({
        type: 'MILESTONE_UPDATED',
        payload: {
          orderId: order.id,
          milestoneId: m.id,
          status: 'COMPLETED',
          commitHash: randomHex7(),
          commitMessage: `feat(${m.id.toLowerCase()}): ${slug(m.title) || 'complete milestone'}`,
        },
        timestamp: nowIso(),
      });
      const next = ms[idx + 1];
      if (next) {
        eventBus.publish({
          type: 'MILESTONE_UPDATED',
          payload: { orderId: order.id, milestoneId: next.id, status: 'IN_PROGRESS' },
          timestamp: nowIso(),
        });
      }
    },
    [patch, applyDto, apiFail]
  );

  const deliver = useCallback(() => {
    const s = stateRef.current;
    const order = s.activeOrder;
    if (!order || s.delivered) return;
    const ms = getMilestones(order);
    if (!ms.every((m) => s.completedMilestones.includes(m.id))) return;
    if (API_URL) {
      transition(order.id, 'DELIVERED').then(applyDto, apiFail);
      return;
    }
    patch({ delivered: true });
    eventBus.publish({
      type: 'ORDER_DELIVERED',
      payload: {
        orderId: order.id,
        demoUrl: `https://grabcode-${order.id.toLowerCase()}.vercel.app`,
        repoUrl: repoUrlOf(order),
      },
      timestamp: nowIso(),
    });
  }, [patch, applyDto, apiFail]);

  const sendChat = useCallback((text: string) => {
    const order = stateRef.current.activeOrder;
    const clean = text.trim();
    if (!order || !clean) return;
    if (API_URL) {
      api<ChatMessage>(`/v1/orders/${encodeURIComponent(order.id)}/messages`, { text: clean }).then((m) => mergeChat([m]), apiFail);
      return;
    }
    eventBus.publish({
      type: 'CHAT_MESSAGE_SENT',
      payload: {
        id: `msg-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
        orderId: order.id,
        sender: 'CODER',
        senderName: SEED_CODER.name,
        text: clean,
        timestamp: nowIso(),
      },
      timestamp: nowIso(),
    });
  }, [mergeChat, apiFail]);

  const dismissJob = useCallback(() => {
    patch({ activeOrder: null, completedMilestones: [], delivered: false, completed: false, chat: [], activePayoutVnd: 0 });
  }, [patch]);

  const simulateDispatch = useCallback(() => {
    const { order, offer: wave } = buildDemoOrder();
    eventBus.publish({
      type: 'ORDER_DISPATCHED',
      payload: { order, offer: wave },
      timestamp: nowIso(),
    });
  }, []);

  return {
    state,
    hydrated,
    offer,
    toasts,
    toast,
    setOnline,
    acceptOffer,
    rejectOffer,
    completeMilestone,
    claimJob,
    deliver,
    sendChat,
    dismissJob,
    simulateDispatch,
  };
}
