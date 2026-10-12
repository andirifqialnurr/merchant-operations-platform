import type { KitchenTicketSource } from "@merchant/contracts";

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

/** Persistence port for kitchen tickets. Every method is scoped by tenant. */
export interface KitchenTicketRepository {
  /**
   * Stores the ticket on the outlet's default station, creating the station
   * with the outlet's first ticket. A source and reference that already made
   * a ticket return that ticket with `created: false`.
   */
  create(ticket: NewKitchenTicket): Promise<{ created: boolean; ticket: KitchenTicketRecord }>;
  /** Tickets still being worked on, longest waiting first. */
  listOpen(tenantId: string, outletId: string): Promise<KitchenTicketRecord[]>;
}

export const KITCHEN_TICKET_REPOSITORY = Symbol("KITCHEN_TICKET_REPOSITORY");
