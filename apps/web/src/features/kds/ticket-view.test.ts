import assert from "node:assert/strict";
import test from "node:test";

import type { KitchenTicket } from "@merchant/contracts";

import {
  componentStatus,
  formatElapsed,
  groupByStatus,
  isBoardStatus,
  timerTone,
  WAIT_LATE_MINUTES,
  WAIT_WARNING_MINUTES,
  waitedMilliseconds,
} from "./ticket-view";

const ticket = (overrides: Partial<KitchenTicket>): KitchenTicket => ({
  acceptedAt: null,
  canceledAt: null,
  id: "019f738d-e61f-7d46-92de-17b35f975100",
  items: [{ allergyNote: null, modifiers: [], name: "Latte", note: null, quantity: 1 }],
  orderLabel: "A-1",
  readyAt: null,
  receivedAt: "2026-10-12T03:00:00.000Z",
  servedAt: null,
  source: "POS",
  startedAt: null,
  status: "NEW",
  tableLabel: null,
  ...overrides,
});

test("waiting time reads as minutes and seconds, with hours only when needed", () => {
  assert.equal(formatElapsed(0), "00:00");
  assert.equal(formatElapsed(59_999), "00:59");
  assert.equal(formatElapsed(492_000), "08:12");
  assert.equal(formatElapsed(3_849_000), "1:04:09");
  // A device clock slightly behind the server never shows a negative time.
  assert.equal(formatElapsed(-5000), "00:00");
});

test("an open ticket waits until now; a finished one stopped when it was finished", () => {
  const now = Date.parse("2026-10-12T03:08:12.000Z");
  assert.equal(waitedMilliseconds(ticket({}), now), 492_000);
  assert.equal(
    waitedMilliseconds(ticket({ servedAt: "2026-10-12T03:05:00.000Z", status: "SERVED" }), now),
    300_000,
  );
  assert.equal(
    waitedMilliseconds(ticket({ canceledAt: "2026-10-12T03:01:00.000Z", status: "CANCELED" }), now),
    60_000,
  );
});

test("the board has a column per open status and keeps the order it was given", () => {
  const groups = groupByStatus([
    ticket({ orderLabel: "lama", status: "PREPARING" }),
    ticket({ orderLabel: "baru-1" }),
    ticket({ orderLabel: "baru-2" }),
    ticket({ orderLabel: "disajikan", status: "SERVED" }),
  ]);
  assert.deepEqual([...groups.keys()], ["NEW", "ACCEPTED", "PREPARING", "READY"]);
  assert.deepEqual(
    groups.get("NEW")?.map((item) => item.orderLabel),
    ["baru-1", "baru-2"],
  );
  assert.deepEqual(groups.get("ACCEPTED"), []);
  assert.equal(groups.get("PREPARING")?.length, 1);
  assert.equal(isBoardStatus("SERVED"), false);
  assert.equal(componentStatus("CANCELED"), "canceled");
});

test("the waiting time turns yellow at the warning minute and red at the late one", () => {
  const minutes = (value: number) => value * 60_000;
  assert.equal(timerTone(0), "normal");
  assert.equal(timerTone(minutes(WAIT_WARNING_MINUTES) - 1), "normal");
  assert.equal(timerTone(minutes(WAIT_WARNING_MINUTES)), "warning");
  assert.equal(timerTone(minutes(WAIT_LATE_MINUTES) - 1), "warning");
  assert.equal(timerTone(minutes(WAIT_LATE_MINUTES)), "late");
  assert.equal(timerTone(minutes(240)), "late");
  assert.ok(WAIT_WARNING_MINUTES < WAIT_LATE_MINUTES);
});
