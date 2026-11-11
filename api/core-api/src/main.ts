import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { BriefResultsConsumer } from './briefs/briefs.consumer';
import { BriefsController } from './briefs/briefs.controller';
import { BriefsService } from './briefs/briefs.service';
import { WEB_ORIGINS } from './config';
import { RepoResultsConsumer } from './repos/repos.consumer';
import { ReposController } from './repos/repos.controller';
import { ReposService } from './repos/repos.service';
import { createDb, DB } from './db/client';

// shortcut: single module while only the briefs + auth domains exist; split per domain (orders, ledger...) as they land.
@Module({
  controllers: [BriefsController, AuthController, ReposController],
  providers: [{ provide: DB, useFactory: () => createDb() }, BriefsService, BriefResultsConsumer, AuthService, ReposService, RepoResultsConsumer],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true }); // rawBody: GitHub webhook HMAC
  // credentials: the browser must send the gc_session cookie from the web origin(s).
  app.enableCors({ origin: WEB_ORIGINS, credentials: true });
  app.enableShutdownHooks();
  const port = Number(process.env.CORE_API_PORT ?? 4000);
  await app.listen(port);
  console.log(`core-api listening on :${port}`);
}

void bootstrap();
