import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PresenceSchema, type OfferList, type OrderDto, type Presence } from '@grabcode/contracts/schemas';
import { readCookie } from '../auth/auth.controller';
import { AuthService, SESSION_COOKIE } from '../auth/auth.service';
import { DispatchService } from './dispatch.service';

@Controller('v1')
export class DispatchController {
  constructor(
    @Inject(DispatchService) private readonly dispatch: DispatchService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  private user(req: Request) {
    return this.auth.requireUser(readCookie(req, SESSION_COOKIE));
  }

  @Get('me/offers')
  async offers(@Req() req: Request): Promise<OfferList> {
    return { offers: await this.dispatch.offers(await this.user(req)) };
  }

  @Get('me/presence')
  async presence(@Req() req: Request): Promise<Presence> {
    return this.dispatch.presence(await this.user(req));
  }

  @Put('me/presence')
  async setPresence(@Req() req: Request, @Body() body: unknown): Promise<Presence> {
    const user = await this.user(req);
    const parsed = PresenceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ message: 'Invalid request body', issues: parsed.error.issues });
    return this.dispatch.setPresence(user, parsed.data.online);
  }

  @Post('offers/:id/accept')
  @HttpCode(200)
  async accept(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string): Promise<OrderDto> {
    return this.dispatch.accept(await this.user(req), id);
  }

  @Post('offers/:id/decline')
  @HttpCode(204)
  async decline(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.dispatch.decline(await this.user(req), id);
  }
}
