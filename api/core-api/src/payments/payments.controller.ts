import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Inject, NotFoundException, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { DevDepositSchema, orderIdFromTransfer, SepayWebhookSchema, type PaymentInstructions, type Wallet } from '@grabcode/contracts/schemas';
import { readCookie } from '../auth/auth.controller';
import { AuthService, SESSION_COOKIE } from '../auth/auth.service';
import { DEV_LOGIN_ENABLED, PAYMENT_ACCOUNT_NUMBER, SEPAY_WEBHOOK_API_KEY } from '../config';
import { PaymentsService } from './payments.service';

/** SePay sends `Authorization: Apikey <key>`; constant-time compare, unset key rejects everything. */
export const validApiKey = (key: string, header: string | undefined) => {
  if (!key || !header) return false;
  const expected = Buffer.from(`Apikey ${key}`);
  const got = Buffer.from(header);
  return got.length === expected.length && timingSafeEqual(got, expected);
};

@Controller('v1')
export class PaymentsController {
  constructor(
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  private user(req: Request) {
    return this.auth.requireUser(readCookie(req, SESSION_COOKIE));
  }

  @Get('orders/:id/payment')
  async instructions(@Req() req: Request, @Param('id') id: string): Promise<PaymentInstructions> {
    return this.payments.instructions(await this.user(req), id);
  }

  @Get('me/wallet')
  async wallet(@Req() req: Request): Promise<Wallet> {
    return this.payments.wallet(await this.user(req));
  }

  @Post('payments/dev-deposit')
  @HttpCode(200)
  async devDeposit(@Req() req: Request, @Body() body: unknown): Promise<PaymentInstructions> {
    if (!DEV_LOGIN_ENABLED) throw new NotFoundException();
    const user = await this.user(req);
    const parsed = DevDepositSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ message: 'Invalid request body', issues: parsed.error.issues });
    return this.payments.devDeposit(user, parsed.data.orderId);
  }

  /** SePay needs 2xx + {success:true} or it retries; a repeated id is acknowledged as a no-op. */
  @Post('payments/sepay/webhook')
  @HttpCode(200)
  async sepay(@Headers('authorization') auth: string | undefined, @Body() body: unknown) {
    if (!validApiKey(SEPAY_WEBHOOK_API_KEY, auth)) throw new UnauthorizedException();
    const parsed = SepayWebhookSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ message: 'Invalid request body', issues: parsed.error.issues });
    const t = parsed.data;
    const ours = !PAYMENT_ACCOUNT_NUMBER || t.accountNumber === PAYMENT_ACCOUNT_NUMBER;
    if (t.transferType === 'in' && ours && t.transferAmount > 0) {
      await this.payments.recordDeposit(`sepay:${t.id}`, orderIdFromTransfer(t.code, t.content), t.transferAmount, t);
    }
    return { success: true };
  }
}
