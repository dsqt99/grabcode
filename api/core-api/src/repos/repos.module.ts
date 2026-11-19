import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { RepoResultsConsumer } from './repos.consumer';
import { ReposController } from './repos.controller';
import { ReposService } from './repos.service';

@Module({ imports: [AuthModule, OrdersModule], controllers: [ReposController], providers: [ReposService, RepoResultsConsumer], exports: [ReposService] })
export class ReposModule {}
