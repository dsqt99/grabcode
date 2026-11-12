import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB, type Db } from '../db/client';

const EVERY_MS = 10 * 60_000;

/**
 * Centrifugo deletes the hints it delivers; when it is down, public.centrifugo_outbox only grows.
 * Hints carry no state (clients refetch REST and poll as fallback), so rows older than 10 minutes are worthless.
 */
@Injectable()
export class HintJanitor implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(@Inject(DB) private readonly db: Db) {}

  onModuleInit() {
    this.timer = setInterval(
      () => void this.db.execute(sql`delete from public.centrifugo_outbox where created_at < now() - interval '10 minutes'`).catch((e) => console.error('hint cleanup failed', e)),
      EVERY_MS,
    );
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }
}
