import { Module } from '@nestjs/common';
import { BriefResultsConsumer } from './briefs.consumer';
import { BriefsController } from './briefs.controller';
import { BriefsService } from './briefs.service';

@Module({ controllers: [BriefsController], providers: [BriefsService, BriefResultsConsumer] })
export class BriefsModule {}
