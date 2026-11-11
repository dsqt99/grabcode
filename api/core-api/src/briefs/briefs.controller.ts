import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { BriefJobCreateSchema, type BriefJob } from '@grabcode/contracts/schemas';
import { z } from 'zod';
import { BriefsService } from './briefs.service';

const IdSchema = z.string().uuid();

@Controller('v1/briefs')
export class BriefsController {
  constructor(@Inject(BriefsService) private readonly briefs: BriefsService) {}

  @Post()
  @HttpCode(202)
  create(@Body() body: unknown): Promise<BriefJob> {
    const parsed = BriefJobCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Invalid request body', issues: parsed.error.issues });
    }
    return this.briefs.create(parsed.data);
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<BriefJob> {
    const job = IdSchema.safeParse(id).success ? await this.briefs.get(id) : undefined;
    if (!job) throw new NotFoundException({ message: 'Brief job not found' });
    return job;
  }
}
