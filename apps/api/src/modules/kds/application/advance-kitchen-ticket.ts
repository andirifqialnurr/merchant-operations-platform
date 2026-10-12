import type { KitchenTicket, KitchenTicketStatus } from "@merchant/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import type { CommandOrigin } from "../../../shared/command/command-origin.js";
import { nextStatus, STATUS_EVENTS } from "../domain/ticket-status.js";
import { toKitchenTicket } from "./create-kitchen-ticket.js";
import {
  KITCHEN_TICKET_REPOSITORY,
  type KitchenTicketRepository,
} from "./kitchen-ticket.repository.js";

/**
 * Moves a ticket to its one next step. The caller says which status it saw:
 * a repeat of a move that already happened returns the ticket as it is, and
 * a move based on an older view is refused instead of skipping a step.
 */
@Injectable()
export class AdvanceKitchenTicket {
  constructor(
    @Inject(KITCHEN_TICKET_REPOSITORY) private readonly tickets: KitchenTicketRepository,
  ) {}

  async execute(
    tenantId: string,
    outletId: string,
    id: string,
    expectedStatus: KitchenTicketStatus,
    origin?: CommandOrigin,
    now = new Date(),
  ): Promise<KitchenTicket> {
    const to = nextStatus(expectedStatus);
    if (!to) {
      throw new ConflictException({
        code: "KITCHEN_TICKET_FINISHED",
        message: "This ticket is finished and has no next step.",
      });
    }
    const eventType = STATUS_EVENTS[to]?.type;
    const result = await this.tickets.move({
      at: now,
      ...(eventType ? { eventType } : {}),
      from: expectedStatus,
      id,
      ...(origin ? { origin } : {}),
      outletId,
      tenantId,
      to,
    });
    if (result.outcome === "missing") {
      throw new NotFoundException({
        code: "KITCHEN_TICKET_NOT_FOUND",
        message: "This ticket was not found at this outlet.",
      });
    }
    if (result.outcome === "stale" && result.ticket.status !== to) {
      throw new ConflictException({
        code: "KITCHEN_TICKET_STATUS_CHANGED",
        details: { status: result.ticket.status },
        message: "This ticket was changed on another screen.",
      });
    }
    return toKitchenTicket(result.ticket);
  }
}
