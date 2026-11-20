import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  ChatSendSchema,
  MilestoneRejectSchema,
  MilestoneSubmitSchema,
  OrderCreateSchema,
  OrderListQuerySchema,
  OrderTransitionSchema,
  type ChatList,
  type ChatMessage,
  type OrderDto,
  type OrderList,
} from '@grabcode/contracts/schemas';
import type { z } from 'zod';
import { readCookie } from '../auth/auth.controller';
import { AuthService, SESSION_COOKIE } from '../auth/auth.service';
import { OrdersService } from './orders.service';

const parse = <S extends z.ZodTypeAny>(schema: S, body: unknown): z.output<S> => {
  const r = schema.safeParse(body);
  if (!r.success) throw new BadRequestException({ message: 'Invalid request', issues: r.error.issues });
  return r.data;
};

@Controller('v1/orders')
export class OrdersController {
  constructor(
    @Inject(OrdersService) private readonly orders: OrdersService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  private user(req: Request) {
    return this.auth.requireUser(readCookie(req, SESSION_COOKIE));
  }

  @Post()
  @HttpCode(201)
  async create(@Req() req: Request, @Body() body: unknown): Promise<OrderDto> {
    const user = await this.user(req);
    return this.orders.create(user, parse(OrderCreateSchema, body));
  }

  @Get()
  async list(@Req() req: Request, @Query() query: unknown): Promise<OrderList> {
    const user = await this.user(req);
    parse(OrderListQuerySchema, query);
    return { orders: await this.orders.list(user) };
  }

  @Get(':id')
  async get(@Req() req: Request, @Param('id') id: string): Promise<OrderDto> {
    return this.orders.get(await this.user(req), id);
  }

  @Post(':id/transitions')
  @HttpCode(200)
  async transition(@Req() req: Request, @Param('id') id: string, @Body() body: unknown): Promise<OrderDto> {
    const user = await this.user(req);
    const { status, reason } = parse(OrderTransitionSchema, body);
    return this.orders.transition(user, id, status, reason);
  }

  @Post(':id/milestones/:milestoneId/submit')
  @HttpCode(200)
  async submitMilestone(@Req() req: Request, @Param('id') id: string, @Param('milestoneId') mid: string, @Body() body: unknown): Promise<OrderDto> {
    const user = await this.user(req);
    const { commitHash, deliveryUrl, note } = parse(MilestoneSubmitSchema, body ?? {});
    return this.orders.submitMilestone(user, id, mid, { commitHash: commitHash ?? null, deliveryUrl: deliveryUrl ?? null, note: note || null });
  }

  @Post(':id/milestones/:milestoneId/approve')
  @HttpCode(200)
  async approveMilestone(@Req() req: Request, @Param('id') id: string, @Param('milestoneId') mid: string): Promise<OrderDto> {
    return this.orders.reviewMilestone(await this.user(req), id, mid, true, null);
  }

  @Post(':id/milestones/:milestoneId/reject')
  @HttpCode(200)
  async rejectMilestone(@Req() req: Request, @Param('id') id: string, @Param('milestoneId') mid: string, @Body() body: unknown): Promise<OrderDto> {
    const user = await this.user(req);
    return this.orders.reviewMilestone(user, id, mid, false, parse(MilestoneRejectSchema, body).note);
  }

  @Get(':id/messages')
  async messages(@Req() req: Request, @Param('id') id: string): Promise<ChatList> {
    return { messages: await this.orders.messages(await this.user(req), id) };
  }

  @Post(':id/messages')
  @HttpCode(201)
  async send(@Req() req: Request, @Param('id') id: string, @Body() body: unknown): Promise<ChatMessage> {
    const user = await this.user(req);
    return this.orders.sendMessage(user, id, parse(ChatSendSchema, body).text);
  }
}
