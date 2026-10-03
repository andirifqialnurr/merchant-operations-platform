import {
  posOrderListSchema,
  receiptSchema,
  type CancelOrder,
  type RefundOrder,
  type SaleStatus,
} from "@merchant/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { BillingService } from "../../../kernels/billing-payment-ledger/application/billing.service.js";
import { OrderIntakeService } from "../../../kernels/order-intake/application/order-intake.service.js";
import type { ShiftMutationContext } from "./register-session.repository.js";
import { ShiftService } from "./shift.service.js";

/** What the cashier's list says about payment, from the state of the sale. */
function paymentState(saleStatus: SaleStatus | undefined) {
  if (!saleStatus) return "UNPAID";
  if (saleStatus === "REFUNDED" || saleStatus === "PARTIALLY_REFUNDED") return saleStatus;
  return "PAID";
}

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
    @Inject(ShiftService) private readonly shifts: ShiftService,
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
        paymentState: paymentState(paid.get(order.id)?.saleStatus),
        saleNumber: paid.get(order.id)?.saleNumber ?? null,
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
    return receiptSchema.parse({
      ...paid.checkout,
      cashierName: paid.cashierName,
      order,
      refundableMinor: paid.refunds.refundableMinor,
      refunds: paid.refunds.refunds,
    });
  }

  /**
   * Refunds a paid order in the cashier's open shift. Cash comes out of the
   * drawer, so a cash refund cannot exceed what the drawer should hold.
   */
  async refund(
    tenantId: string,
    outletId: string,
    orderId: string,
    input: RefundOrder,
    idempotencyKey: string,
    context: ShiftMutationContext,
  ) {
    const shift = await this.shifts.findOpen(tenantId, outletId, context.actorId);
    if (!shift) {
      throw new ConflictException({
        code: "POS_SHIFT_REQUIRED",
        message: "Open a shift before giving refunds.",
      });
    }
    const paid = await this.billing.paidCheckout(tenantId, outletId, orderId);
    if (paid?.checkout.payment.method === "CASH") {
      const drawer = await this.shifts.expectedCash(tenantId, outletId, context.actorId);
      if (drawer !== null && BigInt(input.amountMinor) > drawer) {
        throw new ConflictException({
          code: "POS_CASH_OUT_EXCEEDS_DRAWER",
          message: "The refund is more than the cash in the drawer.",
        });
      }
    }
    return this.billing.refundOrder(
      {
        idempotencyKey,
        orderId,
        outletId,
        refund: input,
        registerSessionId: shift.id,
        tenantId,
      },
      context,
    );
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
