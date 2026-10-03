import { Global, Module } from "@nestjs/common";

import { EventHandlerRegistry } from "./event-handler.js";

export const EVENT_HANDLER_REGISTRY = Symbol("EVENT_HANDLER_REGISTRY");

/**
 * One registry for the whole application. Modules add their handlers to it
 * when they start; the worker reads it to deliver events.
 */
@Global()
@Module({
  exports: [EVENT_HANDLER_REGISTRY],
  providers: [{ provide: EVENT_HANDLER_REGISTRY, useValue: new EventHandlerRegistry() }],
})
export class EventsModule {}
