import type { Receipt } from "@merchant/contracts";
import { ConflictException, Inject, Injectable } from "@nestjs/common";

import type { ReadScope, ReadSnapshot } from "../../../shared/query/read-snapshot.js";
import { receiptAllocation } from "../domain/receipt-allocation.js";
import { BILLING_RECEIPT_READER, type BillingReceiptReader } from "./billing-receipt-reader.js";
import { toCheckout, toSaleRefunds } from "./billing.service.js";

const unavailable = () =>
  new ConflictException({
    code: "RECEIPT_ALLOCATION_UNAVAILABLE",
    message: "The saved financial snapshot cannot be represented on a visit document.",
  });

export type OrderReceiptSnapshot = {
  orderId: string;
  tableSessionId: string | null;
  receipt: Omit<Receipt, "order">;
};

@Injectable()
export class BillingReceiptQueries {
  constructor(@Inject(BILLING_RECEIPT_READER) private readonly reader: BillingReceiptReader) {}

  /** Read every bill in the same snapshot as the caller's complete, scoped order list. */
  async read(
    scope: ReadScope,
    orderIds: readonly string[],
    snapshot: ReadSnapshot,
  ): Promise<OrderReceiptSnapshot[]> {
    const entries = await this.reader.read(scope, orderIds, snapshot);
    const seen = new Set<string>();
    const counts = new Map<string, number>();
    for (const entry of entries) {
      for (const { payment } of entry.allocations)
        counts.set(payment.id, (counts.get(payment.id) ?? 0) + 1);
    }
    return entries.map(({ bill, sale, allocations, refunds, scopeValid }) => {
      const allocation = allocations[0];
      if (
        !scopeValid ||
        !orderIds.includes(bill.orderId) ||
        seen.has(bill.orderId) ||
        bill.status !== "PAID" ||
        !sale ||
        !allocation ||
        !allocation.cashierName
      )
        throw unavailable();
      seen.add(bill.orderId);
      const { payment, cashierName } = allocation;
      if (
        counts.get(payment.id) !== allocation.paymentAllocationCount ||
        sale.totalMinor !== bill.totalMinor ||
        refunds.reduce((sum, refund) => sum + refund.amountMinor, 0n) > sale.totalMinor
      )
        throw unavailable();
      const paymentAllocation = receiptAllocation({
        allocation: {
          amountMinor: allocation.amountMinor,
          billAllocationCount: allocations.length,
          paymentAllocationCount: allocation.paymentAllocationCount,
        },
        bill,
        payment,
      });
      if (!paymentAllocation) throw unavailable();
      const returned = toSaleRefunds({ sale, refunds });
      return {
        orderId: bill.orderId,
        tableSessionId: bill.tableSessionId,
        receipt: {
          ...toCheckout({ bill, payment, sale }),
          cashierName,
          paymentAllocation,
          refundableMinor: returned.refundableMinor,
          refunds: returned.refunds,
        },
      };
    });
  }
}
