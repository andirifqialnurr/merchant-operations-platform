import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { computeCharges, type Order, type Receipt } from "@merchant/contracts";

import { visitFinancialDocument, type VisitDocumentSource } from "./visit-financial-document.js";

const sessionId = randomUUID();
const outletId = randomUUID();
const now = "2026-10-20T08:00:00.000Z";
const charges = { included: true, serviceChargeRateBp: 0, taxRateBp: 0 };

function order(number: number, amount = "50000", currency = "IDR"): Order {
  return {
    cancelReason: null,
    canceledAt: null,
    createdAt: now,
    currency,
    id: randomUUID(),
    items: [
      {
        id: randomUUID(),
        lineTotalMinor: amount,
        modifiers: [],
        name: "Kopi",
        note: null,
        productId: null,
        quantity: 1,
        unitPriceMinor: amount,
        variantName: null,
      },
    ],
    moderationStatus: "NOT_REQUIRED",
    note: null,
    orderNumber: number,
    orderType: "DINE_IN",
    outletId,
    source: "POS",
    status: "SUBMITTED",
    submittedAt: now,
    subtotalMinor: amount,
    tableSessionId: sessionId,
  };
}

function paid(taken: Order, payment: Partial<Receipt["payment"]> = {}): Receipt {
  return {
    bill: {
      chargesIncluded: charges.included,
      serviceChargeRateBp: charges.serviceChargeRateBp,
      taxRateBp: charges.taxRateBp,
      currency: taken.currency,
      discountMinor: "0",
      id: randomUUID(),
      orderId: taken.id,
      paidMinor: taken.subtotalMinor,
      roundingMinor: "0",
      serviceChargeMinor: "0",
      status: "PAID",
      subtotalMinor: taken.subtotalMinor,
      taxMinor: "0",
      totalMinor: taken.subtotalMinor,
    },
    cashierName: "Kasir",
    order: taken,
    payment: {
      amountMinor: taken.subtotalMinor,
      changeMinor: "0",
      confirmedAt: now,
      id: randomUUID(),
      method: "CASH",
      reference: null,
      status: "PAID",
      tenderedMinor: taken.subtotalMinor,
      ...payment,
    },
    paymentAllocation: { amountMinor: taken.subtotalMinor, shared: false },
    refundableMinor: taken.subtotalMinor,
    refunds: [],
    sale: {
      completedAt: now,
      id: randomUUID(),
      saleNumber: taken.orderNumber,
      status: "COMPLETED",
      totalMinor: taken.subtotalMinor,
    },
  };
}

function source(receipts: Receipt[] = [], unpaidOrders: Order[] = []): VisitDocumentSource {
  return { charges, currency: "IDR", outletId, receipts, sessionId, unpaidOrders };
}

function shared() {
  const first = paid(order(1), {
    amountMinor: "75000",
    tenderedMinor: "100000",
    changeMinor: "25000",
  });
  const second = paid(order(2, "25000"), first.payment);
  first.paymentAllocation.shared = second.paymentAllocation.shared = true;
  return [first, second];
}

test("one visit counts a shared payment once, preserving cash tender/change once", () => {
  const receipts = shared();
  const original = structuredClone(receipts);
  const doc = visitFinancialDocument(source(receipts));
  assert.ok(doc);
  assert.equal(doc.kind, "RECEIPT");
  assert.equal(doc.state, "PAID");
  assert.equal(doc.orders.length, 2);
  assert.equal(doc.payments.length, 1);
  assert.equal(doc.payments[0]!.tenderedMinor, "100000");
  assert.equal(doc.payments[0]!.changeMinor, "25000");
  assert.equal(doc.totals.totalMinor, "75000");
  assert.equal(doc.totals.paidMinor, "75000");
  assert.equal(doc.totals.dueMinor, "0");
  assert.deepEqual(receipts, original, "projection cannot rewrite its source ledger or snapshots");
});

test("legacy per-order and later visit payments coexist, with unique non-cash references", () => {
  const receipts = shared();
  receipts.push(
    paid(order(3, "10000"), {
      method: "TRANSFER",
      tenderedMinor: null,
      changeMinor: null,
      reference: "BANK-1",
    }),
  );
  const doc = visitFinancialDocument(source(receipts));
  assert.ok(doc);
  assert.equal(doc.payments.length, 2);
  assert.equal(doc.totals.paidMinor, "85000");
  assert.equal(doc.payments.filter((payment) => payment.reference === "BANK-1").length, 1);
});

