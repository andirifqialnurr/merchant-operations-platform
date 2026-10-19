import assert from "node:assert/strict";
import test from "node:test";

import { receiptAllocation } from "./receipt-allocation.js";

const source = {
  allocation: { amountMinor: 50_000n, billAllocationCount: 1, paymentAllocationCount: 2 },
  bill: { paidMinor: 50_000n, totalMinor: 50_000n },
  payment: { amountMinor: 75_000n },
};

test("an order receipt uses its actual allocation, not the shared payment or a guessed share", () => {
  assert.deepEqual(receiptAllocation(source), { amountMinor: "50000", shared: true });
  assert.deepEqual(
    receiptAllocation({
      ...source,
      allocation: { ...source.allocation, paymentAllocationCount: 1 },
      payment: { amountMinor: 50_000n },
    }),
    { amountMinor: "50000", shared: false },
  );
});

test("unsupported multi-tender or inconsistent ledger reads fail closed without inventing a receipt", () => {
  for (const count of [0, 2, -1])
    assert.equal(
      receiptAllocation({
        ...source,
        allocation: { ...source.allocation, billAllocationCount: count },
      }),
      null,
    );
  for (const count of [0, -1, 1.5, Number.NaN])
    assert.equal(
      receiptAllocation({
        ...source,
        allocation: { ...source.allocation, paymentAllocationCount: count },
      }),
      null,
    );
  assert.equal(
    receiptAllocation({ ...source, allocation: { ...source.allocation, amountMinor: 49_999n } }),
    null,
  );
  assert.equal(
    receiptAllocation({ ...source, allocation: { ...source.allocation, amountMinor: -1n } }),
    null,
  );
  assert.equal(receiptAllocation({ ...source, bill: { ...source.bill, paidMinor: 1n } }), null);
  assert.equal(
    receiptAllocation({
      ...source,
      allocation: { ...source.allocation, amountMinor: 0n },
      bill: { paidMinor: 0n, totalMinor: 0n },
    }),
    null,
  );
  assert.equal(receiptAllocation({ ...source, payment: { amountMinor: 49_999n } }), null);
  assert.equal(
    receiptAllocation({
      ...source,
      allocation: { ...source.allocation, paymentAllocationCount: 1 },
    }),
    null,
  );
});

test("allocation projection preserves exact integer minor units, including cents and values above Number.MAX_SAFE_INTEGER", () => {
  for (const amount of [1_025n, 9_007_199_254_740_993n]) {
    assert.deepEqual(
      receiptAllocation({
        allocation: { ...source.allocation, amountMinor: amount },
        bill: { totalMinor: amount, paidMinor: amount },
        payment: { amountMinor: amount + 2_050n },
      }),
      { amountMinor: amount.toString(), shared: true },
    );
  }
});
