import type { KitchenTicketSource, KitchenTicketStatus } from "@merchant/contracts";

import type { CommandOrigin } from "../../../shared/command/command-origin.js";

import type { KitchenTicketItemRecord, KitchenTicketRecord } from "../domain/kitchen-ticket.js";

export type NewKitchenTicket = {
  /** The person who asked, when a person did; recorded in the ticket's history. */
  actorId?: string;
  items: KitchenTicketItemRecord[];
  orderLabel: string;
  outletId: string;
  receivedAt: Date;
  source: KitchenTicketSource;
  sourceReference: string;
  tableLabel: string | null;
  tenantId: string;
};

export type TicketMove = {
  at: Date;
  /** Announced in the same transaction when the move happens. */
  eventType?: string;
  from: KitchenTicketStatus;
  id: string;
  origin?: CommandOrigin;
  outletId: string;
  tenantId: string;
  to: KitchenTicketStatus;
};

export type TicketMoveResult =
  | { outcome: "missing" }
  /** The ticket was not in the status the caller saw; it is returned as it is. */
  | { outcome: "stale"; ticket: KitchenTicketRecord }
  | { outcome: "moved"; ticket: KitchenTicketRecord };

/** Persistence port for kitchen tickets. Every method is scoped by tenant. */
export interface KitchenTicketRepository {
  /**
   * Stores the ticket on the outlet's default station, creating the station
   * with the outlet's first ticket. A source and reference that already made
   * a ticket return that ticket with `created: false`.
   */
  create(ticket: NewKitchenTicket): Promise<{ created: boolean; ticket: KitchenTicketRecord }>;
  /** Tickets served or canceled since `since`, most recent first. */
  listFinishedSince(
    tenantId: string,
    outletId: string,
    since: Date,
  ): Promise<KitchenTicketRecord[]>;
  /**
   * Moves the ticket only if it is still in `from`, and records the move in
   * its history. Two moves at once: one wins, the other is told it is stale.
   */
  move(move: TicketMove): Promise<TicketMoveResult>;
  /** Tickets still being worked on, longest waiting first. */
  listOpen(tenantId: string, outletId: string): Promise<KitchenTicketRecord[]>;
}

export const KITCHEN_TICKET_REPOSITORY = Symbol("KITCHEN_TICKET_REPOSITORY");
