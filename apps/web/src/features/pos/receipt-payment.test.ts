import assert from "node:assert/strict";
import test from "node:test";
import type { Payment } from "@merchant/contracts";

import { orderReceiptPayment } from "./receipt-payment.ts";

const payment: Payment = {
  id: "019f738d-e61f-7d46-92de-17b35f979300",
  amountMinor: "75000",
  tenderedMinor: "100000",
  changeMinor: "25000",
  method: "CASH",
  status: "PAID",
  confirmedAt: "2026-10-19T10:00:00.000Z",
  reference: null,
};

test("shared cash receipt hides group tender/change and uses the persisted order allocation", () => {
  const original = { ...payment };
  assert.deepEqual(
    orderReceiptPayment({ payment, paymentAllocation: { amountMinor: "50000", shared: true } }),
    { amountMinor: "50000", changeMinor: null, method: "CASH", reference: null, shared: true },
  );
  assert.deepEqual(
    payment,
    original,
    "printing must not rewrite the ledger's transaction snapshot",
  );
});

test("single cash still shows cash handed over and its change; non-cash shared uses its allocation", () => {
  assert.equal(
    orderReceiptPayment({ payment, paymentAllocation: { amountMinor: "75000", shared: false } })
      .amountMinor,
    "100000",
  );
  assert.equal(
    orderReceiptPayment({ payment, paymentAllocation: { amountMinor: "75000", shared: false } })
      .changeMinor,
    "25000",
  );
  assert.deepEqual(
    orderReceiptPayment({
      payment: {
        ...payment,
        method: "TRANSFER",
        tenderedMinor: null,
        changeMinor: null,
        reference: "BCA-001",
      },
      paymentAllocation: { amountMinor: "25000", shared: true },
    }),
    {
      amountMinor: "25000",
      changeMinor: null,
      method: "TRANSFER",
      reference: "BCA-001",
      shared: true,
    },
  );
});
