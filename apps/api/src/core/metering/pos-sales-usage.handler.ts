import { MODULES } from "@merchant/contracts";
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { commandOriginFromEvent } from "../../shared/command/command-origin.js";
import { EVENT_HANDLER_REGISTRY, type EventHandlerRegistry } from "../events/public.js";
import { MeteringService } from "./metering.service.js";

export const POS_SALES_USAGE_CONSUMER = "core.usage_pos_sales";

/**
 * Counts each completed sale against `pos.sales.completed.cycle`. It is a
 * soft limit: the sale is already done when this runs, and nothing here can
 * refuse it. The event ID is the idempotency key, so a repeated delivery
 * counts once.
 */
@Injectable()
export class PosSalesUsageHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_HANDLER_REGISTRY) private readonly registry: EventHandlerRegistry,
    @Inject(MeteringService) private readonly metering: MeteringService,
  ) {}

  onModuleInit() {
    this.registry.register({
      consumerName: POS_SALES_USAGE_CONSUMER,
      eventType: "sale.completed.v1",
      handle: async (event) => {
        const saleId = typeof event.payload.saleId === "string" ? event.payload.saleId : undefined;
        const outcome = await this.metering.record(
          event.workspaceId,
          {
            dimensionKey: "pos.sales.completed.cycle",
            idempotencyKey: `sale.completed:${event.eventId}`,
            occurredAt: event.occurredAt,
            quantity: 1n,
            ...(saleId ? { sourceReference: saleId } : {}),
            sourceType: "sales_sale",
          },
          commandOriginFromEvent(event),
        );
        return `used:${outcome.used}`;
      },
      moduleKey: MODULES.coreSubscription,
    });
  }
}
