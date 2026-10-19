import type { Receipt } from "@merchant/contracts";

/** Receipt view only: never change the original payment snapshot used by ledger/refunds. */
export function orderReceiptPayment(receipt: Pick<Receipt, "payment" | "paymentAllocation">) {
  const { payment, paymentAllocation } = receipt;
  return {
    amountMinor: paymentAllocation.shared
      ? paymentAllocation.amountMinor
      : (payment.tenderedMinor ?? payment.amountMinor),
    changeMinor: paymentAllocation.shared ? null : payment.changeMinor,
    method: payment.method,
    reference: payment.reference,
    shared: paymentAllocation.shared,
  };
}
