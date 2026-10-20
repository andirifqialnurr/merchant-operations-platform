import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { BillingReceiptQueries } from "./billing-receipt-queries.js";
import type { ReceiptLedgerEntry } from "./billing-receipt-reader.js";

const scope = { tenantId: randomUUID(), outletId: randomUUID() };
const snapshot = { ...scope, lifetime: Symbol("test") };
const now = new Date("2026-10-20T08:00:00Z");

function entry(): ReceiptLedgerEntry {
  return {
    scopeValid: true,
    bill: {
      chargesIncluded: true,
      currency: "IDR",
      discountMinor: 0n,
      id: randomUUID(),
      orderId: randomUUID(),
      paidMinor: 50000n,
      roundingMinor: 0n,
      serviceChargeMinor: 0n,
      serviceChargeRateBp: 0,
      status: "PAID",
      subtotalMinor: 50000n,
      tableSessionId: null,
      taxMinor: 0n,
      taxRateBp: 0,
      totalMinor: 50000n,
    },
    sale: {
      completedAt: now,
      id: randomUUID(),
      saleNumber: 1,
      status: "COMPLETED",
      totalMinor: 50000n,
    },
    refunds: [],
    allocations: [
      {
        amountMinor: 50000n,
        cashierName: "Kasir",
        paymentAllocationCount: 1,
        payment: {
          amountMinor: 50000n,
          confirmedAt: now,
          id: randomUUID(),
          method: "CASH",
          reference: null,
          status: "PAID",
          tenderedMinor: 100000n,
        },
      },
    ],
  };
}

const query = (entries: ReceiptLedgerEntry[]) =>
  new BillingReceiptQueries({ read: async () => entries });
const unavailable = (error: unknown) => {
  assert.equal((error as { getStatus(): number }).getStatus(), 409);
  assert.equal(
    (error as { getResponse(): { code: string } }).getResponse().code,
    "RECEIPT_ALLOCATION_UNAVAILABLE",
  );
  return true;
};

test("receipt query passes one scope/capability and maps authoritative allocation/refunds, not live pricing", async () => {
  const saved = entry();
  saved.refunds = [
    {
      amountMinor: 10000n,
      createdAt: now,
      id: randomUUID(),
      method: "CASH",
      reason: "Returned item",
    },
  ];
  saved.sale!.status = "PARTIALLY_REFUNDED";
  const ids = [saved.bill.orderId];
  const reader = new BillingReceiptQueries({
    read: async (actualScope, actualIds, actualSnapshot) => {
      assert.equal(actualScope, scope);
      assert.equal(actualIds, ids);
      assert.equal(actualSnapshot, snapshot);
      return [saved];
    },
  });
  const [result] = await reader.read(scope, ids, snapshot);
  assert.ok(result);
  assert.equal(result.orderId, saved.bill.orderId);
  assert.equal(result.tableSessionId, null, "legacy per-order bill has no visit payment reference");
  assert.equal(result.receipt.payment.changeMinor, "50000");
  assert.equal(result.receipt.refundableMinor, "40000");
  assert.deepEqual(result.receipt.paymentAllocation, { amountMinor: "50000", shared: false });
  assert.deepEqual(await query([]).read(scope, ids, snapshot), []);
});

test("broken paid records cannot disappear and become unpaid documents", async () => {
  const mutations: Array<(record: ReceiptLedgerEntry) => void> = [
    (record) => {
      record.scopeValid = false;
    },
    (record) => {
      record.sale = null;
    },
    (record) => {
      record.allocations = [];
    },
    (record) => {
      record.allocations[0]!.cashierName = null;
    },
    (record) => {
      record.bill.status = "UNPAID";
    },
    (record) => {
      record.allocations.push(structuredClone(record.allocations[0]!));
    },
    (record) => {
      record.allocations[0]!.amountMinor = 49999n;
    },
    (record) => {
      record.allocations[0]!.paymentAllocationCount = 2;
    },
    (record) => {
      record.sale!.totalMinor = 49999n;
    },
    (record) => {
      record.refunds.push({
        amountMinor: 50001n,
        createdAt: now,
        id: randomUUID(),
        method: "CASH",
        reason: "Too much",
      });
    },
  ];
  for (const mutate of mutations) {
    const saved = entry();
    mutate(saved);
    await assert.rejects(query([saved]).read(scope, [saved.bill.orderId], snapshot), unavailable);
  }
  const saved = entry();
  await assert.rejects(
    query([saved, saved]).read(scope, [saved.bill.orderId], snapshot),
    unavailable,
  );
  await assert.rejects(query([saved]).read(scope, [randomUUID()], snapshot), unavailable);
});

test("every shared payment allocation must be contained in the scoped visit query", async () => {
  const first = entry();
  const second = entry();
  const payment = { ...first.allocations[0]!.payment, amountMinor: 100000n };
  for (const current of [first, second]) {
    current.allocations[0]!.payment = payment;
    current.allocations[0]!.paymentAllocationCount = 2;
  }
  const ids = [first.bill.orderId, second.bill.orderId];
  const results = await query([first, second]).read(scope, ids, snapshot);
  assert.equal(results.length, 2);
  assert.equal(results[0]!.receipt.paymentAllocation.shared, true);
  assert.equal(results[0]!.receipt.payment.amountMinor, "100000");
  assert.equal(results[0]!.receipt.paymentAllocation.amountMinor, "50000");
  await assert.rejects(query([first]).read(scope, ids, snapshot), unavailable);
});
