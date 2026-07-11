/**
 * In-process, per-user live-event bus for the SSE stream (`GET /events`,
 * Design API §7 "Live", Req 56).
 *
 * Events originate in two places:
 *  1. In-process producers (this API) call {@link emitToUser} directly.
 *  2. The worker publishes events to Redis (channel {@link EVENTS_CHANNEL});
 *     this service subscribes and re-emits them onto the in-process bus so
 *     connected SSE clients receive worker-driven updates (run status, export
 *     status, opportunity changes) without polling.
 *
 * Isolation: every event carries a `userId`; {@link subscribe} filters the bus
 * so a client only ever receives its OWN events (PRIV-006 / Req 54). The Redis
 * bridge is best-effort — connection errors are logged and never crash the API
 * (graceful degradation, Req 55); if Redis is unavailable, in-process events
 * still flow.
 */
import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { Redis } from 'ioredis';
import type { Config } from '@careerstack/config';
import { liveEventSchema, type LiveEvent } from '@careerstack/contracts';
import type { Logger } from '@careerstack/observability';
import { CONFIG, LOGGER } from '../common/di-tokens.js';

/** Redis pub/sub channel the worker publishes user-scoped live events on. */
export const EVENTS_CHANNEL = 'cs:events';

/** A live event tagged with the owning user (never leaves the server as-is). */
interface UserScopedEvent {
  userId: string;
  event: LiveEvent;
}

/** The SSE message shape Nest serializes (`data:` is JSON-stringified). */
export interface SseMessage {
  data: LiveEvent;
}

@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private readonly bus = new Subject<UserScopedEvent>();
  private subscriber: Redis | null = null;

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  onModuleInit(): void {
    // Bridge worker-published events into the in-process bus. Best-effort: any
    // failure is logged and swallowed so the API keeps serving in-process events.
    try {
      const subscriber = new Redis(this.config.redis.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: null,
        // Keep trying to reconnect, but never let a failed command reject loudly.
        retryStrategy: (times) => Math.min(times * 200, 5_000),
      });

      subscriber.on('error', (err: unknown) => {
        this.logger.warn('events: redis subscriber error', {
          error: err instanceof Error ? err.message : String(err),
        });
      });

      subscriber.on('message', (_channel: string, payload: string) => {
        this.ingestRedisPayload(payload);
      });

      void subscriber
        .connect()
        .then(() => subscriber.subscribe(EVENTS_CHANNEL))
        .catch((err: unknown) => {
          this.logger.warn('events: redis subscribe failed', {
            error: err instanceof Error ? err.message : String(err),
          });
        });

      this.subscriber = subscriber;
    } catch (err) {
      this.logger.warn('events: redis bridge unavailable', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.bus.complete();
    if (this.subscriber) {
      try {
        await this.subscriber.quit();
      } catch {
        this.subscriber.disconnect();
      }
      this.subscriber = null;
    }
  }

  /** Emit an event to a single user's connected SSE clients (in-process). */
  emitToUser(userId: string, event: LiveEvent): void {
    this.bus.next({ userId, event });
  }

  /**
   * A per-user stream of SSE messages. Filters the shared bus down to the
   * requesting user's events only, so no cross-user data ever leaks (Req 54).
   */
  subscribe(userId: string): Observable<SseMessage> {
    return this.bus.asObservable().pipe(
      filter((scoped) => scoped.userId === userId),
      map((scoped): SseMessage => ({ data: scoped.event })),
    );
  }

  /** Parse + validate a Redis payload and forward it to the bus (defensive). */
  private ingestRedisPayload(payload: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      this.logger.warn('events: dropped non-JSON redis payload');
      return;
    }

    const envelope = parsed as { userId?: unknown; event?: unknown };
    if (typeof envelope.userId !== 'string') {
      this.logger.warn('events: dropped redis payload without userId');
      return;
    }

    const event = liveEventSchema.safeParse(envelope.event);
    if (!event.success) {
      this.logger.warn('events: dropped invalid live event payload');
      return;
    }

    this.emitToUser(envelope.userId, event.data);
  }
}
