import { MODULES } from "@merchant/contracts";
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import {
  BlockedEventError,
  EVENT_HANDLER_REGISTRY,
  type EventEnvelope,
  type EventHandlerRegistry,
} from "../../../core/events/public.js";
import { commandOriginFromEvent } from "../../../shared/command/command-origin.js";
import { CancelKitchenTicket } from "../application/cancel-kitchen-ticket.js";
import { CreateKitchenTicket } from "../application/create-kitchen-ticket.js";
import {
  KITCHEN_ORDER_SOURCE,
  type KitchenOrderSource,
} from "../application/kitchen-order-source.port.js";

export const CREATE_TICKET_CONSUMER = "kds.create_ticket";
export const CANCEL_TICKET_CONSUMER = "kds.cancel_ticket";

function orderIdOf(event: EventEnvelope) {
  const orderId = event.payload.orderId;
  // Retrying cannot repair an event that does not say which order it is about.
  if (typeof orderId !== "string") throw new BlockedEventError("The event names no order.");
  return orderId;
}

/**
 * The kitchen's reactions to orders. They add no logic of their own: each
 * turns an event into the same command the manual form sends and calls the
 * same use case. The order ID is the ticket's source reference, so an event
 * delivered twice makes one ticket.
 */
@Injectable()
export class OrderEventsHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_HANDLER_REGISTRY) private readonly registry: EventHandlerRegistry,
    @Inject(CreateKitchenTicket) private readonly createTicket: CreateKitchenTicket,
    @Inject(CancelKitchenTicket) private readonly cancelTicket: CancelKitchenTicket,
    @Inject(KITCHEN_ORDER_SOURCE) private readonly orders: KitchenOrderSource,
  ) {}

  onModuleInit() {
    this.registry.register({
      consumerName: CREATE_TICKET_CONSUMER,
      eventType: "order.submitted.v1",
      handle: (event) => this.onSubmitted(event),
      moduleKey: MODULES.kds,
    });
    this.registry.register({
      consumerName: CANCEL_TICKET_CONSUMER,
      eventType: "order.canceled.v1",
      handle: (event) => this.onCanceled(event),
      moduleKey: MODULES.kds,
    });
  }

  private async onSubmitted(event: EventEnvelope) {
    const orderId = orderIdOf(event);
    if (!event.locationId) throw new BlockedEventError("The event names no outlet.");
    const order = await this.orders.kitchenOrder(event.workspaceId, event.locationId, orderId);
    if (!order) throw new BlockedEventError("The order of this event was not found.");
    // Called off before the kitchen heard of it: there is nothing to prepare.
    if (order.canceled) return "skipped:order_canceled";

    const { created, ticket } = await this.createTicket.execute(
      event.workspaceId,
      event.locationId,
      {
        items: order.items,
        orderLabel: order.orderLabel,
        receivedAt: event.occurredAt.toISOString(),
        source: order.source,
        sourceReference: orderId,
        ...(order.tableLabel ? { tableLabel: order.tableLabel } : {}),
      },
      commandOriginFromEvent(event),
    );
    return `${created ? "created" : "existing"}:${ticket.id}`;
  }

  private async onCanceled(event: EventEnvelope) {
    return this.cancelTicket.execute(
      event.workspaceId,
      ["POS", "SELF_ORDER"],
      orderIdOf(event),
      commandOriginFromEvent(event),
      event.occurredAt,
    );
  }
}
