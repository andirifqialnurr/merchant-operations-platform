import {
  computeCharges,
  isOrderApproved,
  orderSchema,
  receiptSchema,
  visitFinancialDocumentSchema,
  type Order,
  type OutletCharges,
  type Receipt,
  type VisitFinancialDocument,
  type VisitOrderPricing,
} from "@merchant/contracts";

/** Inputs must come from scoped, consistent kernel reads, not a client-submitted payload. */
export type VisitDocumentSource = {
  currency: string;
  outletId: string;
  sessionId: string;
  charges: OutletCharges;
  receipts: readonly Receipt[];
  unpaidOrders: readonly Order[];
};

function sameFields(a: object, b: object) {
  const left = Object.entries(a);
  const right = Object.entries(b);
  return (
    left.length === right.length && left.every(([key, value]) => Reflect.get(b, key) === value)
  );
}

const sumFields = [
  "discountMinor",
  "roundingMinor",
  "serviceChargeMinor",
  "subtotalMinor",
  "taxMinor",
  "totalMinor",
] as const;

/**
 * One visit document, not a concatenation of order receipts. No monetary mutation.
 * Null means the input cannot represent an honest R1 document; callers must not print it.
 */
export function visitFinancialDocument(source: VisitDocumentSource): VisitFinancialDocument | null {
  const orders: VisitFinancialDocument["orders"] = [];
  const pendingOrders: Order[] = [];
  const payments = new Map<string, VisitFinancialDocument["payments"][number]>();
  const refunds = new Map<string, VisitFinancialDocument["refunds"][number]>();
  const allocations = new Map<string, { amount: bigint; count: number; shared: boolean }>();
  const seenOrders = new Set<string>();
  const seenBills = new Set<string>();
  const seenSales = new Set<string>();

  const validOrder = (order: Order) => {
    if (
      seenOrders.has(order.id) ||
      order.tableSessionId !== source.sessionId ||
      order.outletId !== source.outletId ||
      order.currency !== source.currency
    )
      return false;
    seenOrders.add(order.id);
    return (
      order.items.every(
        (item) =>
          BigInt(item.lineTotalMinor) === BigInt(item.unitPriceMinor) * BigInt(item.quantity),
      ) &&
      order.items.reduce((sum, item) => sum + BigInt(item.lineTotalMinor), 0n) ===
        BigInt(order.subtotalMinor)
    );
  };

  for (const input of source.receipts) {
    const parsed = receiptSchema.safeParse(input);
    if (!parsed.success) return null;
    const { order, bill, payment, paymentAllocation, sale, cashierName } = parsed.data;
    if (
      !validOrder(order) ||
      !isOrderApproved(order) ||
      order.status === "CANCELED" ||
      bill.orderId !== order.id ||
      bill.currency !== source.currency ||
      bill.status !== "PAID" ||
      payment.status !== "PAID" ||
      !payment.confirmedAt ||
      !sale.completedAt ||
      seenBills.has(bill.id) ||
      seenSales.has(sale.id) ||
      bill.totalMinor !== bill.paidMinor ||
      bill.totalMinor !== sale.totalMinor ||
      bill.totalMinor !== paymentAllocation.amountMinor
    )
      return null;
    seenBills.add(bill.id);
    seenSales.add(sale.id);
    const total = BigInt(bill.totalMinor);
    if (
      BigInt(bill.subtotalMinor) -
        BigInt(bill.discountMinor) +
        BigInt(bill.serviceChargeMinor) +
        BigInt(bill.taxMinor) +
        BigInt(bill.roundingMinor) !==
      total
    )
      return null;
    if (
      payment.method === "CASH"
        ? payment.tenderedMinor === null ||
          payment.changeMinor === null ||
          BigInt(payment.tenderedMinor) - BigInt(payment.amountMinor) !==
            BigInt(payment.changeMinor)
        : payment.tenderedMinor !== null || payment.changeMinor !== null
    )
      return null;

    const transaction = { ...payment, cashierName };
    const existing = payments.get(payment.id);
    if (existing && !sameFields(existing, transaction)) return null;
    payments.set(payment.id, transaction);
    const allocation = allocations.get(payment.id) ?? {
      amount: 0n,
      count: 0,
      shared: paymentAllocation.shared,
    };
    if (allocation.shared !== paymentAllocation.shared) return null;
    allocation.amount += BigInt(paymentAllocation.amountMinor);
    allocation.count++;
    allocations.set(payment.id, allocation);

    let refunded = 0n;
    const refundIds = new Set<string>();
    for (const refund of parsed.data.refunds) {
      const row = { ...refund, orderId: order.id };
      const previous = refunds.get(refund.id);
      if (previous && !sameFields(previous, row)) return null;
      if (refund.method !== payment.method) return null;
      refunds.set(refund.id, row);
      if (!refundIds.has(refund.id)) refunded += BigInt(refund.amountMinor);
      refundIds.add(refund.id);
    }
    const saleState =
      refunded === total ? "REFUNDED" : refunded > 0n ? "PARTIALLY_REFUNDED" : "COMPLETED";
    if (
      refunded > total ||
      BigInt(parsed.data.refundableMinor) !== total - refunded ||
      sale.status !== saleState
    )
      return null;
    const { id: _id, orderId: _orderId, paidMinor: _paid, status: _status, ...pricing } = bill;
    void [_id, _orderId, _paid, _status];
    orders.push({
      order,
      paymentId: payment.id,
      pricing: { ...pricing, source: "PAID_SNAPSHOT" },
      sale,
    });
  }

  for (const input of source.unpaidOrders) {
    const parsed = orderSchema.safeParse(input);
    if (!parsed.success || !validOrder(parsed.data)) return null;
    const order = parsed.data;
    if (order.status === "CANCELED") continue;
    if (!isOrderApproved(order)) {
      if (order.moderationStatus !== "PENDING") return null;
      pendingOrders.push(order);
      continue;
    }
    const parts = computeCharges(BigInt(order.subtotalMinor), source.charges);
    const pricing: VisitOrderPricing = {
      chargesIncluded: source.charges.included,
      serviceChargeRateBp: source.charges.serviceChargeRateBp,
      taxRateBp: source.charges.taxRateBp,
      currency: source.currency,
      discountMinor: "0",
      roundingMinor: "0",
      serviceChargeMinor: parts.serviceChargeMinor.toString(),
      source: "CURRENT_CHARGES",
      subtotalMinor: parts.baseMinor.toString(),
      taxMinor: parts.taxMinor.toString(),
      totalMinor: parts.totalMinor.toString(),
    };
    orders.push({ order, paymentId: null, pricing, sale: null });
  }

  // Reject incomplete or cross-visit shared transactions instead of attributing all cash to this visit.
  for (const [id, allocation] of allocations) {
    if (
      allocation.amount !== BigInt(payments.get(id)!.amountMinor) ||
      allocation.shared !== allocation.count > 1
    )
      return null;
  }
  const sums = Object.fromEntries(
    sumFields.map((key) => [
      key,
      orders.reduce((sum, row) => sum + BigInt(row.pricing[key]), 0n).toString(),
    ]),
  );
  const paid = [...payments.values()].reduce(
    (sum, payment) => sum + BigInt(payment.amountMinor),
    0n,
  );
  const refunded = [...refunds.values()].reduce(
    (sum, refund) => sum + BigInt(refund.amountMinor),
    0n,
  );
  const due = orders
    .filter((row) => !row.paymentId)
    .reduce((sum, row) => sum + BigInt(row.pricing.totalMinor), 0n);
  const unpaid = orders.some((row) => !row.paymentId);
  const state =
    pendingOrders.length > 0
      ? "PENDING"
      : unpaid
        ? paid > 0n
          ? "PARTIALLY_PAID"
          : "UNPAID"
        : orders.length > 0
          ? "PAID"
          : "EMPTY";
  const result = visitFinancialDocumentSchema.safeParse({
    currency: source.currency,
    kind: state === "PAID" ? "RECEIPT" : "BILL",
    orders: orders.sort((a, b) => a.order.orderNumber - b.order.orderNumber),
    pendingOrders: pendingOrders.sort((a, b) => a.orderNumber - b.orderNumber),
    payments: [...payments.values()].sort(
      (a, b) => a.confirmedAt!.localeCompare(b.confirmedAt!) || a.id.localeCompare(b.id),
    ),
    refunds: [...refunds.values()].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    ),
    state,
    totals: {
      ...sums,
      dueMinor: due.toString(),
      netPaidMinor: (paid - refunded).toString(),
      paidMinor: paid.toString(),
      refundedMinor: refunded.toString(),
    },
  });
  return result.success ? result.data : null;
}
