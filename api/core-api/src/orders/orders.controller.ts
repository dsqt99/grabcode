import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  MilestoneCompleteSchema,
  OrderCreateSchema,
  OrderListQuerySchema,
  OrderTransitionSchema,
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
    return this.orders.transition(user, id, parse(OrderTransitionSchema, body).status);
  }

  @Post(':id/milestones/:milestoneId/complete')
  @HttpCode(200)
  async completeMilestone(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() body: unknown,
  ): Promise<OrderDto> {
    const user = await this.user(req);
    return this.orders.completeMilestone(user, id, milestoneId, parse(MilestoneCompleteSchema, body ?? {}).commitHash ?? null);
  }
}
