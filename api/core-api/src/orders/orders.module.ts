import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { WorkerResultsConsumer } from './worker-results.consumer';

@Module({ imports: [AuthModule], controllers: [OrdersController], providers: [OrdersService, WorkerResultsConsumer], exports: [OrdersService] })
export class OrdersModule {}
