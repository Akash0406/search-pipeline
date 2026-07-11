/**
 * EventsModule — the live-updates (SSE) surface (Design API §7 "Live", Req 56).
 *
 * Imports {@link AuthModule} so the exported session guard + `@CurrentUser()`
 * resolve the authenticated owner on the stream. {@link EventsService} is
 * exported and the module is `@Global` so in-process producers (e.g. the
 * privacy/export flow) can inject it to push user-scoped events; worker-driven
 * events arrive via the service's Redis bridge.
 */
import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
