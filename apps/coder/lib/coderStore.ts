'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SEED_CODER,
  INITIAL_DEMO_ORDER,
  eventBus,
  toViewOrder,
  type ChatMessage,
  type CoderProfile,
  type Milestone,
  type Order,
  type WaveOffer,
} from '@grabcode/contracts';
import type { OrderDto, OrderList, OrderStatus } from '@grabcode/contracts/schemas';
import { API_URL, useAuth } from './auth';

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

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
  });
  if (!res.ok) throw new Error(`core-api ${res.status}`);
  return res.json();
}
const orderPath = (id: string) => `/v1/orders/${encodeURIComponent(id)}`;
const transition = (id: string, status: OrderStatus) => api<OrderDto>(`${orderPath(id)}/transitions`, { status });

const offerOf = (o: OrderDto, view: Order): WaveOffer => ({
  id: `offer-${o.id}`,
  orderId: o.id,
  title: o.title,
  tier: o.tier,
  customerName: o.customer.name,
  netPayoutVnd: o.payoutVnd,
  deadlineHours: o.etaHours,
  summary: o.brief.scopeSummary,
  expiresInSeconds: DEFAULT_OFFER_SECONDS,
  createdAt: o.updatedAt,
  templateName: view.templateName,
});

const todayKey = () => new Date().toISOString().slice(0, 10);

const initialState = (): CoderState => ({
  isOnline: SEED_CODER.isOnline,
  walletVnd: SEED_CODER.walletBalanceVnd,
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
    netPayoutVnd: Math.round(order.priceVnd * 0.8),
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

  /** Mirror a server order into the job workspace; credits the (mock) wallet once when it turns ACCEPTED. */
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
          // shortcut: wallet is local until the S2 ledger pays out.
          walletVnd: s.walletVnd + o.payoutVnd,
          todayEarningsVnd: s.todayEarningsVnd + o.payoutVnd,
          history: [{ orderId: o.id, title: o.title, payoutVnd: o.payoutVnd, at: nowIso() }, ...s.history].slice(0, 20),
        }),
      });
      if (paid) toast(`Tiền đã vào ví +${formatVnd(o.payoutVnd)}`, 'ok');
    },
    [commit, toast]
  );

  const sync = useCallback(async () => {
    const s = stateRef.current;
    const { orders: mine } = await api<OrderList>('/v1/orders?scope=mine');
    const assigned = mine.filter((o) => o.coder?.id === meId);
    const job =
      assigned.find((o) => o.id === s.activeOrder?.id) ?? assigned.find((o) => o.status === 'IN_PROGRESS' || o.status === 'DELIVERED');
    if (job) return applyDto(job);
    if (s.activeOrder) patch({ activeOrder: null, completedMilestones: [], delivered: false, completed: false, chat: [], activePayoutVnd: 0 });
    if (!s.isOnline || offerRef.current) return;
    // shortcut: coders poll the open pool until S3 matching pushes wave offers.
    const { orders: open } = await api<OrderList>('/v1/orders?scope=open');
    const next = open.find((o) => o.customer.id !== meId && !stateRef.current.seenOrderIds.includes(o.id));
    if (next && !offerRef.current) {
      const view = toViewOrder(next);
      setPending({ order: view, offer: offerOf(next, view), expiresAt: Date.now() + DEFAULT_OFFER_SECONDS * 1000 });
    }
  }, [meId, applyDto, patch, setPending]);

  useEffect(() => {
    if (!hydrated || !API_URL || !meId) return;
    let stop = false;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => void sync().catch(console.warn).finally(() => !stop && (t = setTimeout(tick, POLL_MS)));
    tick();
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [hydrated, meId, sync]);

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
      eventBus.publish({
        type: 'CODER_STATUS_CHANGED',
        payload: { coderId: SEED_CODER.id, isOnline },
        timestamp: nowIso(),
      });
      if (!isOnline) setPending(null);
    },
    [patch, setPending]
  );

  const acceptOffer = useCallback(() => {
    const o = offerRef.current;
    if (!o) return;
    const s = stateRef.current;
    const ms = getMilestones(o.order);
    setPending(null);
    if (API_URL) {
      patch({ seenOrderIds: [...s.seenOrderIds, o.order.id] });
      // 409 when another coder claimed it first.
      transition(o.order.id, 'IN_PROGRESS').then(applyDto, () => toast(`Đơn ${o.order.id} đã có Coder khác nhận.`, 'warn'));
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
  }, [commit, patch, profile, setPending, applyDto, toast]);

  const rejectOffer = useCallback(
    (reason: 'DECLINED' | 'TIMEOUT') => {
      const o = offerRef.current;
      if (!o) return;
      const s = stateRef.current;
      setPending(null);
      patch({ seenOrderIds: [...s.seenOrderIds, o.order.id] });
      eventBus.publish({
        type: 'ORDER_REJECTED',
        payload: { orderId: o.order.id, reason },
        timestamp: nowIso(),
      });
    },
    [patch, setPending]
  );

  const completeMilestone = useCallback(
    (milestoneId: string) => {
      const s = stateRef.current;
      const order = s.activeOrder;
      if (!order || s.delivered) return;
      const ms = getMilestones(order);
      const idx = ms.findIndex((m) => m.id === milestoneId);
      const expected = ms.findIndex((m) => !s.completedMilestones.includes(m.id));
      if (idx < 0 || idx !== expected) return; // enforce order
      const m = ms[idx];
      if (API_URL) {
        // Commit hashes come from the GitHub push webhook, not from here.
        api<OrderDto>(`${orderPath(order.id)}/milestones/${encodeURIComponent(m.id)}/complete`, {}).then(applyDto, apiFail);
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
  }, []);

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
    deliver,
    sendChat,
    dismissJob,
    simulateDispatch,
  };
}
