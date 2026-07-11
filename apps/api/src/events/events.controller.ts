/**
 * Live updates stream (Design API §7 "Live", Req 56):
 *   GET /events — Server-Sent Events for run status, opportunity changes, and
 *   export status, scoped to the authenticated user.
 *
 * Authentication: the global {@link SessionAuthGuard} applies (cookie-based), so
 * only signed-in users can open the stream and `@CurrentUser()` resolves the
 * owner. Events are filtered per-user in {@link EventsService.subscribe}, so a
 * client can never observe another user's activity (PRIV-006 / Req 54).
 *
 * A periodic heartbeat comment keeps intermediaries from closing an idle
 * connection and lets the client detect a dead stream; when the client
 * disconnects, RxJS tears the subscription down automatically (no crash, no
 * leak — Req 55 graceful degradation).
 */
import { Controller, Sse, type MessageEvent } from '@nestjs/common';
import { Observable, interval, merge } from 'rxjs';
import { map } from 'rxjs/operators';
import { CurrentUser } from '../common/decorators.js';
import type { AuthenticatedUser } from '../common/request-context.js';
import { EventsService } from './events.service.js';

/** Heartbeat cadence (ms) — emitted as a keep-alive comment event. */
const HEARTBEAT_MS = 25_000;

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Sse()
  stream(@CurrentUser() user: AuthenticatedUser): Observable<MessageEvent> {
    const heartbeat = interval(HEARTBEAT_MS).pipe(
      map((): MessageEvent => ({ type: 'heartbeat', data: { ts: Date.now() } })),
    );

    const userEvents = this.events
      .subscribe(user.id)
      .pipe(map((message): MessageEvent => ({ data: message.data })));

    return merge(userEvents, heartbeat);
  }
}
