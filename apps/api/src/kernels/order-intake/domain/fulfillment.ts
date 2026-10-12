import type { OrderStatus } from "@merchant/contracts";

/**
 * How far the kitchen is with an order. This is the order's own status and
 * has nothing to do with whether it was paid: an unpaid order can be ready,
 * and a paid one can still be waiting.
 */
export type KitchenProgress = Extract<OrderStatus, "PREPARING" | "READY" | "SERVED">;

/** What each announcement of the kitchen means for the order. */
export const PROGRESS_BY_EVENT = {
  "kitchen_ticket.ready.v1": "READY",
  "kitchen_ticket.served.v1": "SERVED",
  "kitchen_ticket.started.v1": "PREPARING",
} as const satisfies Record<string, KitchenProgress>;

const ORDER: readonly OrderStatus[] = ["SUBMITTED", "ACCEPTED", "PREPARING", "READY", "SERVED"];

/**
 * The statuses an order may be in to move to `progress`: any earlier one.
 * Progress only goes forward, so an announcement that arrives late or twice
 * changes nothing, and a canceled order is never brought back.
 */
export function statusesBefore(progress: KitchenProgress): OrderStatus[] {
  return ORDER.slice(0, ORDER.indexOf(progress));
}
