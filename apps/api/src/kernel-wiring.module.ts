import { Global, Module, NotFoundException } from "@nestjs/common";

import { CatalogModule, CatalogService } from "./kernels/catalog/public.js";
import {
  OrderIntakeModule,
  OrderIntakeService,
  SELLABLE_MENU_SOURCE,
} from "./kernels/order-intake/public.js";
import { KITCHEN_ORDER_SOURCE, type KitchenOrderSource } from "./modules/kds/public.js";

/**
 * What the kitchen may know about an order: what to prepare. The order's
 * prices stay on this side; they are not part of the shape that is returned.
 */
export function kitchenOrderSource(orders: Pick<OrderIntakeService, "getOrder">) {
  return {
    async kitchenOrder(tenantId, outletId, orderId) {
      let order;
      try {
        order = await orders.getOrder(tenantId, outletId, orderId);
      } catch (error) {
        if (error instanceof NotFoundException) return null;
        throw error;
      }
      return {
        canceled: order.status === "CANCELED",
        items: order.items.map((item) => ({
          // The variant is read first, like the size of a drink.
          modifiers: [
            ...(item.variantName ? [item.variantName] : []),
            ...item.modifiers.map((modifier) => modifier.optionName),
          ],
          name: item.name,
          ...(item.note ? { note: item.note } : {}),
          quantity: item.quantity,
        })),
        orderLabel: `#${order.orderNumber}`,
        source: order.source === "SELF_ORDER" ? "SELF_ORDER" : "POS",
      };
    },
  } satisfies KitchenOrderSource;
}

/**
 * Connects the ports one unit declares to the unit that answers them. Units
 * that must not import each other meet here; this root file is the only
 * place that knows both sides.
 */
@Global()
@Module({
  exports: [KITCHEN_ORDER_SOURCE, SELLABLE_MENU_SOURCE],
  imports: [CatalogModule, OrderIntakeModule],
  providers: [
    // Orders are priced from the catalog's sellable menu.
    { provide: SELLABLE_MENU_SOURCE, useExisting: CatalogService },
    // The kitchen reads what to prepare from the owner of orders.
    { inject: [OrderIntakeService], provide: KITCHEN_ORDER_SOURCE, useFactory: kitchenOrderSource },
  ],
})
export class KernelWiringModule {}
