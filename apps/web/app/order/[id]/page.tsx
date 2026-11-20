'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { payoutOf } from '@grabcode/contracts/schemas';
import { INITIAL_DEMO_ORDER, eventBus, pollDelay, toViewOrder, type ChatMessage, type Order } from '@grabcode/contracts';
import GitTerminalLog from '../../../components/GitTerminalLog';
import ConfirmSheet from '../../../components/ConfirmSheet';
import DeliveryLinks from '../../../components/DeliveryLinks';
import LiveStepper from '../../../components/LiveStepper';
import MilestoneList from '../../../components/MilestoneList';
import Navbar from '../../../components/Navbar';
import OrderChatBox from '../../../components/OrderChatBox';
import PaymentPanel from '../../../components/PaymentPanel';
import RefundAccountCard from '../../../components/RefundAccountCard';
import SandboxFrame from '../../../components/SandboxFrame';
import StatusChip from '../../../components/StatusChip';
import StickyActionBar from '../../../components/StickyActionBar';
import SupportContact from '../../../components/SupportContact';
import { getMessages, getOrder, getOrderRepo, handoverRepo, onHint, ordersApiEnabled, sendMessage, reviewMilestone, transitionOrder } from '../../../lib/api';
import { useCurrency } from '../../../lib/currency';
import { milestoneAmount, statusInput, statusView } from '../../../lib/orderStatus';
import { ORDERS_KEY, loadChat, loadOrder, saveChat, saveOrder } from '../../../lib/orderStore';
import { progressPercent } from '../../../lib/orderView';
import { formatVnd, getTier } from '../../../lib/pricing';
import { hasSupport } from '../../../lib/support';

const POLL_MS = 3000;
const LONG_WAIT_MS = 30 * 60_000;

