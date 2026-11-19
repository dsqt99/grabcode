import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { AckPolicy, connect, type ConsumerMessages, type NatsConnection } from 'nats';
import {
  DeployExpiredEventSchema,
  DeployFailedEventSchema,
  DeployReadyEventSchema,
  QaCompletedEventSchema,
  STREAM_NAME,
  STREAM_SUBJECTS,
  SUBJECTS,
} from '@grabcode/contracts/schemas';
import { OrdersService } from './orders.service';

const DURABLE = 'core-api-qa-deploy-results';

/** Applies qa-worker (qa.completed) and deploy-worker (deploy.ready / failed / expired) results to the order. */
@Injectable()
export class WorkerResultsConsumer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(WorkerResultsConsumer.name);
  private nc?: NatsConnection;
  private messages?: ConsumerMessages;

  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  async onApplicationBootstrap() {
    this.nc = await connect({ servers: process.env.NATS_URL ?? 'nats://127.0.0.1:4223' });
    const jsm = await this.nc.jetstreamManager();
    await jsm.streams
      .add({ name: STREAM_NAME, subjects: STREAM_SUBJECTS })
      .catch(() => jsm.streams.update(STREAM_NAME, { subjects: STREAM_SUBJECTS }));
    const filter_subjects = [SUBJECTS.QA_COMPLETED, SUBJECTS.DEPLOY_READY, SUBJECTS.DEPLOY_FAILED, SUBJECTS.DEPLOY_EXPIRED];
    await jsm.consumers
      .add(STREAM_NAME, { durable_name: DURABLE, ack_policy: AckPolicy.Explicit, filter_subjects, max_deliver: 10 })
      .catch(() => jsm.consumers.update(STREAM_NAME, DURABLE, { filter_subjects }));
    this.messages = await (await this.nc.jetstream().consumers.get(STREAM_NAME, DURABLE)).consume();
    void this.loop();
  }

  private async loop() {
    for await (const m of this.messages!) {
      try {
        const body = m.json<unknown>();
        if (m.subject === SUBJECTS.QA_COMPLETED) {
          const d = QaCompletedEventSchema.parse(body).data;
          await this.orders.applyQa(d.orderId, d.milestoneId, d.result);
        } else if (m.subject === SUBJECTS.DEPLOY_READY) {
          const d = DeployReadyEventSchema.parse(body).data;
          await this.orders.applySandbox(d.orderId, { status: 'READY', url: d.url, error: null, expiresAt: d.expiresAt });
        } else if (m.subject === SUBJECTS.DEPLOY_FAILED) {
          const d = DeployFailedEventSchema.parse(body).data;
          await this.orders.applySandbox(d.orderId, { status: 'FAILED', url: null, error: d.error, expiresAt: null });
        } else {
          const d = DeployExpiredEventSchema.parse(body).data;
          await this.orders.applySandbox(d.orderId, { status: 'EXPIRED', url: null, error: null, expiresAt: null });
        }
        m.ack();
      } catch (err) {
        this.log.error(`Failed to apply ${m.subject}: ${String(err)}`);
        m.nak(2 ** Math.min(m.info.deliveryCount, 6) * 500);
      }
    }
  }

  async onApplicationShutdown() {
    await this.messages?.close();
    await this.nc?.drain();
  }
}
