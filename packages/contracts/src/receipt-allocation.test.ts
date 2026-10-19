import assert from "node:assert/strict";
import test from "node:test";

import { payOrderSchema, receiptPaymentAllocationSchema, refundOrderSchema } from "./billing.ts";

test("receipt allocations are explicit read-only amounts and shared scope, without invented tender/change", () => {
  assert.deepEqual(
    receiptPaymentAllocationSchema.parse({ amountMinor: "9007199254740993", shared: true }),
    { amountMinor: "9007199254740993", shared: true },
  );
  assert.equal(receiptPaymentAllocationSchema.safeParse({ amountMinor: "50000" }).success, false);
  assert.equal(
    receiptPaymentAllocationSchema.safeParse({ amountMinor: "0", shared: true }).success,
    false,
  );
  assert.equal(
    receiptPaymentAllocationSchema.safeParse({ amountMinor: 50000, shared: true }).success,
    false,
  );
  assert.equal(
    receiptPaymentAllocationSchema.safeParse({
      amountMinor: "50000",
      shared: true,
      tenderedMinor: "100000",
    }).success,
    false,
  );
});

test("payment and refund inputs never acquire receipt allocation ownership", () => {
  const paymentAllocation = { amountMinor: "1", shared: false };
  assert.deepEqual(
    payOrderSchema.parse({ method: "CASH", tenderedMinor: "100000", paymentAllocation }),
    { method: "CASH", tenderedMinor: "100000" },
  );
  assert.deepEqual(
    refundOrderSchema.parse({ amountMinor: "10000", reason: "Returned item", paymentAllocation }),
    { amountMinor: "10000", reason: "Returned item" },
  );
});
