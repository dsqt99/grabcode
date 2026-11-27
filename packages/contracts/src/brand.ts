/**
 * Single source of truth for the product's public name and slogan.
 * Renaming the product again = edit this file (plus the logo asset and docs/BRAND.md checklist).
 * Do not hardcode a domain here: domains come from env (WEB_ORIGIN, DOMAIN, ...).
 */
export const BRAND = {
  name: 'Ai Code AI',
  /**
   * TẠM (HON-61): founder CHƯA chốt slogan. Phương án thay thế:
   *  - 'Chợ POC ngắn: đặt demo dưới 3 triệu, xem demo rồi mới chốt.'
   *  - 'Có ý tưởng? Đặt POC demo dưới 3 triệu, ưng mới chốt.'
   * A full sentence with its own punctuation: never append to it in components.
   */
  tagline: 'Đặt POC demo dưới 3 triệu. Freelancer làm, xem demo rồi mới chốt.',
  /** Org line used in the footer. */
  company: 'Hoàng Hải Tech',
} as const;
