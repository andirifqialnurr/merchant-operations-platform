import type { ModuleKey } from "@merchant/contracts";

/**
 * An event as a handler receives it: the contract, not the database row.
 * Events written before the envelope columns existed have no producer,
 * correlation, or actor.
 */
export type EventEnvelope = {
  actor: { id: string | null; type: "DEVICE" | "INTEGRATION" | "SYSTEM" | "USER" } | null;
  causationId: string | null;
  correlationId: string | null;
  eventId: string;
  eventType: string;
  eventVersion: number;
  locationId: string | null;
  occurredAt: Date;
  payload: Record<string, unknown>;
  producer: string | null;
  recordedAt: Date;
  workspaceId: string;
};

/**
 * One module's reaction to one event type. It must be idempotent (the same
 * event may arrive again after a crash) and must call the module's own use
 * cases rather than write tables directly.
 */
export type EventHandler = {
  /** Unique name, also the inbox key, e.g. "kds.create_ticket". */
  consumerName: string;
  eventType: string;
  /** May return a reference to what it produced, stored in the inbox. */
  handle(event: EventEnvelope): Promise<string | void>;
  /** The module that reacts; it must be usable for the workspace. */
  moduleKey: ModuleKey;
};

/**
 * Thrown by a handler when retrying cannot help until someone fixes a setting
 * or the data (architecture.md 7.1). The message is stored and shown, so it
 * must be safe: no payload values, no secrets.
 */
export class BlockedEventError extends Error {
  constructor(safeReason: string) {
    super(safeReason);
    this.name = "BlockedEventError";
  }
}

/** Collects the handlers that modules register when the application starts. */
export class EventHandlerRegistry {
  private readonly handlers: EventHandler[] = [];

  register(handler: EventHandler) {
    if (this.handlers.some((item) => item.consumerName === handler.consumerName)) {
      throw new Error(`Event handler ${handler.consumerName} is registered twice.`);
    }
    this.handlers.push(handler);
  }

  all(): readonly EventHandler[] {
    return this.handlers;
  }

  for(eventType: string) {
    return this.handlers.filter((handler) => handler.eventType === eventType);
  }
}
