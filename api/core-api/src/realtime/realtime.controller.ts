import { Controller, Get, Inject, NotFoundException, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { RealtimeToken } from '@grabcode/contracts/schemas';
import { readCookie } from '../auth/auth.controller';
import { AuthService, SESSION_COOKIE } from '../auth/auth.service';
import { CENTRIFUGO_SECRET, REALTIME_WS_URL } from '../config';
import { connectionToken } from './token';

@Controller('v1/realtime')
export class RealtimeController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get('token')
  async token(@Req() req: Request): Promise<RealtimeToken> {
    const user = await this.auth.requireUser(readCookie(req, SESSION_COOKIE));
    if (!CENTRIFUGO_SECRET) throw new NotFoundException({ message: 'Realtime not configured' });
    return { url: REALTIME_WS_URL, token: connectionToken(user.id, CENTRIFUGO_SECRET) };
  }
}
