import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeController } from './realtime.controller';

@Module({ imports: [AuthModule], controllers: [RealtimeController] })
export class RealtimeModule {}
