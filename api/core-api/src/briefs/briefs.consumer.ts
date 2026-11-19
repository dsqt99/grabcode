import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { AckPolicy, connect, type ConsumerMessages, type NatsConnection } from 'nats';
import {
  BriefFailedEventSchema,
  BriefGeneratedEventSchema,
  STREAM_NAME,
  STREAM_SUBJECTS,
  SUBJECTS,
} from '@grabcode/contracts/schemas';
import { BriefsService } from './briefs.service';

const DURABLE = 'core-api-brief-results';

/** Applies brief-worker results (brief.generated / brief.failed) back to Postgres. */
@Injectable()
export class BriefResultsConsumer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(BriefResultsConsumer.name);
  private nc?: NatsConnection;
  private messages?: ConsumerMessages;

  constructor(@Inject(BriefsService) private readonly briefs: BriefsService) {}

  async onApplicationBootstrap() {
    this.nc = await connect({ servers: process.env.NATS_URL ?? 'nats://127.0.0.1:4223' });
    const jsm = await this.nc.jetstreamManager();
    await jsm.streams
      .add({ name: STREAM_NAME, subjects: STREAM_SUBJECTS })
      .catch(() => jsm.streams.update(STREAM_NAME, { subjects: STREAM_SUBJECTS }));
    await jsm.consumers.add(STREAM_NAME, {
      durable_name: DURABLE,
      ack_policy: AckPolicy.Explicit,
      filter_subjects: [SUBJECTS.BRIEF_GENERATED, SUBJECTS.BRIEF_FAILED],
      max_deliver: 10,
    });
    const consumer = await this.nc.jetstream().consumers.get(STREAM_NAME, DURABLE);
    this.messages = await consumer.consume();
    void this.loop();
  }

  private async loop() {
    for await (const m of this.messages!) {
      try {
        const body = m.json<unknown>();
        if (m.subject === SUBJECTS.BRIEF_GENERATED) {
          const e = BriefGeneratedEventSchema.parse(body);
          await this.briefs.markReady(e.data.jobId, e.data.brief);
        } else {
          const e = BriefFailedEventSchema.parse(body);
          await this.briefs.markFailed(e.data.jobId, e.data.error);
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
