import { z } from 'zod';

/** Vietnamese mobile number (03/05/07/08/09 + 8 digits; +84 / 84 prefix allowed), normalized to 0xxxxxxxxx. null when invalid. */
export function normalizeVnPhone(raw: string): string | null {
  const digits = raw.replace(/[\s.()-]/g, '').replace(/^\+?84/, '0');
  return /^0[35789][0-9]{8}$/.test(digits) ? digits : null;
}
/** Customer phone ops call / Zalo about an order (P0-5); stored normalized. */
export const VnPhoneSchema = z
  .string()
  .trim()
  .max(20)
  .refine((p) => normalizeVnPhone(p) !== null, 'Số điện thoại Việt Nam không hợp lệ')
  .transform((p) => normalizeVnPhone(p)!);
