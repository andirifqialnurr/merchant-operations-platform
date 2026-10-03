import type { ModuleKey } from "@merchant/contracts";

import {
  BlockedEventError,
  type EventEnvelope,
  type EventHandler,
  type EventHandlerRegistry,
} from "./event-handler.js";

export type InboxStatus = "BLOCKED" | "FAILED" | "PROCESSED" | "RETRYING";

/** A claimed outbox event: the envelope plus how often it has been attempted. */
export type ClaimedEvent = { attempt: number; envelope: EventEnvelope };

export interface OutboxStore {
  /**
   * Takes up to `limit` due events for this dispatcher and hides them from
   * others until `leaseMs` has passed. Each claim counts as one attempt.
   */
  claim(limit: number, leaseMs: number, now: Date): Promise<ClaimedEvent[]>;
  markFailed(eventId: string, error: string, now: Date): Promise<void>;
  markProcessed(eventId: string, now: Date): Promise<void>;
  /** Makes the event due again at `availableAt`. */
  reschedule(eventId: string, error: string, availableAt: Date): Promise<void>;
}

export interface InboxStore {
  find(workspaceId: string, consumerName: string, eventId: string): Promise<InboxStatus | null>;
  record(entry: {
    consumerName: string;
    error?: string;
    eventId: string;
    eventType: string;
    resultReference?: string;
    status: InboxStatus;
    workspaceId: string;
  }): Promise<void>;
}

/** Whether a module can react for a workspace: entitled and, if commercial, installed and active. */
export type ModuleAvailability = (workspaceId: string, moduleKey: ModuleKey) => Promise<boolean>;

export type DispatcherOptions = {
  baseDelayMs: number;
  batchSize: number;
  /** How long a claimed event stays hidden; longer than any handler should take. */
  leaseMs: number;
  maxAttempts: number;
  maxDelayMs: number;
};

export const DEFAULT_DISPATCHER_OPTIONS: DispatcherOptions = {
  baseDelayMs: 2_000,
  batchSize: 20,
  leaseMs: 60_000,
  maxAttempts: 8,
  maxDelayMs: 15 * 60_000,
};

type HandlerOutcome = "blocked" | "done" | "retry";

/** A message that is safe to store: one line, bounded, never the payload. */
function safeMessage(error: unknown) {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return text.replace(/\s+/g, " ").slice(0, 500);
}

/**
 * Delivers outbox events to their handlers (architecture.md 7.1, backend.md
 * 6.2). An event is finished once every handler has either processed it or
 * been blocked by a problem that retrying cannot fix; otherwise it comes back
 * later with a growing delay, and is set aside after `maxAttempts`.
 */
export class OutboxDispatcher {
  constructor(
    private readonly outbox: OutboxStore,
    private readonly inbox: InboxStore,
    private readonly handlers: EventHandlerRegistry,
    private readonly isModuleAvailable: ModuleAvailability,
    private readonly options: DispatcherOptions = DEFAULT_DISPATCHER_OPTIONS,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Claims and delivers one batch. Returns how many events were taken. */
  async dispatchBatch() {
    const claimed = await this.outbox.claim(
      this.options.batchSize,
      this.options.leaseMs,
      this.now(),
    );
    for (const event of claimed) await this.deliver(event);
    return claimed.length;
  }

  private async deliver({ attempt, envelope }: ClaimedEvent) {
    const outcomes: Array<{ error?: string; handler: EventHandler; outcome: HandlerOutcome }> = [];
    for (const handler of this.handlers.for(envelope.eventType)) {
      outcomes.push({ handler, ...(await this.run(handler, envelope)) });
    }

    const waiting = outcomes.filter((item) => item.outcome === "retry");
    if (waiting.length === 0) {
      // Also the case when nobody listens: an event without receivers is simply done.
      await this.outbox.markProcessed(envelope.eventId, this.now());
      return;
    }

    const summary = waiting
      .map((item) => `${item.handler.consumerName}: ${item.error ?? "not ready"}`)
      .join("; ")
      .slice(0, 500);
    if (attempt >= this.options.maxAttempts) {
      for (const item of waiting) {
        await this.inbox.record({
          consumerName: item.handler.consumerName,
          error: item.error ?? "The module was not ready before the attempts ran out.",
          eventId: envelope.eventId,
          eventType: envelope.eventType,
          status: "FAILED",
          workspaceId: envelope.workspaceId,
        });
      }
      await this.outbox.markFailed(envelope.eventId, summary, this.now());
      return;
    }
    const delay = Math.min(
      this.options.baseDelayMs * 2 ** Math.max(attempt - 1, 0),
      this.options.maxDelayMs,
    );
    await this.outbox.reschedule(envelope.eventId, summary, new Date(this.now().getTime() + delay));
  }

  private async run(
    handler: EventHandler,
    envelope: EventEnvelope,
  ): Promise<{ error?: string; outcome: HandlerOutcome }> {
    const key = [envelope.workspaceId, handler.consumerName, envelope.eventId] as const;
    const known = await this.inbox.find(...key);
    // Delivered before: processed stays processed, blocked waits for a person.
    if (known === "PROCESSED") return { outcome: "done" };
    if (known === "BLOCKED" || known === "FAILED") return { outcome: "blocked" };

    const entry = {
      consumerName: handler.consumerName,
      eventId: envelope.eventId,
      eventType: envelope.eventType,
      workspaceId: envelope.workspaceId,
    };
    // A module that is not installed or not active does not get the event
    // marked as handled; it waits (backend.md 6.2 rule 3).
    if (!(await this.isModuleAvailable(envelope.workspaceId, handler.moduleKey))) {
      const error = `Module ${handler.moduleKey} is not active for this workspace.`;
      await this.inbox.record({ ...entry, error, status: "RETRYING" });
      return { error, outcome: "retry" };
    }

    try {
      const reference = await handler.handle(envelope);
      await this.inbox.record({
        ...entry,
        ...(reference ? { resultReference: reference } : {}),
        status: "PROCESSED",
      });
      return { outcome: "done" };
    } catch (error) {
      const message = safeMessage(error);
      if (error instanceof BlockedEventError) {
        await this.inbox.record({ ...entry, error: message, status: "BLOCKED" });
        return { error: message, outcome: "blocked" };
      }
      await this.inbox.record({ ...entry, error: message, status: "RETRYING" });
      return { error: message, outcome: "retry" };
    }
  }
}
