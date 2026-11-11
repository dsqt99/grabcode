// Env-derived settings shared by bootstrap (CORS) and auth (redirect allowlist, cookies).
export const WEB_ORIGINS = (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(',').map((o) => o.trim());
export const IS_PROD = process.env.NODE_ENV === 'production';
export const API_PUBLIC_URL = (process.env.API_PUBLIC_URL ?? 'http://localhost:4000').replace(/\/$/, '');
export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? '';
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? '';
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
export const GITHUB_APP_WEBHOOK_SECRET = process.env.GITHUB_APP_WEBHOOK_SECRET ?? '';
export const DEV_LOGIN_ENABLED = process.env.AUTH_DEV_LOGIN === 'true' && !IS_PROD;
// SePay (S2): webhook auth key + receiving bank account shown to customers. Unset key = webhook always 401.
export const SEPAY_WEBHOOK_API_KEY = process.env.SEPAY_WEBHOOK_API_KEY ?? '';
export const SEPAY_BANK = process.env.SEPAY_BANK ?? '';
export const SEPAY_ACCOUNT_NUMBER = process.env.SEPAY_ACCOUNT_NUMBER ?? '';
export const SEPAY_ACCOUNT_NAME = process.env.SEPAY_ACCOUNT_NAME ?? '';
