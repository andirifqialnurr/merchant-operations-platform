import {
  checkoutSchema,
  saleRefundsSchema,
  type Checkout,
  type OrderStatus,
  type PayOrder,
  type RefundOrder,
} from "@merchant/contracts";
import { ConflictException, Inject, Injectable } from "@nestjs/common";

import { billTotal, cashChange } from "../domain/bill-total.js";
import {
  BILLING_REPOSITORY,
  type BillingMutationContext,
  type BillingRepository,
  type CheckoutRecord,
  type SaleRefundsRecord,
} from "./billing.repository.js";

const conflict = (code: string, message: string) => new ConflictException({ code, message });
const NON_CASH_ORDER = ["MERCHANT_QRIS", "TRANSFER", "EDC", "OTHER"] as const;

export type PayableOrder = {
  currency: string;
  id: string;
  status: OrderStatus;
  subtotalMinor: string;
};

/** Maps a stored checkout to its DTO; the change is derived here. */
export function toCheckout({ bill, payment, sale }: CheckoutRecord): Checkout {
  const change =
    payment.tenderedMinor === null ? null : cashChange(payment.tenderedMinor, payment.amountMinor);
  return checkoutSchema.parse({
    bill: {
      currency: bill.currency,
      discountMinor: bill.discountMinor.toString(),
      id: bill.id,
      orderId: bill.orderId,
      paidMinor: bill.paidMinor.toString(),
      roundingMinor: bill.roundingMinor.toString(),
      serviceChargeMinor: bill.serviceChargeMinor.toString(),
      status: bill.status,
      subtotalMinor: bill.subtotalMinor.toString(),
      taxMinor: bill.taxMinor.toString(),
      totalMinor: bill.totalMinor.toString(),
    },
    payment: {
      amountMinor: payment.amountMinor.toString(),
      changeMinor: change?.toString() ?? null,
      confirmedAt: payment.confirmedAt?.toISOString() ?? null,
      id: payment.id,
      method: payment.method,
      reference: payment.reference,
      status: payment.status,
      tenderedMinor: payment.tenderedMinor?.toString() ?? null,
    },
    sale: {
      completedAt: sale.completedAt?.toISOString() ?? null,
      id: sale.id,
      saleNumber: sale.saleNumber,
      status: sale.status,
      totalMinor: sale.totalMinor.toString(),
    },
  });
}

/** Maps a sale and its refunds; what is still refundable is derived here. */
export function toSaleRefunds({ refunds, sale }: SaleRefundsRecord) {
  const refundedMinor = refunds.reduce((sum, refund) => sum + refund.amountMinor, 0n);
  return saleRefundsSchema.parse({
    refundableMinor: (sale.totalMinor - refundedMinor).toString(),
    refunds: refunds.map((refund) => ({
      amountMinor: refund.amountMinor.toString(),
      createdAt: refund.createdAt.toISOString(),
      id: refund.id,
      method: refund.method,
      reason: refund.reason,
    })),
    sale: {
      completedAt: sale.completedAt?.toISOString() ?? null,
      id: sale.id,
      saleNumber: sale.saleNumber,
      status: sale.status,
      totalMinor: sale.totalMinor.toString(),
    },
  });
}

/**
 * Bills an order, takes its payment, and refunds it. Amounts are always
 * decided here; callers only say how it was paid or how much to give back.
 */
@Injectable()
export class BillingService {
  constructor(@Inject(BILLING_REPOSITORY) private readonly billing: BillingRepository) {}

  async payOrderInFull(
    input: {
      idempotencyKey: string;
      order: PayableOrder;
      outletId: string;
      pay: PayOrder;
      registerSessionId: string;
      tenantId: string;
    },
    context: BillingMutationContext,
  ) {
    const { idempotencyKey, order, outletId, pay, tenantId } = input;

    // A retry returns the payment already taken instead of charging again.
    const replayed = await this.billing.findCheckoutByIdempotencyKey(
      tenantId,
      outletId,
      idempotencyKey,
    );
    if (replayed) {
      if (replayed.bill.orderId !== order.id) {
        throw conflict(
          "IDEMPOTENCY_KEY_REUSED",
          "This idempotency key was already used for a different request.",
        );
      }
      return toCheckout(replayed);
    }

    if (order.status === "CANCELED") {
      throw conflict("ORDER_CANCELED", "A canceled order cannot be paid.");
    }

    // Tax, service charge, discount, and rounding are not configured yet, so
    // the amount due is the subtotal; the bill still stores each part.
    const subtotalMinor = BigInt(order.subtotalMinor);
    const totalMinor = billTotal({ subtotalMinor });
    if (totalMinor <= 0n) {
      throw conflict("BILL_NOTHING_TO_PAY", "This order has nothing to pay.");
    }

    const tenderedMinor = pay.method === "CASH" ? BigInt(pay.tenderedMinor) : null;
    if (tenderedMinor !== null && cashChange(tenderedMinor, totalMinor) === null) {
      throw conflict("PAYMENT_TENDERED_INSUFFICIENT", "The cash received is less than the total.");
    }

    const outcome = await this.billing.recordFullPayment(
      {
        currency: order.currency,
        idempotencyKey,
        method: pay.method,
        orderId: order.id,
        outletId,
        reference: pay.method === "CASH" ? null : (pay.reference ?? null),
        registerSessionId: input.registerSessionId,
        subtotalMinor,
        tenantId,
        tenderedMinor,
        totalMinor,
      },
      context,
    );
    if (outcome.kind === "bill_already_paid") {
      throw conflict("BILL_ALREADY_PAID", "This order is already paid.");
    }
    if (outcome.kind === "order_canceled") {
      throw conflict("ORDER_CANCELED", "A canceled order cannot be paid.");
    }
    if (outcome.kind === "shift_not_open") {
      throw conflict("POS_SHIFT_NOT_OPEN", "This shift is already closed.");
    }
    return toCheckout(outcome.checkout);
  }

