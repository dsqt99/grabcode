import { z } from 'zod';
import { OrderSchema } from './order';

// Dispatch + matching (S3). A funded order is offered to a small wave of online coders; the first to accept wins.
// A wave that expires or is declined by everyone triggers the next wave (coders who declined are never asked again).

/** Coders per wave and how long each offer stays open. */
export const WAVE_SIZE = 3;
export const OFFER_SECONDS = 30;
/** A coder counts as online only if the app polled GET /v1/me/offers within this window. */
export const PRESENCE_TTL_SECONDS = 60;

export const OfferStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'LOST']);
export type OfferStatus = z.infer<typeof OfferStatusSchema>;

/** One offer to one coder (API shape; the coder UI maps it to its WaveOffer card). */
export const DispatchOfferSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string(),
  wave: z.number().int().positive(),
  status: OfferStatusSchema,
  expiresAt: z.string(),
  /** Seconds until expiry by the DB clock, so the client countdown ignores its own clock skew. */
  secondsLeft: z.number().int().nonnegative(),
  createdAt: z.string(),
  order: OrderSchema,
});
export type DispatchOffer = z.infer<typeof DispatchOfferSchema>;

/** GET /v1/me/offers: the caller's open (PENDING, unexpired) offers. Also the presence heartbeat. */
export const OfferListSchema = z.object({ offers: z.array(DispatchOfferSchema) });
export type OfferList = z.infer<typeof OfferListSchema>;

/** GET / PUT /v1/me/presence (coder online toggle, stored server side). */
export const PresenceSchema = z.object({ online: z.boolean() });
export type Presence = z.infer<typeof PresenceSchema>;
