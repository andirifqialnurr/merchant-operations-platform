import { Module } from "@nestjs/common";

import { CatalogModule } from "../../catalog/public.js";
import { PrismaOrderRepository } from "./adapters/prisma-order.repository.js";
import { OrderIntakeService } from "./application/order-intake.service.js";
import { ORDER_REPOSITORY } from "./application/order.repository.js";

/**
 * Order intake kernel. Owns order_orders, order_order_items,
 * order_item_modifiers, and order_number_counters. Modules such as POS expose
 * their own routes and call OrderIntakeService.
 */
@Module({
  exports: [OrderIntakeService],
  imports: [CatalogModule],
  providers: [
    OrderIntakeService,
    PrismaOrderRepository,
    { provide: ORDER_REPOSITORY, useExisting: PrismaOrderRepository },
  ],
})
export class OrderIntakeModule {}
