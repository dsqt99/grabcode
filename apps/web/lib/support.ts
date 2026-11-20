// Support channels shown on the payment page, order page and footer (P0-9). Real numbers only, from the build env:
// a production build without any of them fails (next.config.ts).
const digits = (v: string | undefined) => (v ?? '').replace(/[^0-9]/g, '');

const zalo = digits(process.env.NEXT_PUBLIC_SUPPORT_ZALO);
const hotline = digits(process.env.NEXT_PUBLIC_SUPPORT_HOTLINE);

/** Display form 0912 345 678. */
const pretty = (n: string) => n.replace(/^(\d{4})(\d{3})(\d+)$/, '$1 $2 $3');

export const SUPPORT = {
  zalo: zalo ? { label: `Zalo ${pretty(zalo)}`, href: `https://zalo.me/${zalo}` } : null,
  hotline: hotline ? { label: `Hotline ${pretty(hotline)}`, href: `tel:${hotline}` } : null,
};
export const hasSupport = !!(SUPPORT.zalo || SUPPORT.hotline);
