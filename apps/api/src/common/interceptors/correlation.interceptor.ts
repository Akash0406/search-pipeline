/**
 * Correlation interceptor (Design Architecture — trace/correlation propagation;
 * API §7 request-ID assignment).
 *
 * Binds the Fastify per-request id (assigned by `genReqId` in `main.ts`, which
 * doubles as the correlation id) into the ambient {@link runWithContext} store
 * for the duration of the handler. Because the handler is subscribed INSIDE the
 * `runWithContext` callback, the correlation id propagates across every `await`
 * in the request — into the structured logger and, crucially, into any job
 * enqueued during the request (the producer reads it via
 * {@link getOrCreateCorrelationId}), so a logical operation keeps ONE id from
 * the HTTP request through the queue into the worker.
 *
 * The `X-Request-Id` response header is echoed by a Fastify `onSend` hook in
 * `main.ts` (so it covers error responses too); this interceptor is solely
 * responsible for the ambient-context propagation.
 */
import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { getOrCreateCorrelationId, runWithContext } from '@careerstack/observability';

@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const correlationId = String(request.id ?? getOrCreateCorrelationId());

    return new Observable((subscriber) => {
      runWithContext({ correlationId }, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
