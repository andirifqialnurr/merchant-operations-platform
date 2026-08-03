import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertServerAcknowledgement,
  isServerAcknowledgedOperation,
  SERVER_ACKNOWLEDGED_OPERATIONS,
} from "./server-acknowledgement";

test("lists Version 1 operations that must never run from cached PWA state", () => {
  assert.deepEqual(SERVER_ACKNOWLEDGED_OPERATIONS, [
    "submit-order",
    "payment-confirmation",
    "refund",
    "stock-adjustment",
    "approval",
    "shift-closing",
  ]);
  assert.equal(isServerAcknowledgedOperation("payment-confirmation"), true);
  assert.equal(isServerAcknowledgedOperation("menu-read"), false);
});

test("blocks financial and stock operations until the server has acknowledged them", () => {
  assert.throws(
    () =>
      assertServerAcknowledgement("payment-confirmation", {
        online: false,
        serverAcknowledged: false,
      }),
    /Pembayaran membutuhkan konfirmasi server/,
  );
  assert.throws(
    () =>
      assertServerAcknowledgement("stock-adjustment", {
        online: true,
        serverAcknowledged: false,
      }),
    /Stok membutuhkan konfirmasi server/,
  );

  assert.deepEqual(
    assertServerAcknowledgement("stock-adjustment", {
      online: true,
      serverAcknowledged: true,
    }),
    {
      operation: "stock-adjustment",
      serverAcknowledged: true,
    },
  );
});
