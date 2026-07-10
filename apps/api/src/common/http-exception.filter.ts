/**
 * Global exception filter producing the standard error envelope
 * `{ error: { code, message, requestId, details } }` (Design API §7).
 *
 * Maps HTTP status codes to the contract's error-code vocabulary and echoes the
 * per-request id (Fastify `request.id`) so clients can correlate failures.
 */
import { Catch, HttpException, HttpStatus, Inject } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ErrorCode } from '@careerstack/contracts';
import type { Logger } from '@careerstack/observability';
import { LOGGER } from './di-tokens.js';

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const requestId = String(request.id ?? '');

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const code: ErrorCode = STATUS_TO_CODE[status] ?? 'INTERNAL';

    let message = 'An unexpected error occurred.';
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
      } else if (response && typeof response === 'object' && 'message' in response) {
        const raw = (response as { message: unknown }).message;
        message = Array.isArray(raw) ? raw.join('; ') : String(raw);
      }
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error('request.unhandled_error', { error: exception, requestId });
    }

    void reply.status(status).send({
      error: { code, message, requestId, details: [] },
    });
  }
}
