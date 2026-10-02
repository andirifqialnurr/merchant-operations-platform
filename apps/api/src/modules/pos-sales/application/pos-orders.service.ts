import { posOrderListSchema, receiptSchema, type CancelOrder } from "@merchant/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { BillingService } from "../../../kernels/billing-payment-ledger/application/billing.service.js";
import { OrderIntakeService } from "../../../kernels/order-intake/application/order-intake.service.js";
import type { ShiftMutationContext } from "./register-session.repository.js";

/** How far back the cashier's order list reaches, and how many rows it shows. */
export const ORDER_LIST_HOURS = 24;
export const ORDER_LIST_LIMIT = 100;

/**
 * The cashier's view of orders: recent orders with whether each is paid, and
 * cancelling an order that was never paid.
 */
@Injectable()
export class PosOrdersService {
  constructor(
    @Inject(OrderIntakeService) private readonly orders: OrderIntakeService,
    @Inject(BillingService) private readonly billing: BillingService,
  ) {}

  async list(tenantId: string, outletId: string) {
    const orders = await this.orders.listRecent(
      tenantId,
      outletId,
      ORDER_LIST_HOURS,
      ORDER_LIST_LIMIT,
    );
    const paid = await this.billing.paidOrders(
      tenantId,
      orders.map((order) => order.id),
    );
    return posOrderListSchema.parse({
      orders: orders.map((order) => ({
        createdAt: order.createdAt,
        id: order.id,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        orderNumber: order.orderNumber,
        paymentState: paid.has(order.id) ? "PAID" : "UNPAID",
        saleNumber: paid.get(order.id) ?? null,
        status: order.status,
        subtotalMinor: order.subtotalMinor,
      })),
    });
  }

  /** The receipt of a paid order; an unpaid order has no receipt yet. */
  async receipt(tenantId: string, outletId: string, orderId: string) {
    const order = await this.orders.getOrder(tenantId, outletId, orderId);
    const paid = await this.billing.paidCheckout(tenantId, outletId, orderId);
    if (!paid) {
      throw new NotFoundException({
        code: "RECEIPT_NOT_FOUND",
        message: "This order has no receipt because it is not paid.",
      });
    }
    return receiptSchema.parse({ ...paid.checkout, cashierName: paid.cashierName, order });
  }

  /** A paid order is a sale; it is refunded, never cancelled. */
  cancel(
    tenantId: string,
    outletId: string,
    orderId: string,
    input: CancelOrder,
    context: ShiftMutationContext,
  ) {
    return this.orders.cancelOrder(
      tenantId,
      outletId,
      orderId,
      input.reason,
      async () => {
        if (await this.billing.isOrderPaid(tenantId, orderId)) {
          throw new ConflictException({
            code: "ORDER_ALREADY_PAID",
            message: "A paid order cannot be cancelled.",
          });
        }
      },
      context,
    );
  }
}
