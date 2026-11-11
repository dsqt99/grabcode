import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { OrderIdSchema, RepoCreateSchema, type OrderRepo } from '@grabcode/contracts/schemas';
import { readCookie } from '../auth/auth.controller';
import { AuthService, SESSION_COOKIE } from '../auth/auth.service';
import { GITHUB_APP_WEBHOOK_SECRET } from '../config';
import { ReposService } from './repos.service';

/** Constant-time check of GitHub's `sha256=<hex>` HMAC over the raw request body. */
export const validSignature = (secret: string, raw: Buffer, header: string | undefined) => {
  if (!secret || !header) return false;
  const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`);
  const got = Buffer.from(header);
  return got.length === expected.length && timingSafeEqual(got, expected);
};

@Controller('v1')
export class ReposController {
  constructor(
    @Inject(ReposService) private readonly repos: ReposService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Post('repos')
  @HttpCode(202)
  async request(@Req() req: Request, @Body() body: unknown): Promise<OrderRepo> {
    const user = await this.auth.requireUser(readCookie(req, SESSION_COOKIE));
    const parsed = RepoCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ message: 'Invalid request body', issues: parsed.error.issues });
    return this.repos.request(user, parsed.data);
  }

  // shortcut: any signed-in user can read any order's repo status; scope to the order's customer/coder once orders live in the backend.
  @Get('repos/:orderId')
  async get(@Req() req: Request, @Param('orderId') orderId: string): Promise<OrderRepo> {
    await this.auth.requireUser(readCookie(req, SESSION_COOKIE));
    const repo = OrderIdSchema.safeParse(orderId).success ? await this.repos.get(orderId) : undefined;
    if (!repo) throw new NotFoundException({ message: 'Repo not found' });
    return repo;
  }

  /** GitHub App webhook. Only `push` is used (commit timeline); other events are acknowledged and dropped. */
  @Post('github/webhook')
  @HttpCode(204)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-github-event') event: string | undefined,
  ): Promise<void> {
    if (!validSignature(GITHUB_APP_WEBHOOK_SECRET, req.rawBody ?? Buffer.alloc(0), signature)) {
      throw new UnauthorizedException({ message: 'Bad signature' });
    }
    if (event !== 'push') return;
    const body = req.body as { repository?: { full_name?: string }; commits?: Parameters<ReposService['recordPush']>[1] };
    if (body.repository?.full_name) await this.repos.recordPush(body.repository.full_name, body.commits ?? []);
  }
}
