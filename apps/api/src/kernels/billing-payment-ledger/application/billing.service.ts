import {
  checkoutSchema,
  type Checkout,
  type OrderStatus,
  type PayOrder,
} from "@merchant/contracts";
import { ConflictException, Inject, Injectable } from "@nestjs/common";

import { billTotal, cashChange } from "../domain/bill-total.js";
import {
  BILLING_REPOSITORY,
  type BillingMutationContext,
  type BillingRepository,
  type CheckoutRecord,
} from "./billing.repository.js";

const conflict = (code: string, message: string) => new ConflictException({ code, message });

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

/**
 * Bills an order and takes its payment. The amount is always the full amount
 * due and is decided here; callers only say how it was paid.
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
        reference: pay.method === "MERCHANT_QRIS" ? (pay.reference ?? null) : null,
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
    if (outcome.kind === "shift_not_open") {
      throw conflict("POS_SHIFT_NOT_OPEN", "This shift is already closed.");
    }
    return toCheckout(outcome.checkout);
  }

  /** Cash taken in a shift; the shift adds it to the cash it expects. */
  cashReceivedInSession(tenantId: string, registerSessionId: string) {
    return this.billing.sumCashPayments(tenantId, registerSessionId);
  }
}
