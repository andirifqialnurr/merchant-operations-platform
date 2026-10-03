// The only entry point other parts of the API may import from this folder.
// Enforced by scripts/check-boundaries.mjs.
export { BlockedEventError, EventHandlerRegistry } from "./event-handler.js";
export type { EventEnvelope, EventHandler } from "./event-handler.js";
export { EVENT_HANDLER_REGISTRY, EventsModule } from "./events.module.js";
export { ALWAYS_RUN, DEFAULT_DISPATCHER_OPTIONS, OutboxDispatcher } from "./outbox-dispatcher.js";
export type {
  BindingDecision,
  BindingGate,
  DispatcherOptions,
  ModuleAvailability,
} from "./outbox-dispatcher.js";
export { PrismaInboxStore, PrismaOutboxStore } from "./prisma-event-stores.js";
