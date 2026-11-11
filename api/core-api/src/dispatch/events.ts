import { randomUUID } from 'node:crypto';
import type { DispatchEvent } from '@grabcode/contracts/schemas';
import { outbox } from '../db/schema';
import type { Tx } from '../orders/orders.service';

export async function dispatchEvent(tx: Tx, type: DispatchEvent['type'], data: DispatchEvent['data']) {
  const event: DispatchEvent = { event_id: randomUUID(), type, occurred_at: new Date().toISOString(), data };
  await tx.insert(outbox).values({ eventId: event.event_id, subject: event.type, payload: event });
}
