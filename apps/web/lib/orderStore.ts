import type { ChatMessage, Order } from '@grabcode/contracts';

export const ORDERS_KEY = 'grabcode_orders';

export function loadOrders(): Record<string, Order> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Order>) : {};
  } catch {
    return {};
  }
}

export function loadOrder(id: string): Order | undefined {
  return loadOrders()[id];
}

export function saveOrder(order: Order): void {
  if (typeof window === 'undefined') return;
  try {
    const all = loadOrders();
    all[order.id] = order;
    localStorage.setItem(ORDERS_KEY, JSON.stringify(all));
  } catch {
    // storage unavailable or full: ignore
  }
}

/** Read-modify-write an order; returns the updated order (or undefined if missing). */
export function updateOrder(id: string, fn: (o: Order) => Order, fallback?: Order): Order | undefined {
  const current = loadOrder(id) ?? fallback;
  if (!current) return undefined;
  const next = fn(current);
  saveOrder(next);
  return next;
}

export function newOrderId(): string {
  return `GC-${Math.floor(1000 + Math.random() * 9000)}`;
}

// ---- Chat persistence (per order) ----
const chatKey = (id: string) => `grabcode_chat_${id}`;

export function loadChat(id: string): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(chatKey(id));
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveChat(id: string, msgs: ChatMessage[]): void {
  try {
    localStorage.setItem(chatKey(id), JSON.stringify(msgs));
  } catch {
    // ignore
  }
}