  /** The paid checkout of an order, its cashier, and its refunds, or null while unpaid. */
  async paidCheckout(tenantId: string, outletId: string, orderId: string) {
    const found = await this.billing.findPaidCheckoutByOrder(tenantId, outletId, orderId);
    if (!found) return null;
    const refunds = toSaleRefunds({
      refunds: await this.billing.refundsOfSale(tenantId, found.sale.id),
      sale: found.sale,
    });
    return { cashierName: found.cashierName, checkout: toCheckout(found), refunds };
  }

  /**
   * Refunds part or all of a paid order through the method it was paid with.
   * The money is paid out in the given open shift.
   */
  async refundOrder(
    input: {
      idempotencyKey: string;
      orderId: string;
      outletId: string;
      refund: RefundOrder;
      registerSessionId: string;
      tenantId: string;
    },
    context: BillingMutationContext,
  ) {
    const { idempotencyKey, orderId, outletId, tenantId } = input;
    const replayed = await this.billing.findRefundByIdempotencyKey(
      tenantId,
      outletId,
      idempotencyKey,
    );
    if (replayed) {
      if (replayed.orderId !== orderId) {
        throw conflict(
          "IDEMPOTENCY_KEY_REUSED",
          "This idempotency key was already used for a different request.",
        );
      }
      return toSaleRefunds(replayed.result);
    }

    const paid = await this.billing.findPaidCheckoutByOrder(tenantId, outletId, orderId);
    if (!paid) throw conflict("ORDER_NOT_PAID", "Only a paid order can be refunded.");

    const outcome = await this.billing.recordRefund(
      {
        amountMinor: BigInt(input.refund.amountMinor),
        idempotencyKey,
        method: paid.payment.method,
        outletId,
        paymentId: paid.payment.id,
        reason: input.refund.reason,
        registerSessionId: input.registerSessionId,
        saleId: paid.sale.id,
        tenantId,
      },
      context,
    );
    if (outcome.kind === "shift_not_open") {
      throw conflict("POS_SHIFT_NOT_OPEN", "This shift is already closed.");
    }
    if (outcome.kind === "exceeds_refundable") {
      throw new ConflictException({
        code: "REFUND_EXCEEDS_REFUNDABLE",
        details: { refundableMinor: outcome.refundableMinor.toString() },
        message: "The refund is more than what is left to refund.",
      });
    }
    return toSaleRefunds(outcome.result);
  }

  /** Sale number and state of the paid orders among `orderIds`, keyed by order id. */
  paidOrders(tenantId: string, orderIds: readonly string[]) {
    return this.billing.paidOrders(tenantId, orderIds);
  }

  /** Whether the order was paid, whatever was refunded since. */
  async isOrderPaid(tenantId: string, orderId: string) {
    return (await this.billing.paidOrders(tenantId, [orderId])).has(orderId);
  }

  /** Net cash from sales in a shift: cash taken minus cash refunded. */
  async cashReceivedInSession(tenantId: string, registerSessionId: string) {
    const taken = await this.paymentsInSession(tenantId, registerSessionId);
    return taken.cashMinor - taken.cashRefundsMinor;
  }

  /**
   * Money in a shift: cash taken and cash refunded, which both touch the
   * drawer, and non-cash taken per method in a fixed order, leaving out
   * methods with nothing taken.
   */
  async paymentsInSession(tenantId: string, registerSessionId: string) {
    const [sums, refunds] = await Promise.all([
      this.billing.sumPaymentsByMethod(tenantId, registerSessionId),
      this.billing.sumRefundsByMethod(tenantId, registerSessionId),
    ]);
    return {
      cashMinor: sums.get("CASH") ?? 0n,
      cashRefundsMinor: refunds.get("CASH") ?? 0n,
      nonCash: NON_CASH_ORDER.flatMap((method) => {
        const amountMinor = sums.get(method) ?? 0n;
        return amountMinor > 0n ? [{ amountMinor, method }] : [];
      }),
    };
  }
}
