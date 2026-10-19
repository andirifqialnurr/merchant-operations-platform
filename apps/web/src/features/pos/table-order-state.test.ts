import assert from "node:assert/strict";
import test from "node:test";

import { isPendingGuestOrder, visitHasPending, visitOrderLabel } from "./table-order-state.ts";

const pending = { moderationStatus: "PENDING", status: "SUBMITTED", paid: false } as const;

test("pending estimates are neither paid nor unpaid and block settlement even at zero debt", () => {
  assert.equal(isPendingGuestOrder(pending), true);
  assert.equal(visitOrderLabel(pending), "orderPending");
  assert.equal(visitOrderLabel({ ...pending, paid: true }), "orderPending");
  assert.equal(visitHasPending([pending]), true);
  assert.equal(visitHasPending([]), false);
  assert.equal(visitHasPending([{ ...pending, moderationStatus: "ACCEPTED" }, pending]), true);
});

test("one status label distinguishes staff decisions from payment state", () => {
  assert.equal(
    visitOrderLabel({ ...pending, moderationStatus: "REJECTED", status: "CANCELED" }),
    "orderRejected",
  );
  assert.equal(
    visitOrderLabel({ ...pending, moderationStatus: "ACCEPTED" }),
    "orderAcceptedUnpaid",
  );
  assert.equal(
    visitOrderLabel({ ...pending, moderationStatus: "ACCEPTED", paid: true }),
    "orderPaid",
  );
  assert.equal(visitOrderLabel({ ...pending, moderationStatus: "NOT_REQUIRED" }), "orderUnpaid");
  assert.equal(
    visitOrderLabel({ ...pending, moderationStatus: "ACCEPTED", status: "CANCELED" }),
    "orderCanceled",
  );
  assert.equal(isPendingGuestOrder({ ...pending, status: "CANCELED" }), false);
});
