import { randomBytes, scrypt, timingSafeEqual, type BinaryLike } from 'node:crypto';

// scrypt from node:crypto (N=16384, r=8, p=1 defaults): memory-hard, no native dependency needed.
const KEYLEN = 64;
const derive = (password: string, salt: BinaryLike) =>
  new Promise<Buffer>((resolve, reject) => scrypt(password, salt, KEYLEN, (err, key) => (err ? reject(err) : resolve(key))));

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64')}$${(await derive(password, salt)).toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(password, Buffer.from(salt, 'base64'));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Hash of a random password: verified against when the email is unknown, so timing does not reveal which emails exist. */
export const DUMMY_HASH = hashPassword(randomBytes(16).toString('hex'));
