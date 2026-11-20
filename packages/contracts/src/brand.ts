/**
 * Single source of truth for the product's public name and slogan.
 * Renaming the product again = edit this file (plus the logo asset and docs/BRAND.md checklist).
 * Do not hardcode a domain here: domains come from env (WEB_ORIGIN, DOMAIN, ...).
 */
export const BRAND = {
  name: 'FastDemo',
  /**
   * TẠM (HON-43, theo chỉ đạo founder: cosplay app giao đồ ăn, vibe code ship demo nhanh). Founder CHƯA chốt câu chữ.
   * A full sentence with its own punctuation: never append to it in components.
   */
  tagline: 'Đặt demo như đặt đồ ăn. Vibe code giao nhanh, ưng mới chốt.',
  /** Org line used in the footer. */
  company: 'Hoàng Hải Tech',
} as const;
