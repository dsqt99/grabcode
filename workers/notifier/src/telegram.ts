// Telegram Bot API sendMessage (https://core.telegram.org/bots/api#sendmessage). Setup: docs/DEPLOY.md "Thông báo admin qua Telegram".

export interface TelegramConfig {
  token: string;
  chatId: string;
}

/** null when TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID are not both set: notices are logged instead. */
export const telegramConfig = (env: NodeJS.ProcessEnv = process.env): TelegramConfig | null =>
  env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ADMIN_CHAT_ID ? { token: env.TELEGRAM_BOT_TOKEN, chatId: env.TELEGRAM_ADMIN_CHAT_ID } : null;

/** Throws on a transient failure (network, 429, 5xx) so the event is retried; a 4xx (bad chat id, bot kicked) is logged, not retried. */
export async function sendTelegram(cfg: TelegramConfig, text: string, fetchFn: typeof fetch = fetch) {
  const res = await fetchFn(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: cfg.chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.ok) return;
  // Never log the URL: it contains the bot token.
  const body = await res.text().catch(() => '');
  if (res.status === 429 || res.status >= 500) throw new Error(`telegram ${res.status}: ${body.slice(0, 200)}`);
  console.warn(`telegram rejected ${res.status}: ${body.slice(0, 200)}`);
}
