import { kitchenTicketListSchema, type KitchenTicketList } from "@merchant/contracts";
import { Inject, Injectable } from "@nestjs/common";

import { toKitchenTicket } from "./create-kitchen-ticket.js";
import {
  KITCHEN_TICKET_REPOSITORY,
  type KitchenTicketRepository,
} from "./kitchen-ticket.repository.js";

/** What an outlet's kitchen is working on right now. */
@Injectable()
export class KitchenQueue {
  constructor(
    @Inject(KITCHEN_TICKET_REPOSITORY) private readonly tickets: KitchenTicketRepository,
  ) {}

  async list(tenantId: string, outletId: string): Promise<KitchenTicketList> {
    return kitchenTicketListSchema.parse({
      tickets: (await this.tickets.listOpen(tenantId, outletId)).map(toKitchenTicket),
    });
  }
}
