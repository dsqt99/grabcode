'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { payoutOf } from '@grabcode/contracts/schemas';
import { INITIAL_DEMO_ORDER, eventBus, pollDelay, toViewOrder, type ChatMessage, type Order } from '@grabcode/contracts';
import GitTerminalLog from '../../../components/GitTerminalLog';
import LiveStepper from '../../../components/LiveStepper';
import MilestoneList from '../../../components/MilestoneList';
import Navbar from '../../../components/Navbar';
import OrderChatBox from '../../../components/OrderChatBox';
import PaymentPanel from '../../../components/PaymentPanel';
import SandboxFrame from '../../../components/SandboxFrame';
import { getMessages, getOrder, getOrderRepo, handoverRepo, onHint, ordersApiEnabled, sendMessage, reviewMilestone, transitionOrder } from '../../../lib/api';
import { useCurrency } from '../../../lib/currency';
import { ORDERS_KEY, loadChat, loadOrder, saveChat, saveOrder } from '../../../lib/orderStore';
import { progressPercent } from '../../../lib/orderView';

const POLL_MS = 3000;
const LONG_WAIT_MS = 30 * 60_000;

/** Paid order still without a coder after 30 min (admin sees it too); core-api auto-refunds after AUTO_REFUND_HOURS. */
function LongWaitNote({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (now - new Date(since).getTime() < LONG_WAIT_MS) return null;
  return (
    <p className="mt-2 text-sm font-semibold text-amber-700">
      Đã hơn 30 phút chưa có Coder nhận. Vận hành đã được báo; nếu vẫn không ai nhận, đơn sẽ tự huỷ và hoàn ký quỹ.
    </p>
  );
}
const fetchView = async (id: string) => {
  const [o, repo] = await Promise.all([getOrder(id), getOrderRepo(id)]);
  return toViewOrder(o, repo);
};
/** System chat line when the server moves the order (API mode). */
const STATUS_MSG: Partial<Record<Order['status'], (o: Order) => string>> = {
  DISPATCHING: (o) => `Đã nhận đủ ${o.priceVnd.toLocaleString('de-DE')} đ ký quỹ. Đang tìm Coder.`,
  BUILDING: (o) => `Coder ${o.assignedCoder?.name ?? ''} đang triển khai đơn của bạn.`,
  DELIVERED: () => 'Coder đã bàn giao. Hãy kiểm tra sandbox rồi nghiệm thu.',
};

const uid = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function systemMsg(orderId: string, text: string): ChatMessage {
  return { id: uid(), orderId, sender: 'SYSTEM', senderName: 'Hệ thống', text, timestamp: new Date().toISOString() };
}

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const { money } = useCurrency();
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
            ? `Đơn ${found.id} đã tạo. Chuyển khoản ${found.priceVnd.toLocaleString('de-DE')} đ để ký quỹ và dispatch.`
            : `Đơn ${found.id} đã được ký quỹ ${found.priceVnd.toLocaleString('de-DE')} đ và đang được dispatch.`,
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
        pushChat(systemMsg(oid, `Coder ${coder.name} (${coder.tier}) đã nhận đơn của bạn.`));
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
        pushChat(systemMsg(oid, 'Coder đã bàn giao. Hãy kiểm tra sandbox rồi nghiệm thu.'));
      }),
      eventBus.subscribeTo('CHAT_MESSAGE_SENT', (e) => {
        if (e.payload.orderId === oid) pushChat(e.payload);
      }),
      eventBus.subscribeTo('ORDER_REJECTED', (e) => {
        if (e.payload.orderId === oid) pushChat(systemMsg(oid, 'Một Coder đã từ chối, hệ thống đang gửi offer cho Coder tiếp theo.'));
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
        <p className="p-10 text-center text-slate-500">{missing ? 'Không tìm thấy đơn hàng.' : 'Đang tải đơn hàng...'}</p>
      </>
    );
  }

  const delivered = order.status === 'DELIVERED' || order.status === 'COMPLETED';
  const completed = order.status === 'COMPLETED';
  const payout = order.payoutVnd ?? payoutOf(order.priceVnd);
  const percent = progressPercent(order);

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

  const accept = async () => {
    if (ordersApiEnabled) {
      try {
        await transitionOrder(order.id, 'ACCEPTED');
        showOrder(await fetchView(order.id));
        pushChat(systemMsg(order.id, `Đã nghiệm thu. Giải ngân ${payout.toLocaleString('de-DE')} đ cho Coder.`));
      } catch (e) {
        console.error(e);
        pushChat(systemMsg(order.id, 'Nghiệm thu chưa thành công, vui lòng thử lại.'));
      }
      return;
    }
    applyOrder((o) => ({ ...o, status: 'COMPLETED', escrowStatus: 'RELEASED', completedAt: new Date().toISOString() }));
    eventBus.publish({ type: 'ORDER_COMPLETED', payload: { orderId: order.id, payoutVnd: payout }, timestamp: new Date().toISOString() });
    pushChat(systemMsg(order.id, `Đã nghiệm thu. Giải ngân ${payout.toLocaleString('de-DE')} đ cho Coder.`));
  };

  const requestRevision = async () => {
    if (ordersApiEnabled) {
      try {
        // Sends the order back to the coder (DELIVERED -> IN_PROGRESS).
        showOrder(toViewOrder(await transitionOrder(order.id, 'IN_PROGRESS'), await getOrderRepo(order.id)));
      } catch (e) {
        console.error(e);
        return;
      }
    }
    sendChat('Mình muốn yêu cầu chỉnh sửa một số điểm trên bản demo, bạn xem giúp nhé.');
  };

  const review = async (milestoneId: string, approve: boolean, note?: string) => {
    try {
      showOrder(toViewOrder(await reviewMilestone(order.id, milestoneId, approve, note), await getOrderRepo(order.id)));
      pushChat(systemMsg(order.id, approve ? `Đã duyệt mốc ${milestoneId}, giải ngân phần ký quỹ của mốc cho Coder.` : `Đã yêu cầu Coder sửa mốc ${milestoneId}: ${note}`));
    } catch (e) {
      console.error(e);
      pushChat(systemMsg(order.id, `Thao tác mốc ${milestoneId} chưa thành công, vui lòng thử lại.`));
    }
  };

  // Freezes the escrow still held; ops resolve it from admin (S6).
  const dispute = async () => {
    const reason = window.prompt('Lý do mở tranh chấp (ký quỹ còn lại sẽ bị giữ cho tới khi xử lý xong):')?.trim();
    if (!reason) return;
    try {
      showOrder(toViewOrder(await transitionOrder(order.id, 'DISPUTED', reason), await getOrderRepo(order.id)));
      pushChat(systemMsg(order.id, `Đã mở tranh chấp: ${reason}`));
    } catch (e) {
      console.error(e);
      pushChat(systemMsg(order.id, 'Mở tranh chấp chưa thành công, vui lòng thử lại.'));
    }
  };
  const claimRepo = async () => {
    const login = window.prompt('GitHub username nhận quyền admin repo:')?.trim();
    if (!login) return;
    try {
      await handoverRepo(order.id, login);
      showOrder(await fetchView(order.id));
      pushChat(systemMsg(order.id, `Đang chuyển quyền admin repo cho GitHub ${login}. Kiểm tra lời mời trong email GitHub.`));
    } catch (e) {
      console.error(e);
      pushChat(systemMsg(order.id, 'Chưa chuyển được repo: kiểm tra lại GitHub username.'));
    }
  };
  const disputed = order.disputeReason !== undefined;
  const canDispute = ordersApiEnabled && ['BUILDING', 'QA_TESTING', 'DELIVERED'].includes(order.status);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip-dark">{order.id}</span>
              <span className={completed ? 'chip-ok' : 'chip-warn'}>
                {completed ? 'Đã nghiệm thu' : delivered ? 'Chờ nghiệm thu' : order.escrowStatus === 'UNPAID' ? 'Chờ thanh toán' : 'Đang thực hiện'}
              </span>
              <span className="chip bg-slate-100 text-slate-600">{order.tier}</span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold text-ink md:text-3xl">{order.title}</h1>
          </div>
          <dl className="flex gap-6 text-sm">
            <div><dt className="text-slate-500">Ký quỹ</dt><dd className="font-display font-extrabold text-emerald-dark">{money(order.priceVnd)}</dd></div>
            <div><dt className="text-slate-500">Trạng thái ký quỹ</dt><dd className="font-semibold">{order.escrowStatus === 'RELEASED' ? 'Đã giải ngân' : order.escrowStatus === 'UNPAID' ? 'Chờ thanh toán' : 'Đang giữ an toàn'}</dd></div>
            <div><dt className="text-slate-500">ETA</dt><dd className="font-semibold">~{order.etaHours}h</dd></div>
          </dl>
        </header>

        <LiveStepper status={order.status} percent={percent} />

        {disputed && (
          <div className="card border-red-200 bg-red-50 text-sm text-red-800" role="status">
            <p className="font-display font-bold">Đơn đang tranh chấp — ký quỹ còn lại được giữ tới khi vận hành xử lý.</p>
            {order.disputeReason && <p className="mt-1">Lý do: {order.disputeReason}</p>}
          </div>
        )}

        {ordersApiEnabled && order.escrowStatus === 'UNPAID' && <PaymentPanel orderId={order.id} />}

        {order.status === 'DISPATCHING' && (
          <div className="card flex items-center gap-4 border-emerald/40 bg-emerald-mint/50 shadow-l2" role="status">
            <span className="relative grid h-12 w-12 shrink-0 place-items-center">
              <span className="absolute h-12 w-12 animate-sonar rounded-full bg-emerald/40" />
              <span className="material-symbols-outlined relative text-emerald" aria-hidden>radar</span>
            </span>
            <div>
              <p className="font-display font-bold text-ink">Đang gửi offer tới các Coder gần nhất...</p>
              <p className="text-sm text-slate-600">Offer có hiệu lực 30 giây mỗi đợt. Mở ứng dụng Coder (/coder) để nhận đơn khi demo.</p>
              <LongWaitNote since={order.createdAt} />
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            <SandboxFrame order={order} delivered={delivered} />
            <GitTerminalLog commits={order.commits ?? []} repoUrl={order.repoUrl} />
          </div>
          <div className="space-y-6">
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
              <button type="button" className="btn-primary w-full" disabled={order.status !== 'DELIVERED'} onClick={accept}>
                <span className="material-symbols-outlined !text-[20px]" aria-hidden>paid</span>
                {completed ? 'Đã giải ngân' : 'Nghiệm thu & Giải ngân'}
              </button>
              <button type="button" className="btn-secondary w-full" disabled={order.status !== 'DELIVERED'} onClick={requestRevision}>
                Yêu cầu sửa
              </button>
              {canDispute && (
                <button type="button" className="w-full text-center text-sm font-semibold text-red-600 hover:underline" onClick={dispute}>
                  Mở tranh chấp
                </button>
              )}
              {order.repoUrl && delivered && (
                <a href={order.repoUrl} target="_blank" rel="noopener noreferrer" className="block text-center text-sm font-semibold text-emerald-dark hover:underline">
                  Xem repo bàn giao
                </a>
              )}
              {ordersApiEnabled && order.repoHandoverPending && (
                <button type="button" className="w-full text-center text-sm font-semibold text-emerald-dark hover:underline" onClick={claimRepo}>
                  Nhận repo về tài khoản GitHub của bạn
                </button>
              )}
            </div>
            <MilestoneList milestones={order.brief.milestones} onReview={ordersApiEnabled && !disputed ? review : undefined} />
            <OrderChatBox messages={chat} onSend={sendChat} coderName={order.assignedCoder?.name} />
          </div>
        </div>
      </main>
    </>
  );
}