test("pending is not priced debt, canceled orders disappear, and partial payment is a bill", () => {
  const pending = {
    ...order(3, "99999"),
    moderationStatus: "PENDING" as const,
    source: "SELF_ORDER" as const,
  };
  const canceled = { ...order(4), status: "CANCELED" as const };
  const input = source([paid(order(1))], [order(2, "25000"), pending, canceled]);
  let doc = visitFinancialDocument(input);
  assert.ok(doc);
  assert.equal(doc.state, "PENDING");
  assert.equal(doc.kind, "BILL");
  assert.equal(doc.pendingOrders.length, 1);
  assert.equal(doc.orders.length, 2);
  assert.equal(doc.totals.totalMinor, "75000");
  assert.equal(doc.totals.dueMinor, "25000");
  input.unpaidOrders = [input.unpaidOrders[0]!];
  doc = visitFinancialDocument(input);
  assert.equal(doc?.state, "PARTIALLY_PAID");
  assert.equal(visitFinancialDocument(source([], [pending]))?.state, "PENDING");
  assert.equal(visitFinancialDocument(source())?.state, "EMPTY");
  assert.equal(visitFinancialDocument(source([], [canceled]))?.kind, "BILL");
  assert.equal(
    visitFinancialDocument(source([], [order(5, "0")]))?.state,
    "UNPAID",
    "zero-price unpaid order is not a receipt",
  );
});

test("paid tax/service snapshots stay fixed while unpaid orders use current included or added rates", () => {
  for (const chargesIncluded of [true, false]) {
    const input = source([paid(order(1))], [order(2)]);
    input.charges = { included: chargesIncluded, serviceChargeRateBp: 500, taxRateBp: 1100 };
    const doc = visitFinancialDocument(input);
    const parts = computeCharges(50000n, input.charges);
    assert.ok(doc);
    assert.equal(doc.orders[0]!.pricing.totalMinor, "50000");
    assert.equal(doc.orders[0]!.pricing.taxRateBp, 0);
    assert.equal(doc.orders[1]!.pricing.source, "CURRENT_CHARGES");
    assert.equal(doc.orders[1]!.pricing.totalMinor, parts.totalMinor.toString());
    assert.equal(doc.totals.totalMinor, (50000n + parts.totalMinor).toString());
    assert.equal(
      BigInt(doc.totals.subtotalMinor) +
        BigInt(doc.totals.taxMinor) +
        BigInt(doc.totals.serviceChargeMinor),
      BigInt(doc.totals.totalMinor),
    );
  }
});

test("historical included/added snapshots, discounts and signed rounding aggregate without repricing", () => {
  const included = paid(order(1, "10000"));
  included.bill.subtotalMinor = "9009";
  included.bill.taxMinor = "991";
  included.bill.taxRateBp = 1100;
  const added = paid(order(2, "20000"), {
    amountMinor: "22199",
    tenderedMinor: "25000",
    changeMinor: "2801",
  });
  Object.assign(added.bill, {
    chargesIncluded: false,
    discountMinor: "1000",
    serviceChargeMinor: "1000",
    serviceChargeRateBp: 500,
    taxMinor: "2200",
    taxRateBp: 1100,
    roundingMinor: "-1",
    paidMinor: "22199",
    totalMinor: "22199",
  });
  added.sale.totalMinor = added.paymentAllocation.amountMinor = added.refundableMinor = "22199";
  const doc = visitFinancialDocument(source([included, added]));
  assert.ok(doc);
  assert.equal(doc.kind, "RECEIPT");
  assert.equal(doc.orders[0]!.pricing.chargesIncluded, true);
  assert.equal(doc.orders[1]!.pricing.chargesIncluded, false);
  assert.equal(doc.totals.subtotalMinor, "29009");
  assert.equal(doc.totals.discountMinor, "1000");
  assert.equal(doc.totals.serviceChargeMinor, "1000");
  assert.equal(doc.totals.taxMinor, "3191");
  assert.equal(doc.totals.roundingMinor, "-1");
  assert.equal(doc.totals.totalMinor, "32199");
  assert.equal(doc.totals.paidMinor, "32199");
});

test("duplicate identical refund IDs count once, partial/full refunds never reopen debt", () => {
  const receipts = shared();
  const first = receipts[0]!;
  const refund = {
    id: randomUUID(),
    createdAt: now,
    amountMinor: "10000",
    method: "CASH" as const,
    reason: "Returned item",
  };
  first.refunds = [refund, structuredClone(refund)];
  first.refundableMinor = "40000";
  first.sale.status = "PARTIALLY_REFUNDED";
  let doc = visitFinancialDocument(source(receipts));
  assert.equal(doc?.refunds.length, 1);
  assert.equal(doc?.totals.refundedMinor, "10000");
  assert.equal(doc?.totals.netPaidMinor, "65000");
  first.refunds.push({ ...refund, id: randomUUID(), amountMinor: "40000" });
  first.refundableMinor = "0";
  first.sale.status = "REFUNDED";
  doc = visitFinancialDocument(source(receipts));
  assert.equal(doc?.kind, "RECEIPT");
  assert.equal(doc?.totals.paidMinor, "75000");
  assert.equal(doc?.totals.netPaidMinor, "25000");
  assert.equal(doc?.totals.dueMinor, "0");
});

