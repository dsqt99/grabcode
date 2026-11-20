/**
 * Single source of truth for the product's public name and slogan.
 * Renaming the product again = edit this file (plus the logo asset and docs/BRAND.md checklist).
 * Do not hardcode a domain here: domains come from env (WEB_ORIGIN, DOMAIN, ...).
 */
export const BRAND = {
  name: 'FastDemo',
  /** Placeholder until the CMO supplies the final slogan. */
  tagline: 'Xem demo rồi mới chốt',
  /** Org line used in the footer. */
  company: 'Hoàng Hải Tech',
} as const;
