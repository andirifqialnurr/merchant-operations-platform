import { MODULES } from "@merchant/contracts";
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import {
  BlockedEventError,
  EVENT_HANDLER_REGISTRY,
  type EventHandlerRegistry,
} from "../../../core/events/public.js";
import { Customers } from "../application/customers.js";

export const RECORD_VISIT_CONSUMER = "customer.record_visit";

/**
 * A paid order linked to a customer becomes a visit in their history. The
 * update only fills the link's sale, so a repeated delivery changes nothing.
 */
@Injectable()
export class SaleEventsHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_HANDLER_REGISTRY) private readonly registry: EventHandlerRegistry,
    @Inject(Customers) private readonly customers: Customers,
  ) {}

  onModuleInit() {
    this.registry.register({
      consumerName: RECORD_VISIT_CONSUMER,
      eventType: "sale.completed.v1",
      handle: async (event) => {
        const { completedAt, currency, orderId, saleNumber, totalMinor } = event.payload;
        if (
          typeof orderId !== "string" ||
          typeof saleNumber !== "number" ||
          typeof totalMinor !== "string" ||
          typeof currency !== "string"
        ) {
          throw new BlockedEventError("The event does not say which sale of which order.");
        }
        const recorded = await this.customers.recordSale(event.workspaceId, orderId, {
          completedAt: typeof completedAt === "string" ? new Date(completedAt) : event.occurredAt,
          currency,
          saleNumber,
          totalMinor: BigInt(totalMinor),
        });
        return recorded ? "recorded" : "skipped:not_linked";
      },
      moduleKey: MODULES.customerBasic,
    });
  }
}
