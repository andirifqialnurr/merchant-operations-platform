import { kitchenTicketListSchema, type KitchenTicketList } from "@merchant/contracts";
import { Inject, Injectable } from "@nestjs/common";

import { OrganizationService } from "../../../core/workspaces/public.js";
import { startOfLocalDay } from "../domain/ticket-status.js";
import { toKitchenTicket } from "./create-kitchen-ticket.js";
import {
  KITCHEN_TICKET_REPOSITORY,
  type KitchenTicketRepository,
} from "./kitchen-ticket.repository.js";

/** The part of the organization core this query needs. */
type OutletClock = Pick<OrganizationService, "outletTimezone">;

/** What an outlet's kitchen is working on, and what it finished today. */
@Injectable()
export class KitchenQueue {
  constructor(
    @Inject(KITCHEN_TICKET_REPOSITORY) private readonly tickets: KitchenTicketRepository,
    @Inject(OrganizationService) private readonly organization: OutletClock,
  ) {}

  async list(tenantId: string, outletId: string): Promise<KitchenTicketList> {
    return kitchenTicketListSchema.parse({
      tickets: (await this.tickets.listOpen(tenantId, outletId)).map(toKitchenTicket),
    });
  }

  /** Tickets served or canceled since the day began at the outlet, most recent first. */
  async finishedToday(
    tenantId: string,
    outletId: string,
    now = new Date(),
  ): Promise<KitchenTicketList> {
    const since = startOfLocalDay(now, await this.organization.outletTimezone(tenantId, outletId));
    return kitchenTicketListSchema.parse({
      tickets: (await this.tickets.listFinishedSince(tenantId, outletId, since)).map(
        toKitchenTicket,
      ),
    });
  }
}
