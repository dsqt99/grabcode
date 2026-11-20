import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { BriefsModule } from './briefs/briefs.module';
import { IS_PROD, TRUST_PROXY, WEB_ORIGINS } from './config';
import { DbModule } from './db/db.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ReposModule } from './repos/repos.module';

@Module({ imports: [DbModule, AuthModule, BriefsModule, OrdersModule, PaymentsModule, ReposModule, DispatchModule, RealtimeModule, AdminModule] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true }); // rawBody: GitHub webhook HMAC
  // Behind a proxy/LB req.ip is the proxy unless trusted; login throttling keys on req.ip.
  if (TRUST_PROXY !== undefined) app.set('trust proxy', TRUST_PROXY);
  else if (IS_PROD) console.warn('TRUST_PROXY is not set: behind a reverse proxy every client shares one IP for rate limits (set TRUST_PROXY=1)');
  app.disable('x-powered-by');
  app.use((_req: unknown, res: { setHeader(k: string, v: string): void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  // credentials: the browser must send the gc_session cookie from the web origin(s).
  app.enableCors({ origin: WEB_ORIGINS, credentials: true });
  app.enableShutdownHooks();
  const port = Number(process.env.CORE_API_PORT ?? 4000);
  await app.listen(port);
  console.log(`core-api listening on :${port}`);
}

void bootstrap();