/** Paid order still without a coder 30 min after funding (admin sees it too); core-api auto-refunds after AUTO_REFUND_HOURS. */
function LongWaitNote({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (now - new Date(since).getTime() < LONG_WAIT_MS) return null;
  return (
    <p className="mt-2 text-sm font-semibold text-amber-700">
      Đã hơn 30 phút chưa có freelancer nhận. Vận hành đã được báo; không ai nhận trong 24 giờ thì đơn tự huỷ và GrabCode hoàn tiền.
    </p>
  );
}
const fetchView = async (id: string) => {
  const [o, repo] = await Promise.all([getOrder(id), getOrderRepo(id)]);
  return toViewOrder(o, repo);
};
/** System chat line when the server moves the order (API mode). */
const STATUS_MSG: Partial<Record<Order['status'], (o: Order) => string>> = {
  DISPATCHING: (o) => `Đã nhận đủ ${formatVnd(o.priceVnd)}. Đơn đã lên bảng việc, đang chờ freelancer nhận.`,
  BUILDING: (o) => `Freelancer ${o.assignedCoder?.name ?? ''} đang làm đơn của bạn.`,
  DELIVERED: () => 'Freelancer đã bàn giao. Hãy kiểm tra rồi nghiệm thu.',
};

/** Confirmation sheets (UX spec "Màn C"): every money action and every free-text request goes through one. */
type Sheet =
  | { kind: 'approve' | 'reject'; milestoneId: string }
  | { kind: 'accept' | 'revise' | 'dispute' | 'repo' };
const MIN_NOTE = { reject: 10, revise: 10, dispute: 20 } as const;
const REVISION_HINTS = ['Lỗi khi mở trên điện thoại', 'Thiếu tính năng trong đặc tả', 'Link không mở được'];

/** API errors as a short Vietnamese reason for the sheet. */
const reason = (e: unknown) => {
  const status = (e as { status?: number }).status;
  if (status === 409) return 'trạng thái đơn vừa thay đổi, hãy tải lại trang';
  if (status === 403 || status === 404) return 'bạn không có quyền thao tác trên đơn này';
  return status ? `máy chủ báo lỗi ${status}` : 'mất kết nối';
};

const uid = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function systemMsg(orderId: string, text: string): ChatMessage {
  return { id: uid(), orderId, sender: 'SYSTEM', senderName: 'Hệ thống', text, timestamp: new Date().toISOString() };
}

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const { usd } = useCurrency();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [note, setNote] = useState('');
  const [ticked, setTicked] = useState(false);
  const [sending, setSending] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [missing, setMissing] = useState(false);
  const orderRef = useRef<Order | null>(null);
  const chatRef = useRef<ChatMessage[]>([]);

  const applyOrder = useCallback((fn: (o: Order) => Order) => {
    const cur = orderRef.current;
    if (!cur) return;
    const next = fn(cur);
    orderRef.current = next;
    saveOrder(next);
    setOrder(next);
  }, []);

  const pushChat = useCallback((msg: ChatMessage) => {
    if (chatRef.current.some((m) => m.id === msg.id)) return;
    const next = [...chatRef.current, msg];
    chatRef.current = next;
    saveChat(msg.orderId, next);
    setChat(next);
  }, []);

  const showOrder = useCallback((next: Order) => {
    orderRef.current = next;
    setOrder(next);
  }, []);

  // Initial load
  useEffect(() => {
    if (ordersApiEnabled) {
      fetchView(id).then(initChat, () => setMissing(true));
      return;
    }
    initChat(loadOrder(id) ?? INITIAL_DEMO_ORDER);
  }, [id]);

  // API mode: the server is the source of truth. Refetch on a realtime hint; slow poll as safety net (fast if no socket).
  useEffect(() => {
    if (!ordersApiEnabled || !order) return;
    const oid = order.id;
    const refresh = () =>
      fetchView(oid).then((next) => {
        const prev = orderRef.current;
        if (prev && prev.status !== next.status) {
          const msg = STATUS_MSG[next.status]?.(next);
          if (msg) pushChat(systemMsg(next.id, msg));
        }
        showOrder(next);
      }, console.warn);
    const refreshChat = () => getMessages(oid).then((ms) => ms.forEach(pushChat), console.warn);
    refreshChat();
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      t = setTimeout(() => void Promise.all([refresh(), refreshChat()]).finally(tick), pollDelay(POLL_MS));
    };
    tick();
    const off = onHint((h) => {
      if (h.orderId !== oid) return;
      if (h.type === 'chat') void refreshChat();
      else void refresh();
    });
    return () => {
      clearTimeout(t);
      off();
    };
  }, [order?.id, pushChat, showOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  function initChat(found: Order) {
    orderRef.current = found;
    setOrder(found);
    let msgs = loadChat(found.id);
    if (msgs.length === 0) {
      msgs = [
        systemMsg(
          found.id,
          found.escrowStatus === 'UNPAID'
            ? `Đơn ${found.id} đã tạo. Chuyển khoản ${formatVnd(found.priceVnd)} để đưa đơn lên bảng việc.`
            : `Đơn ${found.id} đã nhận ${formatVnd(found.priceVnd)} và đã lên bảng việc.`,
        ),
      ];
      if (found.assignedCoder && !ordersApiEnabled) {
        msgs.push({
          id: uid(),
          orderId: found.id,
          sender: 'CODER',
          senderName: found.assignedCoder.name,
          text: 'Chào bạn, mình đã nhận brief và đang triển khai theo các mốc nhé.',
          timestamp: new Date().toISOString(),
        });
      }
      saveChat(found.id, msgs);
    }
    chatRef.current = msgs;
    setChat(msgs);
  }

  // Real-time subscriptions
  useEffect(() => {
    if (!order) return;
    const oid = order.id;
    const unsubs = [
      eventBus.subscribeTo('ORDER_ACCEPTED', (e) => {
        if (e.payload.orderId !== oid) return;
        const coder = e.payload.coder;
        applyOrder((o) => (o.status === 'DISPATCHING' || o.status === 'DRAFT' ? { ...o, status: 'ACCEPTED', assignedCoder: coder } : { ...o, assignedCoder: coder }));
        pushChat(systemMsg(oid, `Freelancer ${coder.name} đã nhận đơn của bạn.`));
      }),
      eventBus.subscribeTo('MILESTONE_UPDATED', (e) => {
        const p = e.payload;
        if (p.orderId !== oid) return;
        applyOrder((o) => {
          const milestones = o.brief.milestones.map((m) =>
            m.id === p.milestoneId
              ? {
                  ...m,
                  status: p.status,
                  commitHash: p.commitHash ?? m.commitHash,
                  completedAt: p.status === 'COMPLETED' ? new Date().toISOString() : m.completedAt,
                }
              : m
          );
          const commits = [...(o.commits ?? [])];
          if (p.commitHash && !commits.some((c) => c.hash === p.commitHash)) {
            commits.push({
              hash: p.commitHash,
              message: p.commitMessage ?? `update ${p.milestoneId}`,
              timestamp: new Date().toISOString(),
              milestoneId: p.milestoneId,
              author: `${o.assignedCoder?.name ?? 'Coder'} (Coder)`,
            });
          }
          const allDone = milestones.every((m) => m.status === 'COMPLETED');
          const status = o.status === 'DELIVERED' || o.status === 'COMPLETED' ? o.status : allDone ? 'QA_TESTING' : 'BUILDING';
          return { ...o, brief: { ...o.brief, milestones }, commits, status };
        });
        if (p.status === 'COMPLETED') pushChat(systemMsg(oid, `Mốc ${p.milestoneId} đã hoàn thành.`));
      }),
      eventBus.subscribeTo('ORDER_DELIVERED', (e) => {
        const p = e.payload;
        if (p.orderId !== oid) return;
        applyOrder((o) => ({
          ...o,
          demoUrl: p.demoUrl,
          repoUrl: p.repoUrl,
          status: 'DELIVERED',
          brief: { ...o.brief, milestones: o.brief.milestones.map((m) => ({ ...m, status: 'COMPLETED' as const })) },
        }));
        pushChat(systemMsg(oid, 'Freelancer đã bàn giao. Hãy kiểm tra rồi nghiệm thu.'));
      }),
      eventBus.subscribeTo('CHAT_MESSAGE_SENT', (e) => {
        if (e.payload.orderId === oid) pushChat(e.payload);
      }),
      eventBus.subscribeTo('ORDER_REJECTED', (e) => {
        if (e.payload.orderId === oid) pushChat(systemMsg(oid, 'Một freelancer đã từ chối, đơn vẫn trên bảng việc.'));
      }),
    ];
    // Keep in sync when another tab writes to the orders store.
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== ORDERS_KEY) return;
      const fresh = loadOrder(oid);
      if (fresh) {
        orderRef.current = fresh;
        setOrder(fresh);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      unsubs.forEach((u) => u());
      window.removeEventListener('storage', onStorage);
    };
  }, [order?.id, applyOrder, pushChat]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!order) {
    return (
      <>
        <Navbar />
        <p className="p-10 text-center text-slate-500">{missing ? 'Không tìm thấy đơn này hoặc bạn không có quyền xem.' : 'Đang tải đơn hàng...'}</p>
      </>
    );
  }

  const input = statusInput(order);
  const sv = statusView(input);
  const { heldVnd } = input.money;
  const payout = order.payoutVnd ?? payoutOf(order.priceVnd);
  const percent = progressPercent(order);
  const delivered = input.status === 'DELIVERED' || input.status === 'ACCEPTED';
  const amountOf = (milestoneId: string) => milestoneAmount(order, milestoneId);
  /** What accepting the whole order pays now: the shares of milestones not approved yet (same as the server sweep). */
  const acceptVnd = order.brief.milestones.reduce((s, m) => s + (m.status === 'COMPLETED' ? 0 : amountOf(m.id)), 0);
  const toReview = sv.canReview ? order.brief.milestones.find((m) => m.status === 'SUBMITTED') : undefined;

  const openSheet = (next: Sheet) => {
    setSheet(next);
    setNote('');
    setTicked(false);
    setSheetError(null);
  };
  /** Runs the sheet action; on failure the sheet stays open with the error and what the user typed. */
  const run = async (fn: () => Promise<void>) => {
    setSending(true);
    setSheetError(null);
    try {
      await fn();
      setSheet(null);
    } catch (e) {
      console.error(e);
      setSheetError(reason(e));
    } finally {
      setSending(false);
    }
  };
  const refreshView = async () => showOrder(await fetchView(order.id));

  const sendChat = (text: string) => {
    if (ordersApiEnabled) {
      sendMessage(order.id, text).then(pushChat, () => pushChat(systemMsg(order.id, 'Gửi tin nhắn chưa thành công, vui lòng thử lại.')));
      return;
    }
    const msg: ChatMessage = {
      id: uid(),
      orderId: order.id,
      sender: 'CUSTOMER',
      senderName: order.customerName,
      text,
      timestamp: new Date().toISOString(),
    };
    eventBus.publish({ type: 'CHAT_MESSAGE_SENT', payload: msg, timestamp: msg.timestamp });
    pushChat(msg); // no-op if the local listener already added it
  };

  // The customer's chat never shows the coder's payout (it would reveal the platform split).
  const accept = () =>
    run(async () => {
      if (ordersApiEnabled) {
        await transitionOrder(order.id, 'ACCEPTED');
        await refreshView();
      } else {
        applyOrder((o) => ({ ...o, status: 'COMPLETED', escrowStatus: 'RELEASED', completedAt: new Date().toISOString() }));
        eventBus.publish({ type: 'ORDER_COMPLETED', payload: { orderId: order.id, payoutVnd: payout }, timestamp: new Date().toISOString() });
      }
      pushChat(systemMsg(order.id, 'Đã nghiệm thu đơn. Cảm ơn bạn!'));
    });

  // Order-level revision (DELIVERED -> IN_PROGRESS): the note goes to the coder as a real chat message first.
  const requestRevision = () =>
    run(async () => {
      const text = `Yêu cầu sửa: ${note.trim()}`;
      if (ordersApiEnabled) {
        pushChat(await sendMessage(order.id, text));
        showOrder(toViewOrder(await transitionOrder(order.id, 'IN_PROGRESS'), await getOrderRepo(order.id)));
      } else {
        sendChat(text);
      }
    });

  const review = (milestoneId: string, approve: boolean) =>
    run(async () => {
      showOrder(toViewOrder(await reviewMilestone(order.id, milestoneId, approve, approve ? undefined : note.trim()), await getOrderRepo(order.id)));
      pushChat(systemMsg(order.id, approve ? `Đã duyệt mốc ${milestoneId}.` : `Đã yêu cầu freelancer sửa mốc ${milestoneId}: ${note.trim()}`));
    });

  // Freezes the escrow still held; ops resolve it from admin (S6).
  const dispute = () =>
    run(async () => {
      showOrder(toViewOrder(await transitionOrder(order.id, 'DISPUTED', note.trim()), await getOrderRepo(order.id)));
      pushChat(systemMsg(order.id, `Đã mở tranh chấp: ${note.trim()}`));
    });

  const claimRepo = () =>
    run(async () => {
      const login = note.trim().replace(/^@/, '');
      await handoverRepo(order.id, login);
      await refreshView();
      pushChat(systemMsg(order.id, `Đang chuyển quyền admin repo cho GitHub ${login}. Kiểm tra lời mời trong email GitHub.`));
    });

  const sheetMilestone = sheet && 'milestoneId' in sheet ? order.brief.milestones.find((m) => m.id === sheet.milestoneId) : undefined;
  const minNote = sheet && sheet.kind in MIN_NOTE ? MIN_NOTE[sheet.kind as keyof typeof MIN_NOTE] : 0;
  const noteField = (label: string, hints?: string[]) => (
    <label className="block">
      <span className="font-semibold text-ink">{label}</span>
      {hints && (
        <span className="mt-2 flex flex-wrap gap-2">
          {hints.map((h) => (
            <button key={h} type="button" className="chip min-h-[32px] bg-slate-100 text-slate-700" onClick={() => setNote(note ? `${note.trim()}. ${h}` : h)}>
              {h}
            </button>
          ))}
        </span>
      )}
      <textarea
        className="mt-2 w-full p-3 !text-base"
        rows={4}
        maxLength={2000}
        value={note}
        disabled={sending}
        onChange={(e) => setNote(e.target.value)}
      />
      <span className="block text-right text-xs text-slate-500">
        {note.trim().length < minNote ? `Tối thiểu ${minNote} ký tự · ` : ''}
        {note.length}/2000
      </span>
    </label>
  );
  const tick = (label: string) => (
    <label className="flex min-h-[44px] items-center gap-3 rounded-md border border-slate-200 p-3 font-semibold text-ink">
      <input type="checkbox" className="h-5 w-5" checked={ticked} disabled={sending} onChange={(e) => setTicked(e.target.checked)} />
      {label}
    </label>
  );
  const sheetProps = { open: true, busy: sending, error: sheetError, onClose: () => setSheet(null) };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip-dark">{order.id}</span>
              <StatusChip tone={sv.tone} label={sv.label} />
              <span className="chip bg-slate-100 text-slate-700">Gói {getTier(order.tier).label}</span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold text-ink md:text-3xl">{order.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{sv.description}</p>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Giá đơn</dt>
              <dd className="font-display font-extrabold text-emerald-dark">
                {formatVnd(order.priceVnd)}
                {usd(order.priceVnd) && <span className="ml-2 text-xs font-normal text-slate-500">{usd(order.priceVnd)}</span>}
              </dd>
            </div>
            <div><dt className="text-slate-500">Tiền của đơn</dt><dd className="font-semibold">{sv.money}</dd></div>
            <div><dt className="text-slate-500">Dự kiến xong</dt><dd className="font-semibold">~{order.etaHours} giờ</dd></div>
          </dl>
        </header>

        <LiveStepper step={sv.step} percent={percent} />

        {input.status === 'DISPUTED' && (
          <div className="card border-red-200 bg-red-50 text-sm text-red-800" role="status">
            <p className="font-display font-bold">Đơn đang tranh chấp. {sv.description}</p>
            {order.disputeReason && <p className="mt-1">Lý do: {order.disputeReason}</p>}
          </div>
        )}

        {ordersApiEnabled && input.status === 'DRAFT' && <PaymentPanel orderId={order.id} />}

        {(input.status === 'FUNDED' || input.status === 'DISPATCHED') && (
          <div className="card flex items-center gap-4 border-emerald/40 bg-emerald-mint/50 shadow-l2" role="status">
            <span className="material-symbols-outlined shrink-0 text-emerald-dark" aria-hidden>radar</span>
            <div>
              <p className="font-display font-bold text-ink">{sv.label}</p>
              <p className="text-sm text-slate-600">{sv.description}</p>
              <LongWaitNote since={order.fundedAt ?? order.createdAt} />
              {hasSupport && (
                <p className="mt-2 text-sm text-slate-700">
                  Huỷ đơn? Liên hệ hỗ trợ: <SupportContact />
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="min-w-0 space-y-6">
            {/* Real orders: a live preview when one is READY, otherwise the freelancer's links (never a generated demo). */}
            {ordersApiEnabled && !order.demoUrl ? <DeliveryLinks order={order} /> : <SandboxFrame order={order} delivered={delivered} />}
            <GitTerminalLog commits={order.commits ?? []} repoUrl={order.repoUrl} />
          </div>
          <div className="min-w-0 space-y-6">
            <div className="card space-y-3 shadow-l3">
              {order.assignedCoder && (
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-mint font-display font-bold text-emerald-dark" aria-hidden>
                    {order.assignedCoder.name.charAt(0)}
                  </span>
                  <div>
                    <p className="font-display text-sm font-bold text-ink">{order.assignedCoder.name}</p>
                    {order.assignedCoder.rating > 0 && (
                      <p className="text-xs text-slate-500">{order.assignedCoder.tier} • {order.assignedCoder.rating} sao • {order.assignedCoder.completedOrders} đơn</p>
                    )}
                  </div>
                </div>
              )}
              <p className="text-sm text-slate-600">{sv.money}</p>
              {(sv.canAccept || (ordersApiEnabled && toReview)) && (
                <StickyActionBar>
                  {sv.canAccept ? (
                    <div className="flex gap-2 lg:flex-col">
                      <button type="button" className="btn-primary flex-1 lg:w-full" onClick={() => openSheet({ kind: 'accept' })}>
                        Nghiệm thu đơn
                      </button>
                      <button type="button" className="btn-secondary flex-1 lg:w-full" onClick={() => openSheet({ kind: 'revise' })}>
                        Yêu cầu sửa
                      </button>
                    </div>
                  ) : (
                    toReview && (
                      <button type="button" className="btn-primary w-full" onClick={() => openSheet({ kind: 'approve', milestoneId: toReview.id })}>
                        Xem & duyệt {toReview.id}
                      </button>
                    )
                  )}
                </StickyActionBar>
              )}
              {ordersApiEnabled && sv.canDispute && (
                <button type="button" className="min-h-[44px] w-full text-center text-sm font-semibold text-red-700 hover:underline" onClick={() => openSheet({ kind: 'dispute' })}>
                  Mở tranh chấp
                </button>
              )}
              {order.repoUrl && delivered && (
                <a href={order.repoUrl} target="_blank" rel="noopener noreferrer" className="block text-center text-sm font-semibold text-emerald-dark hover:underline">
                  Xem repo bàn giao
                </a>
              )}
              {ordersApiEnabled && order.repoHandoverPending && (
                <button type="button" className="min-h-[44px] w-full text-center text-sm font-semibold text-emerald-dark hover:underline" onClick={() => openSheet({ kind: 'repo' })}>
                  Nhận repo về tài khoản GitHub của bạn
                </button>
              )}
              {hasSupport && (
                <p className="border-t border-slate-100 pt-3 text-sm text-slate-700">
                  Cần hỗ trợ? <SupportContact />
                </p>
              )}
            </div>
            {ordersApiEnabled && sv.askRefundAccount && <RefundAccountCard orderId={order.id} />}
            <MilestoneList
              milestones={order.brief.milestones}
              onReview={ordersApiEnabled && sv.canReview ? (id, approve) => openSheet({ kind: approve ? 'approve' : 'reject', milestoneId: id }) : undefined}
              amountOf={amountOf}
            />
            <OrderChatBox messages={chat} onSend={sendChat} coderName={order.assignedCoder?.name} />
          </div>
        </div>
      </main>

      {sheet?.kind === 'approve' && sheetMilestone && (
        <ConfirmSheet
          {...sheetProps}
          title={`Duyệt mốc ${sheetMilestone.id} · ${sheetMilestone.title}`}
          confirmLabel={`Duyệt & trả ${formatVnd(amountOf(sheetMilestone.id))}`}
          canConfirm={ticked && sheetMilestone.qa?.status !== 'FAILED'}
          onConfirm={() => review(sheetMilestone.id, true)}
        >
          {sheetMilestone.deliveryUrl ? (
            <p>
              Link bàn giao:{' '}
              <a href={sheetMilestone.deliveryUrl} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-semibold text-emerald-dark underline">
                {sheetMilestone.deliveryUrl}
              </a>
            </p>
          ) : (
            <p>Freelancer chưa gửi link bàn giao cho mốc này.</p>
          )}
          {sheetMilestone.note && <p>Ghi chú của freelancer: “{sheetMilestone.note}”</p>}
          {sheetMilestone.qa && <p>Kiểm tra tự động: {sheetMilestone.qa.status === 'PASSED' ? 'Đạt ✓' : sheetMilestone.qa.status === 'FAILED' ? 'Không đạt ✗ — hãy yêu cầu sửa' : 'Chưa có kết quả'}</p>}
          <div className="rounded-md bg-amber-50 p-3">
            <p className="flex justify-between gap-3 font-semibold text-ink">
              <span>Bạn sẽ trả cho mốc này</span>
              <span className="font-display tabular-nums">{formatVnd(amountOf(sheetMilestone.id))}</span>
            </p>
            <p className="mt-1 text-amber-900">Sau khi duyệt, khoản này được chuyển cho freelancer và không hoàn lại được.</p>
          </div>
          {tick('Tôi đã mở link và kiểm tra mốc này')}
        </ConfirmSheet>
      )}

      {sheet?.kind === 'reject' && sheetMilestone && (
        <ConfirmSheet
          {...sheetProps}
          title={`Cần freelancer sửa gì ở ${sheetMilestone.id}?`}
          confirmLabel="Gửi yêu cầu sửa"
          canConfirm={note.trim().length >= MIN_NOTE.reject}
          onConfirm={() => review(sheetMilestone.id, false)}
        >
          {noteField('Mô tả cụ thể điều cần sửa', REVISION_HINTS)}
        </ConfirmSheet>
      )}

      {sheet?.kind === 'accept' && (
        <ConfirmSheet
          {...sheetProps}
          title={`Nghiệm thu đơn ${order.id}`}
          cancelLabel="Để sau"
          confirmLabel={acceptVnd > 0 ? `Nghiệm thu & trả ${formatVnd(acceptVnd)}` : 'Nghiệm thu đơn'}
          canConfirm={ticked}
          onConfirm={accept}
        >
          <ul className="space-y-1">
            {order.brief.milestones.map((m) => (
              <li key={m.id}>
                {m.status === 'COMPLETED' ? '✓' : '◻'} {m.id} · {m.title} {m.status === 'COMPLETED' ? '(đã duyệt)' : '(chưa duyệt, sẽ được trả cùng lúc)'}
              </li>
            ))}
          </ul>
          <div className="rounded-md bg-amber-50 p-3">
            <p className="flex justify-between gap-3 font-semibold text-ink">
              <span>Số tiền sẽ trả freelancer ngay</span>
              <span className="font-display tabular-nums">{formatVnd(acceptVnd)}</span>
            </p>
            <p className="mt-1 text-amber-900">Sau khi nghiệm thu: đơn hoàn tất, không mở tranh chấp được nữa, tiền đã trả không hoàn lại được.</p>
          </div>
          {tick('Tôi đã kiểm tra bản bàn giao và đồng ý nghiệm thu')}
        </ConfirmSheet>
      )}

      {sheet?.kind === 'revise' && (
        <ConfirmSheet
          {...sheetProps}
          title="Yêu cầu freelancer sửa"
          confirmLabel="Gửi yêu cầu sửa"
          canConfirm={note.trim().length >= MIN_NOTE.revise}
          onConfirm={requestRevision}
        >
          {noteField('Cần freelancer sửa gì?', REVISION_HINTS)}
          <p className="text-slate-600">Nội dung này được gửi vào chat của đơn và đơn quay lại trạng thái đang làm.</p>
        </ConfirmSheet>
      )}

      {sheet?.kind === 'dispute' && (
        <ConfirmSheet
          {...sheetProps}
          title="Mở tranh chấp"
          danger
          confirmLabel="Mở tranh chấp"
          canConfirm={note.trim().length >= MIN_NOTE.dispute}
          onConfirm={dispute}
        >
          {noteField('Lý do mở tranh chấp')}
          <p className="rounded-md bg-red-50 p-3 text-red-800">
            {heldVnd > 0
              ? `Tiền còn giữ (${formatVnd(heldVnd)}) sẽ bị tạm khoá cho tới khi GrabCode xử lý.`
              : 'Hiện không còn tiền giữ (0 đ): các mốc đã duyệt đã được trả cho freelancer. GrabCode vẫn xem xét tranh chấp.'}
          </p>
        </ConfirmSheet>
      )}

      {sheet?.kind === 'repo' && (
        <ConfirmSheet {...sheetProps} title="Nhận repo về GitHub" confirmLabel="Nhận repo" canConfirm={note.trim().replace(/^@/, '').length > 0} onConfirm={claimRepo}>
          <label className="block">
            <span className="font-semibold text-ink">Tên GitHub (username)</span>
            <input
              className="mt-2 w-full px-3 py-2 !text-base"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={note}
              disabled={sending}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <p className="text-slate-600">Bạn sẽ nhận lời mời qua email GitHub.</p>
        </ConfirmSheet>
      )}
    </>
  );
}
