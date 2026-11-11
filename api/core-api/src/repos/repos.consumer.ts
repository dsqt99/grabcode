import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { AckPolicy, connect, type ConsumerMessages, type NatsConnection } from 'nats';
import {
  RepoFailedEventSchema,
  RepoHandedOverEventSchema,
  RepoProvisionedEventSchema,
  STREAM_NAME,
  STREAM_SUBJECTS,
  SUBJECTS,
} from '@grabcode/contracts/schemas';
import { ReposService } from './repos.service';

const DURABLE = 'core-api-repo-results';

/** Applies repo-worker results (repo.provisioned / repo.failed / repo.handed_over) back to Postgres. */
@Injectable()
export class RepoResultsConsumer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(RepoResultsConsumer.name);
  private nc?: NatsConnection;
  private messages?: ConsumerMessages;

  constructor(@Inject(ReposService) private readonly repos: ReposService) {}

  async onApplicationBootstrap() {
    this.nc = await connect({ servers: process.env.NATS_URL ?? 'nats://127.0.0.1:4223' });
    const jsm = await this.nc.jetstreamManager();
    // add is a no-op for an identical config; update picks up subjects added to the contract later.
    await jsm.streams
      .add({ name: STREAM_NAME, subjects: STREAM_SUBJECTS })
      .catch(() => jsm.streams.update(STREAM_NAME, { subjects: STREAM_SUBJECTS }));
    const filter_subjects = [SUBJECTS.REPO_PROVISIONED, SUBJECTS.REPO_FAILED, SUBJECTS.REPO_HANDED_OVER];
    // add rejects a changed config on an existing durable; update widens its filter in place.
    await jsm.consumers
      .add(STREAM_NAME, { durable_name: DURABLE, ack_policy: AckPolicy.Explicit, filter_subjects, max_deliver: 10 })
      .catch(() => jsm.consumers.update(STREAM_NAME, DURABLE, { filter_subjects }));
    const consumer = await this.nc.jetstream().consumers.get(STREAM_NAME, DURABLE);
    this.messages = await consumer.consume();
    void this.loop();
  }

  private async loop() {
    for await (const m of this.messages!) {
      try {
        const body = m.json<unknown>();
        if (m.subject === SUBJECTS.REPO_PROVISIONED) {
          await this.repos.markReady(RepoProvisionedEventSchema.parse(body).data);
        } else if (m.subject === SUBJECTS.REPO_HANDED_OVER) {
          const d = RepoHandedOverEventSchema.parse(body).data;
          await this.repos.markHandedOver(d.orderId, d.customerGithubLogin);
        } else {
          const e = RepoFailedEventSchema.parse(body);
          await this.repos.markFailed(e.data.orderId, e.data.error);
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
