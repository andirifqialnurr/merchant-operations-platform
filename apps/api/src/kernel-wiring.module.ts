import { Global, Module, NotFoundException } from "@nestjs/common";

import { isOrderApproved } from "@merchant/contracts";

import { CatalogModule, CatalogService } from "./kernels/catalog/public.js";
import {
  OrderIntakeModule,
  OrderIntakeService,
  SELLABLE_MENU_SOURCE,
  TABLE_VISIT_SOURCE,
} from "./kernels/order-intake/public.js";
import { FloorModule, TableSessions, TableVisitGuard } from "./modules/floor/public.js";
import { KITCHEN_ORDER_SOURCE, type KitchenOrderSource } from "./modules/kds/public.js";

/**
 * What the kitchen may know about an order: what to prepare. The order's
 * prices stay on this side; they are not part of the shape that is returned.
 */
export function kitchenOrderSource(
  orders: Pick<OrderIntakeService, "getOrder">,
  tables?: Pick<TableSessions, "tableLabel">,
) {
  return {
    async kitchenOrder(tenantId, outletId, orderId) {
      let order;
      try {
        order = await orders.getOrder(tenantId, outletId, orderId);
      } catch (error) {
        if (error instanceof NotFoundException) return null;
        throw error;
      }
      // An order taken at a table tells the kitchen where to bring it.
      const tableLabel =
        order.tableSessionId && tables
          ? await tables.tableLabel(tenantId, outletId, order.tableSessionId)
          : null;
      return {
        canceled: order.status === "CANCELED",
        approved: isOrderApproved(order),
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
        ...(tableLabel ? { tableLabel } : {}),
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
  exports: [KITCHEN_ORDER_SOURCE, SELLABLE_MENU_SOURCE, TABLE_VISIT_SOURCE],
  imports: [CatalogModule, FloorModule, OrderIntakeModule],
  providers: [
    // Orders are priced from the catalog's sellable menu.
    { provide: SELLABLE_MENU_SOURCE, useExisting: CatalogService },
    { provide: TABLE_VISIT_SOURCE, useExisting: TableVisitGuard },
    // The kitchen reads what to prepare from the owner of orders.
    {
      inject: [OrderIntakeService, TableSessions],
      provide: KITCHEN_ORDER_SOURCE,
      useFactory: kitchenOrderSource,
    },
  ],
})
export class KernelWiringModule {}
