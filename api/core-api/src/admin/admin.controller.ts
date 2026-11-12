import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { z } from 'zod';
import {
  AdminCoderPatchSchema,
  DisputeResolveSchema,
  OrderIdSchema,
  PayoutCreateSchema,
  PayoutDecisionSchema,
  SuspenseResolveSchema,
  type AdminCoder,
  type AdminCoderList,
  type AdminOrder,
  type AdminOrderList,
  type Monitor,
  type Payout,
  type PayoutList,
  type SuspenseList,
} from '@grabcode/contracts/schemas';
import { readCookie } from '../auth/auth.controller';
import { AuthService, SESSION_COOKIE } from '../auth/auth.service';
import { AdminService } from './admin.service';

const parse = <S extends z.ZodTypeAny>(schema: S, body: unknown): z.output<S> => {
  const r = schema.safeParse(body);
  if (!r.success) throw new BadRequestException({ message: 'Invalid request', issues: r.error.issues });
  return r.data;
};

@Controller('v1')
export class AdminController {
  constructor(
    @Inject(AdminService) private readonly svc: AdminService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  /** ADMIN role is granted in the DB only; every admin route goes through here. */
  private async admin(req: Request) {
    const user = await this.auth.requireUser(readCookie(req, SESSION_COOKIE));
    if (!user.roles.includes('ADMIN')) throw new ForbiddenException({ message: 'Admin only' });
    return user;
  }

  // ---- Coder self-service payouts ----

  @Get('me/payouts')
  async myPayouts(@Req() req: Request): Promise<PayoutList> {
    return { payouts: await this.svc.myPayouts(await this.auth.requireUser(readCookie(req, SESSION_COOKIE))) };
  }

  @Post('me/payouts')
  async requestPayout(@Req() req: Request, @Body() body: unknown): Promise<Payout> {
    const user = await this.auth.requireUser(readCookie(req, SESSION_COOKIE));
    return this.svc.requestPayout(user, parse(PayoutCreateSchema, body));
  }

  // ---- Admin ----

  @Get('admin/coders')
  async coders(@Req() req: Request): Promise<AdminCoderList> {
    await this.admin(req);
    return { coders: await this.svc.coders() };
  }

  @Patch('admin/coders/:id')
  async patchCoder(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<AdminCoder> {
    await this.admin(req);
    return this.svc.patchCoder(id, parse(AdminCoderPatchSchema, body));
  }

  @Get('admin/orders')
  async orders(@Req() req: Request): Promise<AdminOrderList> {
    await this.admin(req);
    return { orders: await this.svc.orders() };
  }

  @Post('admin/orders/:id/resolve')
  @HttpCode(200)
  async resolve(@Req() req: Request, @Param('id') id: string, @Body() body: unknown): Promise<AdminOrder> {
    await this.admin(req);
    return this.svc.resolveDispute(parse(OrderIdSchema, id), parse(DisputeResolveSchema, body));
  }

  @Post('admin/orders/:id/refund')
  @HttpCode(200)
  async refund(@Req() req: Request, @Param('id') id: string): Promise<AdminOrder> {
    await this.admin(req);
    return this.svc.refund(parse(OrderIdSchema, id));
  }

  @Get('admin/suspense')
  async suspense(@Req() req: Request): Promise<SuspenseList> {
    await this.admin(req);
    return { items: await this.svc.suspense() };
  }

  @Post('admin/suspense/:txId/resolve')
  @HttpCode(204)
  async resolveSuspense(@Req() req: Request, @Param('txId') txId: string, @Body() body: unknown): Promise<void> {
    await this.admin(req);
    await this.svc.resolveSuspense(txId, parse(SuspenseResolveSchema, body).orderId);
  }

  @Get('admin/payouts')
  async payouts(@Req() req: Request): Promise<PayoutList> {
    await this.admin(req);
    return { payouts: await this.svc.allPayouts() };
  }

  @Post('admin/payouts/:id/decide')
  @HttpCode(200)
  async decide(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown): Promise<Payout> {
    return this.svc.decidePayout(await this.admin(req), id, parse(PayoutDecisionSchema, body));
  }

  @Get('admin/monitor')
  async monitor(@Req() req: Request): Promise<Monitor> {
    await this.admin(req);
    return this.svc.monitor();
  }

  @Post('admin/jobs/repo/:id/retry')
  @HttpCode(204)
  async retryRepo(@Req() req: Request, @Param('id') id: string): Promise<void> {
    await this.admin(req);
    await this.svc.retryRepo(parse(OrderIdSchema, id));
  }

  @Post('admin/jobs/sandbox/:id/retry')
  @HttpCode(204)
  async retrySandbox(@Req() req: Request, @Param('id') id: string): Promise<void> {
    await this.admin(req);
    await this.svc.retrySandbox(parse(OrderIdSchema, id));
  }
}
