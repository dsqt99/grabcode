'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { payoutOf } from '@grabcode/contracts/schemas';
import { INITIAL_DEMO_ORDER, eventBus, pollDelay, toViewOrder, type ChatMessage, type Order } from '@grabcode/contracts';
import GitTerminalLog from '../../../components/GitTerminalLog';
import ConfirmSheet from '../../../components/ConfirmSheet';
import DeliveryLinks from '../../../components/DeliveryLinks';
import LiveStepper from '../../../components/LiveStepper';
import MilestoneList, { SubmittedMilestone } from '../../../components/MilestoneList';
import MoneyLedger from '../../../components/MoneyLedger';
import Navbar from '../../../components/Navbar';
import OrderChatBox from '../../../components/OrderChatBox';
import PaymentPanel from '../../../components/PaymentPanel';
import RefundAccountCard from '../../../components/RefundAccountCard';
import SandboxFrame from '../../../components/SandboxFrame';
import StatusChip, { TONE_BORDER } from '../../../components/StatusChip';
import StickyActionBar from '../../../components/StickyActionBar';
import SupportContact from '../../../components/SupportContact';
import { getMessages, getOrder, getOrderRepo, handoverRepo, onHint, ordersApiEnabled, sendMessage, reviewMilestone, transitionOrder } from '../../../lib/api';
import { milestoneAmount, paysOnApproval, statusInput, statusView } from '../../../lib/orderStatus';
import { ORDERS_KEY, loadChat, loadOrder, saveChat, saveOrder } from '../../../lib/orderStore';
import { progressPercent } from '../../../lib/orderView';
import { etaLabel, formatVnd, menuItemOf } from '../../../lib/pricing';
import { hasSupport } from '../../../lib/support';
import { BRAND } from '@grabcode/contracts';


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
    <p className="banner-warn">
      Đã hơn 30 phút chưa có freelancer nhận. Vận hành đã được báo; không ai nhận trong 24 giờ thì đơn tự huỷ và {BRAND.name} hoàn tiền.
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
        {missing ? (
          <main className="mx-auto max-w-md px-4 py-12">
            <section className="card flex flex-col items-center gap-3 py-10 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-stone-100 text-stone-600" aria-hidden>
                <span className="material-symbols-outlined !text-[40px]">search_off</span>
              </span>
              <h1 className="font-display text-base font-bold text-stone-900">Không tìm thấy đơn này hoặc bạn không có quyền xem.</h1>
              <Link href="/orders" className="btn-primary">Về Đơn của tôi</Link>
            </section>
          </main>
        ) : (
          <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 md:px-8" role="status" aria-busy="true">
            <span className="sr-only">Đang tải đơn hàng…</span>
            <div className="skeleton h-10 w-40" />
            <div className="skeleton h-40" />
            <div className="skeleton h-60" />
            <div className="skeleton h-[120px]" />
            <div className="skeleton h-[120px]" />
          </div>
        )}
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
  /**
   * What accepting the whole order pays now: the shares not released yet, incl. the last milestone (same as the server sweep).
   * Capped by what escrow holds (an order delivered before Q2 already paid its last share; an overpayment is not released).
   */
  const acceptVnd = Math.min(
    heldVnd,
    order.brief.milestones.reduce((s, m) => s + (m.status === 'COMPLETED' && paysOnApproval(order, m.id) ? 0 : amountOf(m.id)), 0),
  );
  const toReview = sv.canReview ? order.brief.milestones.find((m) => m.status === 'SUBMITTED') : undefined;
  const item = menuItemOf(order.menuItem);

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

  // Order-level revision (DELIVERED -> IN_PROGRESS): the server reopens the last milestone with the note (the coder sees it
  // there and hands in again); the same note also goes into the chat.
  const requestRevision = () =>
    run(async () => {
      const text = `Yêu cầu sửa: ${note.trim()}`;
      if (ordersApiEnabled) {
        showOrder(toViewOrder(await transitionOrder(order.id, 'IN_PROGRESS', note.trim()), await getOrderRepo(order.id)));
        await sendMessage(order.id, text).then(pushChat, console.warn);
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
  // A <div>, not a <label>: a label around the hint buttons would name the first button instead of the textarea.
  const noteField = (label: string, hints?: string[]) => (
    <div>
      <label htmlFor="sheet-note" className="label">{label}</label>
      {hints && (
        <span className="-mx-4 mb-2 flex snap-x gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {hints.map((h) => (
            <button key={h} type="button" className="chip-neutral min-h-[44px] shrink-0 snap-start px-3" onClick={() => setNote(note ? `${note.trim()}. ${h}` : h)}>
              {h}
            </button>
          ))}
        </span>
      )}
      <textarea id="sheet-note" className="field" rows={4} maxLength={2000} value={note} disabled={sending} onChange={(e) => setNote(e.target.value)} />
      <span className="mt-1 block text-right text-xs text-stone-600">
        {note.trim().length < minNote ? `Tối thiểu ${minNote} ký tự · ` : ''}
        {note.length}/2000
      </span>
    </div>
  );
  const tick = (label: string) => (
    <label className="check-row font-semibold text-stone-900">
      <input type="checkbox" className="check" checked={ticked} disabled={sending} onChange={(e) => setTicked(e.target.checked)} />
      {label}
    </label>
  );
  /** Money box of a sheet: amber when money leaves escrow now, stone when nothing is paid (redesign-ds §7). */
  const moneyBox = (label: string, amount: number, consequence: string, pays = true) => (
    <div className={`rounded-xl border p-4 ${pays ? 'border-amber-200 bg-amber-50' : 'border-stone-200 bg-stone-50'}`}>
      <p className="flex justify-between gap-3 font-semibold text-stone-900">
        <span>{label}</span>
        <span className="font-display text-xl font-extrabold tabular-nums">{formatVnd(amount)}</span>
      </p>
      <p className={`mt-1 text-sm ${pays ? 'text-amber-900' : 'text-stone-700'}`}>{consequence}</p>
    </div>
  );
  const sheetProps = { open: true, busy: sending, error: sheetError, onClose: () => setSheet(null) };

  const { refundedVnd } = input.money;
  const coderName = order.assignedCoder?.name ?? 'Freelancer';
  const current = order.brief.milestones.find((m) => m.status !== 'COMPLETED');
  const reviewing = ordersApiEnabled ? toReview : undefined;
  // A refund is due now: the account form comes right under the action block, open (redesign-web-order §6).
  const refundDue =
    input.status === 'DISPUTED' ? heldVnd : (input.status === 'CANCELLED' || input.status === 'RESOLVED') && refundedVnd > 0 ? refundedVnd : undefined;
  const askRefund = ordersApiEnabled && sv.askRefundAccount;
  const approveLabel = (id: string) => (paysOnApproval(order, id) ? `Duyệt & trả ${formatVnd(amountOf(id))}` : 'Duyệt mốc cuối');
  const showSandbox = !(ordersApiEnabled && !order.demoUrl);
  const showDeliveryLinks = ordersApiEnabled && !order.demoUrl && !!order.assignedCoder;
  // Real orders: no empty terminal ("chờ commit…") on unpaid, cancelled or link-only orders.
  const showCommits = !ordersApiEnabled || (order.commits?.length ?? 0) > 0;
  const showRepo = !!order.repoUrl && delivered;
  const showClaimRepo = ordersApiEnabled && !!order.repoHandoverPending;

  /** What the customer has to do (or is waiting for), right under the status card (redesign-web-order §3). */
  const action = (() => {
    switch (input.status) {
      case 'DRAFT':
        return ordersApiEnabled ? <PaymentPanel orderId={order.id} /> : null;
      case 'FUNDED':
      case 'DISPATCHED':
        return (
          <section className="card space-y-3" role="status" aria-labelledby="action-title">
            <h2 id="action-title" className="flex items-center gap-2 font-display text-lg font-bold text-stone-900">
              <span className="material-symbols-outlined text-blue-700" aria-hidden>person_search</span>
              {sv.label}
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600 motion-reduce:animate-none" aria-hidden />
            </h2>
            <p className="text-stone-700">{sv.description}</p>
            <LongWaitNote since={order.fundedAt ?? order.createdAt} />
            {hasSupport && (
              <p className="text-sm text-stone-700">
                Muốn huỷ đơn? Liên hệ hỗ trợ: <SupportContact />
              </p>
            )}
          </section>
        );
      case 'IN_PROGRESS':
        return reviewing ? (
          <SubmittedMilestone
            milestone={reviewing}
            onReview={(mid, approve) => openSheet({ kind: approve ? 'approve' : 'reject', milestoneId: mid })}
            amountOf={amountOf}
            paysOnApproval={(mid) => paysOnApproval(order, mid)}
          />
        ) : (
          <section className="card space-y-1" aria-labelledby="action-title">
            <h2 id="action-title" className="flex items-center gap-2 font-display text-lg font-bold text-stone-900">
              <span className="material-symbols-outlined text-brand-700" aria-hidden>code</span>
              {current ? `${coderName} đang làm mốc ${current.id}: ${current.title}` : `${coderName} đang hoàn thiện để bàn giao`}
            </h2>
            <p className="text-sm text-stone-600">Thời gian dự kiến: {etaLabel(order.etaHours)}</p>
          </section>
        );
      case 'DELIVERED': {
        const links = order.brief.milestones.filter((m) => m.deliveryUrl);
        return (
          <section className="card-action space-y-3" aria-labelledby="action-title">
            <h2 id="action-title" className="flex items-center gap-2 font-display text-lg font-bold text-stone-900">
              <span className="material-symbols-outlined text-amber-800" aria-hidden>inventory_2</span>
              Freelancer đã bàn giao toàn bộ
            </h2>
            <p className="text-stone-700">{sv.description}</p>
            {links.length > 0 && (
              <ul className="divide-y divide-stone-100">
                {links.map((m) => (
                  <li key={m.id}>
                    <a href={m.deliveryUrl} target="_blank" rel="noopener noreferrer nofollow" className="flex min-h-[48px] items-center justify-between gap-3 font-semibold text-brand-800">
                      <span className="min-w-0 truncate">{m.id} · {m.title}</span>
                      <span className="material-symbols-outlined !text-[20px]" aria-hidden>open_in_new</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {moneyBox('Khi bạn nghiệm thu', acceptVnd, `${BRAND.name} trả nốt ${formatVnd(acceptVnd)} cho freelancer.`)}
          </section>
        );
      }
      case 'ACCEPTED':
        return (
          <div className="banner-success" role="status">
            <span className="material-symbols-outlined" aria-hidden>verified</span>
            <div className="space-y-1">
              <p className="font-display text-base font-bold">Đơn đã hoàn tất · {sv.description}</p>
              {showRepo && (
                <a href={order.repoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center font-semibold underline">
                  Xem repo bàn giao
                </a>
              )}
            </div>
          </div>
        );
      case 'DISPUTED':
        return (
          <div className="banner-danger" role="status">
            <span className="material-symbols-outlined" aria-hidden>gavel</span>
            <div className="space-y-1">
              <p className="font-display text-base font-bold">Đơn đang tranh chấp</p>
              <p>{sv.description}</p>
              {order.disputeReason && <p>Lý do: {order.disputeReason}</p>}
              {hasSupport && (
                <p>
                  Cần hỗ trợ? <SupportContact />
                </p>
              )}
            </div>
          </div>
        );
      case 'RESOLVED':
      case 'CANCELLED':
        return (
          <section className="card space-y-1" aria-labelledby="action-title">
            <h2 id="action-title" className="flex items-center gap-2 font-display text-lg font-bold text-stone-900">
              <span className="material-symbols-outlined text-stone-600" aria-hidden>{input.status === 'RESOLVED' ? 'gavel' : 'cancel'}</span>
              {input.status === 'RESOLVED' ? 'Đã xử lý tranh chấp' : 'Đơn đã huỷ'}
            </h2>
            <p className="text-stone-700">{sv.description}</p>
          </section>
        );
    }
  })();

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4 md:px-8 md:py-8 lg:space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/orders" className="-ml-2 inline-flex min-h-[44px] items-center gap-1 rounded-full px-2 font-display text-sm font-semibold text-stone-700 hover:bg-stone-100">
            <span className="material-symbols-outlined !text-[20px]" aria-hidden>arrow_back</span>
            Đơn của tôi
          </Link>
          <span className="chip-dark">{order.id}</span>
        </div>

        <header className={`card-raised space-y-3 border-l-4 ${TONE_BORDER[sv.tone]}`}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone={sv.tone} label={sv.label} />
            {item && <span className="chip-neutral">{item.name}</span>}
          </div>
          <h1 className="line-clamp-3 font-display text-2xl font-extrabold text-stone-900 md:text-3xl">{order.title}</h1>
          <p className="text-stone-700">{sv.description}</p>
          <LiveStepper step={sv.step} percent={percent} paused={input.status === 'DISPUTED'} />
        </header>

        {/* One DOM order for both layouts: on mobile the two columns dissolve (`contents`) and `order-*` interleaves them. */}
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
          <div className="contents lg:col-span-8 lg:block lg:space-y-6">
            {action && <div className="order-1">{action}</div>}
            {askRefund && refundDue !== undefined && (
              <div className="order-1">
                <RefundAccountCard orderId={order.id} dueVnd={refundDue} />
              </div>
            )}
            <div className="order-3">
              <MilestoneList milestones={order.brief.milestones} amountOf={amountOf} paysOnApproval={(mid) => paysOnApproval(order, mid)} />
            </div>
            {(showSandbox || showDeliveryLinks || showCommits || showRepo || showClaimRepo) && (
              <section className="card order-4 space-y-4" aria-label="Bàn giao">
                {showSandbox ? <SandboxFrame order={order} delivered={delivered} /> : showDeliveryLinks && <DeliveryLinks order={order} />}
                {showCommits && (
                  <details className="group rounded-xl border border-stone-200">
                    <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between px-4 font-display text-sm font-semibold text-stone-900">
                      Lịch sử commit ({order.commits?.length ?? 0})
                      <span className="material-symbols-outlined text-stone-600 transition group-open:rotate-180" aria-hidden>expand_more</span>
                    </summary>
                    <div className="px-2 pb-2">
                      <GitTerminalLog commits={order.commits ?? []} repoUrl={order.repoUrl} />
                    </div>
                  </details>
                )}
                {showRepo && (
                  <a href={order.repoUrl} target="_blank" rel="noopener noreferrer" className="btn-outline w-full">
                    Xem repo bàn giao
                  </a>
                )}
                {showClaimRepo && (
                  <button type="button" className="btn-secondary w-full" onClick={() => openSheet({ kind: 'repo' })}>
                    Nhận repo về tài khoản GitHub của bạn
                  </button>
                )}
              </section>
            )}
            <div className="order-5">
              <OrderChatBox messages={chat} onSend={sendChat} coderName={order.assignedCoder?.name} />
            </div>
          </div>

          <div className="contents lg:sticky lg:top-24 lg:col-span-4 lg:block lg:space-y-6">
            <div className="order-2">
              <MoneyLedger money={input.money} priceVnd={order.priceVnd} priceQuoted={input.priceQuoted} />
            </div>
            {sv.canAccept && (
              <StickyActionBar>
                <div className="flex gap-2 lg:flex-col">
                  <button type="button" className="btn-outline flex-1 lg:order-2" onClick={() => openSheet({ kind: 'revise' })}>
                    Yêu cầu sửa
                  </button>
                  <button type="button" className="btn-primary flex-[2] lg:order-1" onClick={() => openSheet({ kind: 'accept' })}>
                    Nghiệm thu đơn
                  </button>
                </div>
              </StickyActionBar>
            )}
            {order.assignedCoder && (
              <section className="card order-6 flex items-center gap-3" aria-label="Freelancer">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 font-display font-bold text-brand-800" aria-hidden>
                  {order.assignedCoder.name.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-stone-600">Freelancer</p>
                  <p className="font-display font-bold text-stone-900">{order.assignedCoder.name}</p>
                  {order.assignedCoder.rating > 0 && (
                    <p className="text-sm text-stone-600">{order.assignedCoder.tier} · {order.assignedCoder.rating} sao · {order.assignedCoder.completedOrders} đơn</p>
                  )}
                </div>
              </section>
            )}
            {askRefund && refundDue === undefined && (
              <div className="order-7">
                <RefundAccountCard orderId={order.id} />
              </div>
            )}
            {(hasSupport || (ordersApiEnabled && sv.canDispute)) && (
              <section className="card order-8 space-y-3" aria-labelledby="support-title">
                <h2 id="support-title" className="font-display text-base font-bold text-stone-900">Cần hỗ trợ?</h2>
                {hasSupport && <SupportContact className="text-sm" />}
                {ordersApiEnabled && sv.canDispute && (
                  <div className="divider pt-3">
                    <button type="button" className="btn-danger-ghost w-full" onClick={() => openSheet({ kind: 'dispute' })}>
                      <span className="material-symbols-outlined !text-[20px]" aria-hidden>gavel</span>
                      Mở tranh chấp
                    </button>
                    <p className="help">Chỉ dùng khi không thống nhất được với freelancer. Tiền còn giữ sẽ bị tạm khoá.</p>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>

        {/* Mobile only: the expanded milestone card already carries both buttons on desktop. */}
        {reviewing && (
          <div className="lg:hidden">
            <StickyActionBar>
              <div className="flex gap-2">
                <button type="button" className="btn-outline flex-1 whitespace-nowrap px-3" onClick={() => openSheet({ kind: 'reject', milestoneId: reviewing.id })}>
                  Yêu cầu sửa
                </button>
                <button
                  type="button"
                  className="btn-primary flex-[2] whitespace-nowrap px-3"
                  disabled={reviewing.qa?.status === 'FAILED'}
                  onClick={() => openSheet({ kind: 'approve', milestoneId: reviewing.id })}
                >
                  {approveLabel(reviewing.id)}
                </button>
              </div>
            </StickyActionBar>
          </div>
        )}
      </main>

      {sheet?.kind === 'approve' && sheetMilestone && (
        <ConfirmSheet
          {...sheetProps}
          title={`Duyệt mốc ${sheetMilestone.id} · ${sheetMilestone.title}`}
          confirmLabel={approveLabel(sheetMilestone.id)}
          canConfirm={ticked && sheetMilestone.qa?.status !== 'FAILED'}
          blockedReason={sheetMilestone.qa?.status === 'FAILED' ? 'Kiểm tra tự động chưa đạt' : 'Tích ô xác nhận để tiếp tục'}
          onConfirm={() => review(sheetMilestone.id, true)}
        >
          {sheetMilestone.deliveryUrl ? (
            <div className="space-y-1">
              <a href={sheetMilestone.deliveryUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn-outline btn-sm">
                <span className="material-symbols-outlined !text-[20px]" aria-hidden>open_in_new</span>
                Mở bản bàn giao
              </a>
              <p className="break-all text-xs text-stone-600">{sheetMilestone.deliveryUrl}</p>
            </div>
          ) : (
            <p>Freelancer chưa gửi link bàn giao cho mốc này.</p>
          )}
          {sheetMilestone.note && <p className="rounded-xl bg-stone-50 p-3">Ghi chú của freelancer: “{sheetMilestone.note}”</p>}
          {sheetMilestone.qa && (
            <p className={sheetMilestone.qa.status === 'FAILED' ? 'font-semibold text-red-700' : ''}>
              Kiểm tra tự động: {sheetMilestone.qa.status === 'PASSED' ? 'Đạt ✓' : sheetMilestone.qa.status === 'FAILED' ? 'Không đạt ✗ — hãy yêu cầu sửa' : 'Chưa có kết quả'}
            </p>
          )}
          {paysOnApproval(order, sheetMilestone.id)
            ? moneyBox('Bạn sẽ trả cho mốc này', amountOf(sheetMilestone.id), 'Sau khi duyệt, khoản này được chuyển cho freelancer và không hoàn lại được.')
            : moneyBox('Tiền mốc cuối', amountOf(sheetMilestone.id), `Duyệt mốc cuối chưa trả tiền: khoản này được ${BRAND.name} giữ tới khi bạn nghiệm thu cả đơn.`, false)}
          {tick('Tôi đã mở link và kiểm tra mốc này')}
        </ConfirmSheet>
      )}

      {sheet?.kind === 'reject' && sheetMilestone && (
        <ConfirmSheet
          {...sheetProps}
          title={`Cần freelancer sửa gì ở ${sheetMilestone.id}?`}
          confirmLabel="Gửi yêu cầu sửa"
          canConfirm={note.trim().length >= MIN_NOTE.reject}
          blockedReason={`Viết ít nhất ${MIN_NOTE.reject} ký tự`}
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
          blockedReason="Tích ô xác nhận để tiếp tục"
          onConfirm={accept}
        >
          <ul className="divide-y divide-stone-100">
            {order.brief.milestones.map((m) => (
              <li key={m.id} className="flex items-start gap-2 py-2">
                <span className={`material-symbols-outlined !text-[20px] ${m.status === 'COMPLETED' ? 'text-teal-700' : 'text-stone-500'}`} aria-hidden>
                  {m.status === 'COMPLETED' ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span>
                  <span className="font-semibold text-stone-900">{m.id} · {m.title}</span>
                  <span className="block text-xs text-stone-600">
                    {m.status !== 'COMPLETED' ? '(chưa duyệt, sẽ được trả cùng lúc)' : paysOnApproval(order, m.id) ? '(đã duyệt, đã trả)' : '(đã duyệt, trả khi nghiệm thu)'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {moneyBox('Số tiền sẽ giải ngân ngay', acceptVnd, 'Sau khi nghiệm thu: đơn hoàn tất, không mở tranh chấp được nữa, tiền đã trả không hoàn lại được.')}
          {tick('Tôi đã kiểm tra bản bàn giao và đồng ý nghiệm thu')}
        </ConfirmSheet>
      )}

      {sheet?.kind === 'revise' && (
        <ConfirmSheet
          {...sheetProps}
          title="Yêu cầu freelancer sửa"
          confirmLabel="Gửi yêu cầu sửa"
          canConfirm={note.trim().length >= MIN_NOTE.revise}
          blockedReason={`Viết ít nhất ${MIN_NOTE.revise} ký tự`}
          onConfirm={requestRevision}
        >
          {noteField('Cần freelancer sửa gì?', REVISION_HINTS)}
          <p className="text-stone-600">Freelancer thấy nội dung này ở mốc cuối và nộp lại bản sửa để bạn duyệt. Nội dung cũng được gửi vào chat của đơn.</p>
        </ConfirmSheet>
      )}

      {sheet?.kind === 'dispute' && (
        <ConfirmSheet
          {...sheetProps}
          title="Mở tranh chấp"
          danger
          confirmLabel="Mở tranh chấp"
          canConfirm={note.trim().length >= MIN_NOTE.dispute}
          blockedReason={`Viết ít nhất ${MIN_NOTE.dispute} ký tự`}
          onConfirm={dispute}
        >
          {noteField('Lý do mở tranh chấp')}
          <p className="banner-danger">
            {heldVnd > 0
              ? `Tiền còn giữ (${formatVnd(heldVnd)}) sẽ bị tạm khoá cho tới khi ${BRAND.name} xử lý.`
              : `Hiện không còn tiền giữ (0 đ): các mốc đã duyệt đã được trả cho freelancer. ${BRAND.name} vẫn xem xét tranh chấp.`}
          </p>
        </ConfirmSheet>
      )}

      {sheet?.kind === 'repo' && (
        <ConfirmSheet
          {...sheetProps}
          title="Nhận repo về GitHub"
          confirmLabel="Nhận repo"
          canConfirm={note.trim().replace(/^@/, '').length > 0}
          blockedReason="Nhập tên GitHub"
          onConfirm={claimRepo}
        >
          <div>
            <label htmlFor="sheet-github" className="label">Tên GitHub (username)</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-600" aria-hidden>@</span>
              <input
                id="sheet-github"
                className="field !pl-8"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={note}
                disabled={sending}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <p className="text-stone-600">Bạn sẽ nhận lời mời qua email GitHub.</p>
        </ConfirmSheet>
      )}
    </>
  );
}
