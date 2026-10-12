import type { KitchenTicket, KitchenTicketStatus } from "@merchant/contracts";
import type { KdsTicketStatus } from "@merchant/ui/kds-ticket";

/** The statuses a ticket is worked on in, in the order the kitchen moves it. */
export const BOARD_STATUSES = [
  "NEW",
  "ACCEPTED",
  "PREPARING",
  "READY",
] as const satisfies readonly KitchenTicketStatus[];

export type BoardStatus = (typeof BOARD_STATUSES)[number];

export function isBoardStatus(status: KitchenTicketStatus): status is BoardStatus {
  return (BOARD_STATUSES as readonly string[]).includes(status);
}

const COMPONENT_STATUS: Record<KitchenTicketStatus, KdsTicketStatus> = {
  ACCEPTED: "accepted",
  CANCELED: "canceled",
  NEW: "new",
  PREPARING: "preparing",
  READY: "ready",
  SERVED: "served",
};

export const componentStatus = (status: KitchenTicketStatus) => COMPONENT_STATUS[status];

/** Waiting time as the kitchen reads it: 08:12, and 1:04:09 past the hour. */
export function formatElapsed(milliseconds: number) {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * How long a ticket has waited: until now while it is open, and until it was
 * served or canceled once it is finished.
 */
export function waitedMilliseconds(ticket: KitchenTicket, now: number) {
  const end = ticket.servedAt ?? ticket.canceledAt;
  return (end ? Date.parse(end) : now) - Date.parse(ticket.receivedAt);
}

/** Tickets by status, each group longest waiting first, as the API ordered them. */
export function groupByStatus(tickets: readonly KitchenTicket[]) {
  const groups = new Map<BoardStatus, KitchenTicket[]>(
    BOARD_STATUSES.map((status) => [status, []]),
  );
  for (const ticket of tickets) {
    if (isBoardStatus(ticket.status)) groups.get(ticket.status)?.push(ticket);
  }
  return groups;
}
