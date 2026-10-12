import type { KitchenTicketStatus } from "@merchant/contracts";

/**
 * A ticket moves one way: received, accepted, being prepared, ready, served
 * (flowchart.md 8). Each status has exactly one next step, so the screen
 * shows one button and nothing can be skipped.
 */
const NEXT: Partial<Record<KitchenTicketStatus, KitchenTicketStatus>> = {
  ACCEPTED: "PREPARING",
  NEW: "ACCEPTED",
  PREPARING: "READY",
  READY: "SERVED",
};

/** The only status a ticket may move to, or null when it is finished. */
export function nextStatus(status: KitchenTicketStatus): KitchenTicketStatus | null {
  return NEXT[status] ?? null;
}

/** A ticket that was served or canceled is history and never changes again. */
export function isFinished(status: KitchenTicketStatus) {
  return status === "SERVED" || status === "CANCELED";
}

/** The column that records when a ticket reached a status. */
export const STATUS_TIMESTAMP = {
  ACCEPTED: "acceptedAt",
  CANCELED: "canceledAt",
  PREPARING: "startedAt",
  READY: "readyAt",
  SERVED: "servedAt",
} as const satisfies Partial<Record<KitchenTicketStatus, string>>;

/**
 * What the kitchen announces to the rest of the business (architecture.md
 * 7.2). Accepting a ticket is the kitchen's own business and announces nothing.
 */
export const STATUS_EVENTS: Partial<Record<KitchenTicketStatus, { type: string }>> = {
  PREPARING: { type: "kitchen_ticket.started.v1" },
  READY: { type: "kitchen_ticket.ready.v1" },
  SERVED: { type: "kitchen_ticket.served.v1" },
};

/**
 * The instant the day began at the outlet, for "finished today". Works out
 * the outlet's clock time for `now` and steps back to its midnight.
 */
export function startOfLocalDay(now: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  const elapsed =
    (part("hour") * 3600 + part("minute") * 60 + part("second")) * 1000 + now.getMilliseconds();
  return new Date(now.getTime() - elapsed);
}
