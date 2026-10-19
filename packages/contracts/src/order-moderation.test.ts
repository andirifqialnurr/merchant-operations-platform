import assert from "node:assert/strict";
import test from "node:test";

import {
  acceptGuestOrderSchema,
  isOrderApproved,
  orderModerationStatusSchema,
  rejectGuestOrderSchema,
} from "./orders.ts";
import { guestOrderStatusSchema } from "./self-order.ts";

test("moderation commands accept no client-owned actor, amounts or decision metadata", () => {
  assert.deepEqual(acceptGuestOrderSchema.parse({}), {});
  assert.equal(acceptGuestOrderSchema.safeParse({ actorId: "someone" }).success, false);
  assert.equal(rejectGuestOrderSchema.safeParse({ reason: " " }).success, false);
  assert.equal(
    rejectGuestOrderSchema.safeParse({ reason: "Not available", totalMinor: "0" }).success,
    false,
  );
  assert.equal(
    rejectGuestOrderSchema.parse({ reason: "  Not available  " }).reason,
    "Not available",
  );
});

test("moderation is distinct from kitchen progress and only approved orders are billable", () => {
  for (const status of orderModerationStatusSchema.options) {
    assert.equal(
      isOrderApproved({ moderationStatus: status }),
      status === "NOT_REQUIRED" || status === "ACCEPTED",
    );
  }
  assert.equal(guestOrderStatusSchema.parse("PENDING"), "PENDING");
});
