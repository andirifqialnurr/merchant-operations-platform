import type { KitchenTicketSource } from "@merchant/contracts";
import { Inject, Injectable } from "@nestjs/common";

import type { CommandOrigin } from "../../../shared/command/command-origin.js";
import {
  KITCHEN_TICKET_REPOSITORY,
  type KitchenTicketRepository,
} from "./kitchen-ticket.repository.js";

export type CancelOutcome =
  /** The ticket is now marked canceled; it stays in the kitchen's history. */
  | "canceled"
  /** It was canceled before; nothing changed. */
  | "already_canceled"
  /** The food was already served; a ticket is never un-served. */
  | "already_served"
  /** The source's request never made a ticket, e.g. the kitchen was added later. */
  | "no_ticket";

/**
 * Marks the ticket of a canceled request as canceled. The ticket is kept:
 * the kitchen sees that it was called off, and by whom it was not prepared.
 */
@Injectable()
export class CancelKitchenTicket {
  constructor(
    @Inject(KITCHEN_TICKET_REPOSITORY) private readonly tickets: KitchenTicketRepository,
  ) {}

  execute(
    tenantId: string,
    sources: readonly KitchenTicketSource[],
    sourceReference: string,
    origin?: CommandOrigin,
    now = new Date(),
  ): Promise<CancelOutcome> {
    return this.tickets.cancelBySource({
      at: now,
      ...(origin ? { origin } : {}),
      sourceReference,
      sources,
      tenantId,
    });
  }
}
