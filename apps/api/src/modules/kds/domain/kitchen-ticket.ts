import type { KitchenTicketSource, KitchenTicketStatus } from "@merchant/contracts";

/** One line the kitchen prepares. It has a name and a count, never a price. */
export type KitchenTicketItemRecord = {
  allergyNote: string | null;
  modifiers: string[];
  name: string;
  note: string | null;
  quantity: number;
};

export type KitchenTicketRecord = {
  acceptedAt: Date | null;
  canceledAt: Date | null;
  id: string;
  items: KitchenTicketItemRecord[];
  orderLabel: string;
  outletId: string;
  readyAt: Date | null;
  receivedAt: Date;
  servedAt: Date | null;
  source: KitchenTicketSource;
  /** What the source calls the request; it lets the source recognise its ticket. */
  sourceReference: string;
  startedAt: Date | null;
  status: KitchenTicketStatus;
  tableLabel: string | null;
};

/** Tickets the kitchen still has work on; the rest is history. */
export const OPEN_TICKET_STATUSES = [
  "NEW",
  "ACCEPTED",
  "PREPARING",
  "READY",
] as const satisfies readonly KitchenTicketStatus[];

/** Name of the station every outlet starts with. */
export const DEFAULT_STATION_NAME = "Main";
