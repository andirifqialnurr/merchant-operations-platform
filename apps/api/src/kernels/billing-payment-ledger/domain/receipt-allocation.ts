type ReceiptAllocationSource = {
  allocation: { amountMinor: bigint; billAllocationCount: number; paymentAllocationCount: number };
  bill: { paidMinor: bigint; totalMinor: bigint };
  payment: { amountMinor: bigint };
};

/** R1 has one payment allocation per paid bill. Never invent a proportional cash tender/change. */
export function receiptAllocation({ allocation, bill, payment }: ReceiptAllocationSource) {
  if (
    allocation.billAllocationCount !== 1 ||
    !Number.isSafeInteger(allocation.paymentAllocationCount) ||
    allocation.paymentAllocationCount < 1 ||
    allocation.amountMinor <= 0n ||
    payment.amountMinor <= 0n ||
    bill.paidMinor !== bill.totalMinor ||
    allocation.amountMinor !== bill.paidMinor ||
    allocation.amountMinor > payment.amountMinor ||
    (allocation.paymentAllocationCount === 1 && allocation.amountMinor !== payment.amountMinor)
  )
    return null;
  return {
    amountMinor: allocation.amountMinor.toString(),
    shared: allocation.paymentAllocationCount > 1,
  };
}
