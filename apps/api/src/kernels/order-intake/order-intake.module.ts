import { Module } from "@nestjs/common";

import { PrismaOrderRepository } from "./adapters/prisma-order.repository.js";
import { OrderIntakeService } from "./application/order-intake.service.js";
import { ORDER_REPOSITORY } from "./application/order.repository.js";

/**
 * Order intake kernel. Owns order_orders, order_order_items,
 * order_item_modifiers, and order_number_counters. Modules such as POS expose
 * their own routes and call OrderIntakeService. The menu orders are priced from
 * arrives through SELLABLE_MENU_SOURCE, connected at the application root.
 */
@Module({
  exports: [OrderIntakeService],
  providers: [
    OrderIntakeService,
    PrismaOrderRepository,
    { provide: ORDER_REPOSITORY, useExisting: PrismaOrderRepository },
  ],
})
export class OrderIntakeModule {}
