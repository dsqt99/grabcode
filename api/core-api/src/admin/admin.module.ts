import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReposModule } from '../repos/repos.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({ imports: [AuthModule, ReposModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
