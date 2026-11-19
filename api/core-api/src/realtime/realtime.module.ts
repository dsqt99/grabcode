import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HintJanitor } from './janitor';
import { RealtimeController } from './realtime.controller';

@Module({ imports: [AuthModule], controllers: [RealtimeController], providers: [HintJanitor] })
export class RealtimeModule {}
