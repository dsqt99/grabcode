/**
 * Single source of truth for the product's public name and slogan.
 * Renaming the product again = edit this file (plus the logo asset and docs/BRAND.md checklist).
 * Do not hardcode a domain here: domains come from env (WEB_ORIGIN, DOMAIN, ...).
 */
export const BRAND = {
  name: 'FastDemo',
  /**
   * TẠM: CMO's recommendation (HON-38), the founder has NOT approved it yet.
   * A full sentence with its own punctuation: never append to it in components.
   */
  tagline: 'Giao demo nhanh, tận nơi. Ưng rồi mới chốt.',
  /** Org line used in the footer. */
  company: 'Hoàng Hải Tech',
} as const;