test("partial or cross-visit shared payment and conflicting snapshots fail closed", () => {
  assert.equal(visitFinancialDocument(source([shared()[0]!])), null);
  for (const mutate of [
    (r: Receipt[]) => {
      r[1]!.payment.tenderedMinor = "100001";
      r[1]!.payment.changeMinor = "25001";
    },
    (r: Receipt[]) => {
      r[1]!.payment.reference = "different";
    },
    (r: Receipt[]) => {
      r[1]!.cashierName = "Other cashier";
    },
    (r: Receipt[]) => {
      r[1]!.paymentAllocation.shared = false;
    },
    (r: Receipt[]) => {
      r[1]!.order.tableSessionId = randomUUID();
    },
    (r: Receipt[]) => {
      r[1]!.bill.orderId = randomUUID();
    },
    (r: Receipt[]) => {
      r[1]!.bill.paidMinor = "1";
    },
    (r: Receipt[]) => {
      r[1]!.bill.taxMinor = "1";
    },
    (r: Receipt[]) => {
      r[1]!.payment.status = "VERIFYING";
    },
    (r: Receipt[]) => {
      r[1]!.sale.status = "REFUNDED";
    },
    (r: Receipt[]) => {
      r[1]!.paymentAllocation.amountMinor = "24999";
    },
  ]) {
    const receipts = shared();
    mutate(receipts);
    assert.equal(visitFinancialDocument(source(receipts)), null);
  }
});

test("duplicate orders/bills/sales, mixed currency/outlet and inconsistent item snapshots fail closed", () => {
  const first = paid(order(1));
  assert.equal(visitFinancialDocument(source([first, first])), null);
  assert.equal(visitFinancialDocument(source([first], [first.order])), null);
  for (const mutate of [
    (r: Receipt) => {
      r.order.outletId = randomUUID();
    },
    (r: Receipt) => {
      r.bill.currency = "USD";
    },
    (r: Receipt) => {
      r.order.items[0]!.quantity = 2;
    },
    (r: Receipt) => {
      r.order.status = "CANCELED";
    },
    (r: Receipt) => {
      r.order.moderationStatus = "PENDING";
    },
    (r: Receipt) => {
      r.payment.changeMinor = "1";
    },
    (r: Receipt) => {
      r.sale.totalMinor = "1";
    },
  ]) {
    const receipt = paid(order(1));
    mutate(receipt);
    assert.equal(visitFinancialDocument(source([receipt])), null);
  }
  for (const key of ["bill", "sale"] as const) {
    const second = paid(order(2));
    second[key].id = first[key].id;
    assert.equal(visitFinancialDocument(source([first, second])), null);
  }
});

test("conflicting refund IDs, wrong method, over-refunds and stale refundable snapshots fail closed", () => {
  const first = paid(order(1));
  const refund = {
    id: randomUUID(),
    createdAt: now,
    amountMinor: "10000",
    method: "CASH" as const,
    reason: "Returned item",
  };
  first.refunds = [refund];
  first.refundableMinor = "40000";
  first.sale.status = "PARTIALLY_REFUNDED";
  for (const mutate of [
    (r: Receipt) => {
      r.refunds.push({ ...refund, reason: "Conflicting reason" });
    },
    (r: Receipt) => {
      r.refunds[0]!.method = "TRANSFER";
    },
    (r: Receipt) => {
      r.refunds[0]!.amountMinor = "50001";
    },
    (r: Receipt) => {
      r.refundableMinor = "50000";
    },
  ]) {
    const receipt = structuredClone(first);
    mutate(receipt);
    assert.equal(visitFinancialDocument(source([receipt])), null);
  }
});

test("USD cents and values above Number.MAX_SAFE_INTEGER stay exact", () => {
  for (const amount of ["1025", "9007199254740993"]) {
    const input = source([paid(order(1, amount, "USD"))], [order(2, "2050", "USD")]);
    input.currency = "USD";
    const doc = visitFinancialDocument(input);
    assert.ok(doc);
    assert.equal(doc.totals.totalMinor, (BigInt(amount) + 2050n).toString());
    assert.equal(doc.totals.paidMinor, amount);
    assert.equal(doc.totals.dueMinor, "2050");
  }
});
