import { MODULES } from "@merchant/contracts";
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import {
  EVENT_HANDLER_REGISTRY,
  type EventEnvelope,
  type EventHandlerRegistry,
} from "../../../core/events/public.js";
import { OrderIntakeService } from "../application/order-intake.service.js";
import { PROGRESS_BY_EVENT, type KitchenProgress } from "../domain/fulfillment.js";

/** One consumer per announcement, so each has its own inbox record. */
export const KITCHEN_PROGRESS_CONSUMERS = {
  "kitchen_ticket.ready.v1": "order.kitchen_ready",
  "kitchen_ticket.served.v1": "order.kitchen_served",
  "kitchen_ticket.started.v1": "order.kitchen_started",
} as const satisfies Record<keyof typeof PROGRESS_BY_EVENT, string>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Orders follow what the kitchen announces about their tickets. Only tickets
 * that came from an order are of interest: one typed by hand at the kitchen,
 * or sent by an outside system, has no order here.
 */
@Injectable()
export class KitchenProgressHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_HANDLER_REGISTRY) private readonly registry: EventHandlerRegistry,
    @Inject(OrderIntakeService) private readonly orders: OrderIntakeService,
  ) {}

  onModuleInit() {
    for (const [eventType, progress] of Object.entries(PROGRESS_BY_EVENT)) {
      this.registry.register({
        consumerName: KITCHEN_PROGRESS_CONSUMERS[eventType as keyof typeof PROGRESS_BY_EVENT],
        eventType,
        handle: (event) => this.follow(event, progress),
        moduleKey: MODULES.coreOrder,
      });
    }
  }

  private async follow(event: EventEnvelope, progress: KitchenProgress) {
    const { source, sourceReference } = event.payload;
    if (source !== "POS" && source !== "SELF_ORDER") return "skipped:not_from_an_order";
    if (typeof sourceReference !== "string" || !UUID.test(sourceReference)) {
      return "skipped:no_order_reference";
    }
    return this.orders.recordKitchenProgress(event.workspaceId, sourceReference, progress);
  }
}
