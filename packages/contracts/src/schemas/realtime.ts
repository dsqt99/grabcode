import { z } from 'zod';
import type { ChatMessage } from '../types/events';

// S6 realtime: Postgres triggers (core-api migration) write "something changed" hints to centrifugo_outbox,
// Centrifugo pushes them on the per-user channel. Hints carry no state: clients refetch over REST (Postgres stays the truth).

/** Server-side subscription granted by the connection token; nobody can subscribe to another user's channel. */
export const userChannel = (userId: string) => `user.${userId}`;

export const RealtimeHintSchema = z.object({
  /** order: order row / commits / payment changed; repo: order repo status; offer: wave offers of this coder; chat: new message. */
  type: z.enum(['order', 'repo', 'offer', 'chat']),
  orderId: z.string(),
});

export const RealtimeTokenSchema = z.object({
  /** Centrifugo WebSocket endpoint, e.g. ws://localhost:8000/connection/websocket */
  url: z.string(),
  /** HS256 connection JWT (sub = user id, channels = [user.<id>]). */
  token: z.string(),
});

export const ChatMessageSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  sender: z.enum(['CUSTOMER', 'CODER', 'SYSTEM']),
  senderName: z.string(),
  text: z.string(),
  timestamp: z.string(),
});

export const ChatSendSchema = z.object({ text: z.string().trim().min(1).max(2000) });
export const ChatListSchema = z.object({ messages: z.array(ChatMessageSchema) });

export type RealtimeHint = z.infer<typeof RealtimeHintSchema>;
export type RealtimeToken = z.infer<typeof RealtimeTokenSchema>;
export type ChatList = z.infer<typeof ChatListSchema>;
export type { ChatMessage };

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _chatMatches: Same<z.infer<typeof ChatMessageSchema>, ChatMessage> = true;
void _chatMatches;
