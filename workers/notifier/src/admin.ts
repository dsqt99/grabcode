// Ops notices to Telegram: own durable consumer + processed table, so it neither waits on nor replays the user push consumer.
// Idempotent per event_id (notifier.processed_admin_events). Telegram not configured -> the notice is logged and the event acked.
import { AckPolicy, type JsMsg, type NatsConnection } from 'nats';
import type { Sql } from 'postgres';
import { OrderEventSchema, PaymentReportedEventSchema, PayoutRequestedEventSchema, STREAM_NAME, SUBJECTS } from '@grabcode/contracts/schemas';
import { ADMIN_SUBJECTS, adminNoticeFor, type AdminFacts, type AdminSubject } from './adminMessages';
import { sendTelegram, telegramConfig } from './telegram';

const DURABLE = 'notifier-admin';
const MAX_DELIVER = 5;
/** Admin portal (served at /admin of the web origin in production). */
const ADMIN_URL = process.env.ADMIN_PUBLIC_URL || `${(process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(',')[0].trim()}/admin`;

interface OrderRow { id: string; title: string; price_vnd: number; price_quoted_at: Date | null; dispute_reason: string | null; name: string; phone: string | null; email: string | null }
interface PayoutRow { amount_vnd: number; bank_account: string; name: string; phone: string | null; email: string | null }

// shortcut: reads core.orders / users / payout_requests directly (core-api owns them), same as the push subscriptions.
async function factsFor(sql: Sql, raw: { type: string }): Promise<AdminFacts | null> {
  if (raw.type === SUBJECTS.PAYOUT_REQUESTED) {
    const e = PayoutRequestedEventSchema.parse(raw);
    const [p] = await sql<PayoutRow[]>`select p.amount_vnd, p.bank_account, u.name, u.phone, u.email
      from core.payout_requests p join core.users u on u.id = p.coder_user_id where p.id = ${e.data.payoutId}`;
    return p ? { amountVnd: Number(p.amount_vnd), bankAccount: p.bank_account, partyName: p.name, partyPhone: p.phone, partyEmail: p.email, adminUrl: ADMIN_URL } : null;
  }
  const reported = raw.type === SUBJECTS.PAYMENT_REPORTED ? PaymentReportedEventSchema.parse(raw) : null;
  const orderId = reported?.data.orderId ?? OrderEventSchema.parse(raw).data.orderId;
  const [o] = await sql<OrderRow[]>`select o.id, o.title, o.price_vnd, o.price_quoted_at, o.dispute_reason, u.name, u.phone, u.email
    from core.orders o join core.users u on u.id = o.customer_user_id where o.id = ${orderId}`;
  if (!o) return null;
  return {
    orderId: o.id,
    title: o.title,
    amountVnd: reported ? reported.data.dueVnd : o.price_vnd,
    priceQuoted: !!o.price_quoted_at,
    reason: o.dispute_reason,
    partyName: o.name,
    partyPhone: o.phone,
    partyEmail: o.email,
    adminUrl: ADMIN_URL,
  };
}

export async function runAdminNotices(nc: NatsConnection, sql: Sql) {
  const cfg = telegramConfig();
  await sql`create table if not exists notifier.processed_admin_events (
    event_id text primary key, processed_at timestamptz not null default now())`;
  const filter_subjects = [...ADMIN_SUBJECTS];
  const jsm = await nc.jetstreamManager();
  await jsm.consumers
    // New consumer starts at new events: no flood of old orders on first deploy.
    .add(STREAM_NAME, { durable_name: DURABLE, ack_policy: AckPolicy.Explicit, filter_subjects, max_deliver: MAX_DELIVER, deliver_policy: 'new' as never })
    .catch(() => jsm.consumers.update(STREAM_NAME, DURABLE, { filter_subjects }));

  async function handle(m: JsMsg) {
    const raw = m.json<{ event_id: string; type: string }>();
    const [seen] = await sql`select 1 from notifier.processed_admin_events where event_id = ${raw.event_id}`;
    if (seen) return m.ack();
    const facts = await factsFor(sql, raw);
    if (facts) {
      const text = adminNoticeFor(raw.type as AdminSubject, facts);
      if (!cfg) console.log(`[admin notice, Telegram not configured]\n${text}`);
      else {
        try {
          await sendTelegram(cfg, text);
        } catch (err) {
          if (m.info.deliveryCount < MAX_DELIVER) {
            const delay = 2 ** m.info.deliveryCount * 1000;
            console.warn(`telegram ${raw.type} failed, retry in ${delay}ms: ${String(err)}`);
            return m.nak(delay);
          }
          console.error(`telegram ${raw.type} dropped: ${String(err)}\n${text}`);
        }
      }
    }
    await sql`insert into notifier.processed_admin_events (event_id) values (${raw.event_id}) on conflict do nothing`;
    m.ack();
  }

  const messages = await (await nc.jetstream().consumers.get(STREAM_NAME, DURABLE)).consume();
  for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => void messages.close());
  console.log(`admin notices started (${cfg ? 'Telegram on' : 'TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID missing: notices only logged'})`);
  for await (const m of messages) {
    await handle(m).catch((err) => {
      console.error('admin notice crashed', err);
      m.nak(5000);
    });
  }
}
