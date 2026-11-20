// Env-derived settings shared by bootstrap (CORS) and auth (redirect allowlist, cookies).
export const WEB_ORIGINS = (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(',').map((o) => o.trim());
export const IS_PROD = process.env.NODE_ENV === 'production';
/** Express `trust proxy`: hop count ("1" on Cloud Run / one LB) or a name like "loopback". Unset = req.ip is the socket peer. */
export const TRUST_PROXY = process.env.TRUST_PROXY === undefined || process.env.TRUST_PROXY === '' ? undefined : /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY;
export const API_PUBLIC_URL = (process.env.API_PUBLIC_URL ?? 'http://localhost:4000').replace(/\/$/, '');
export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? '';
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? '';
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
export const GITHUB_APP_WEBHOOK_SECRET = process.env.GITHUB_APP_WEBHOOK_SECRET ?? '';
export const DEV_LOGIN_ENABLED = process.env.AUTH_DEV_LOGIN === 'true' && !IS_PROD;
// Receiving bank account shown to customers with a VietQR code. PAYMENT_BANK_ID = VietQR bank code or BIN (MB, VCB, 970422...).
// Unset = the payment page says the account is not configured. SEPAY_* names are still read for older .env files.
export const PAYMENT_BANK_ID = process.env.PAYMENT_BANK_ID || process.env.SEPAY_BANK || '';
export const PAYMENT_BANK_NAME = process.env.PAYMENT_BANK_NAME || PAYMENT_BANK_ID;
export const PAYMENT_ACCOUNT_NUMBER = process.env.PAYMENT_ACCOUNT_NUMBER || process.env.SEPAY_ACCOUNT_NUMBER || '';
export const PAYMENT_ACCOUNT_NAME = process.env.PAYMENT_ACCOUNT_NAME || process.env.SEPAY_ACCOUNT_NAME || '';
// Optional SePay webhook (automatic confirmation). Unset key = webhook always 401 and an admin confirms transfers by hand.
export const SEPAY_WEBHOOK_API_KEY = process.env.SEPAY_WEBHOOK_API_KEY ?? '';
// Centrifugo (S6): connection-token secret shared with the centrifugo container. Unset = realtime off (token 404).
export const CENTRIFUGO_SECRET = process.env.CENTRIFUGO_CLIENT_TOKEN_HMAC_SECRET_KEY ?? '';
export const REALTIME_WS_URL = process.env.REALTIME_WS_URL ?? 'ws://localhost:8000/connection/websocket';
