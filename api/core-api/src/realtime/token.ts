import { createHmac } from 'node:crypto';
import { userChannel } from '@grabcode/contracts/schemas';

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url');

/** Centrifugo connection JWT (HS256): sub = user, server-side subscription to the user's own channel only. */
export function connectionToken(userId: string, secret: string, ttlSeconds = 24 * 3600, now = Date.now()): string {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ sub: userId, exp: Math.floor(now / 1000) + ttlSeconds, channels: [userChannel(userId)] }));
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
