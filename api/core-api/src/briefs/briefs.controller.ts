import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '../auth/throttle';
import { BriefJobCreateSchema, type BriefJob } from '@grabcode/contracts/schemas';
import { z } from 'zod';
import { BriefsService } from './briefs.service';

const IdSchema = z.string().uuid();

@Controller('v1/briefs')
export class BriefsController {
  constructor(@Inject(BriefsService) private readonly briefs: BriefsService) {}

  /** Briefs are public (landing page, before login) and each one costs an LLM call: cap per IP. */
  private readonly perIp = new Throttle(20, 3600_000);

  @Post()
  @HttpCode(202)
  create(@Req() req: Request, @Body() body: unknown): Promise<BriefJob> {
    const ip = req.ip ?? '';
    if (this.perIp.blocked(ip)) throw new HttpException({ message: 'Too many briefs, retry later' }, HttpStatus.TOO_MANY_REQUESTS);
    const parsed = BriefJobCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ message: 'Invalid request body', issues: parsed.error.issues });
    }
    this.perIp.fail(ip);
    return this.briefs.create(parsed.data);
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<BriefJob> {
    const job = IdSchema.safeParse(id).success ? await this.briefs.get(id) : undefined;
    if (!job) throw new NotFoundException({ message: 'Brief job not found' });
    return job;
  }
}
