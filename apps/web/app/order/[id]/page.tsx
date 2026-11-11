'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { INITIAL_DEMO_ORDER, eventBus, toViewOrder, type ChatMessage, type Order } from '@grabcode/contracts';
import GitTerminalLog from '../../../components/GitTerminalLog';
import LiveStepper from '../../../components/LiveStepper';
import MilestoneList from '../../../components/MilestoneList';
import Navbar from '../../../components/Navbar';
import OrderChatBox from '../../../components/OrderChatBox';
import PaymentPanel from '../../../components/PaymentPanel';
import SandboxFrame from '../../../components/SandboxFrame';
import { getOrder, getOrderRepo, ordersApiEnabled, transitionOrder } from '../../../lib/api';
import { useCurrency } from '../../../lib/currency';
import { ORDERS_KEY, loadChat, loadOrder, saveChat, saveOrder } from '../../../lib/orderStore';
import { progressPercent } from '../../../lib/orderView';

const POLL_MS = 3000;
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
  const [revisions, setRevisions] = useState(2);
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
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // API mode: the server is the source of truth, poll it.
  useEffect(() => {
    if (!ordersApiEnabled || !order) return;
    const t = setInterval(() => {
      fetchView(order.id).then((next) => {
        const prev = orderRef.current;
        if (prev && prev.status !== next.status) {
          const msg = STATUS_MSG[next.status]?.(next);
          if (msg) pushChat(systemMsg(next.id, msg));
        }
        showOrder(next);
      }, console.warn);
    }, POLL_MS);
    return () => clearInterval(t);
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
      if (found.assignedCoder) {
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
  const payout = Math.round((order.priceVnd * 0.7) / 1000) * 1000;
  const percent = progressPercent(order);

  const sendChat = (text: string) => {
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
    if (revisions <= 0) return;
    if (ordersApiEnabled) {
      try {
        // Sends the order back to the coder (DELIVERED -> IN_PROGRESS).
        showOrder(toViewOrder(await transitionOrder(order.id, 'IN_PROGRESS'), await getOrderRepo(order.id)));
      } catch (e) {
        console.error(e);
        return;
      }
    }
    setRevisions((r) => r - 1);
    sendChat('Mình muốn yêu cầu chỉnh sửa một số điểm trên bản demo, bạn xem giúp nhé.');
  };

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
              <button type="button" className="btn-secondary w-full" disabled={order.status !== 'DELIVERED' || revisions <= 0} onClick={requestRevision}>
                Yêu cầu sửa (Còn {revisions} lượt)
              </button>
              {order.repoUrl && delivered && (
                <a href={order.repoUrl} target="_blank" rel="noopener noreferrer" className="block text-center text-sm font-semibold text-emerald-dark hover:underline">
                  Xem repo bàn giao
                </a>
              )}
            </div>
            <MilestoneList milestones={order.brief.milestones} />
            <OrderChatBox messages={chat} onSend={sendChat} coderName={order.assignedCoder?.name} />
          </div>
        </div>
      </main>
    </>
  );
}
