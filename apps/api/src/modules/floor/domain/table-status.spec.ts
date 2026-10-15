import assert from "node:assert/strict";
import test from "node:test";

import { tableStatus } from "./table-status.js";

const ACTIVE = { status: "ACTIVE" as const };

test("a table follows the session that holds it", () => {
  assert.equal(tableStatus(ACTIVE, null), "AVAILABLE");
  assert.equal(
    tableStatus(ACTIVE, { cleanedAt: null, needsCleaning: false, status: "OPEN" }),
    "OCCUPIED",
  );
  assert.equal(
    tableStatus(ACTIVE, { cleanedAt: null, needsCleaning: false, status: "CLOSING" }),
    "CLOSING",
  );
  assert.equal(
    tableStatus(ACTIVE, { cleanedAt: null, needsCleaning: true, status: "CLOSED" }),
    "CLEANING",
  );
  assert.equal(
    tableStatus(ACTIVE, { cleanedAt: new Date(), needsCleaning: true, status: "CLOSED" }),
    "AVAILABLE",
  );
});

test("a table set aside is inactive unless guests are still at it", () => {
  assert.equal(tableStatus({ status: "INACTIVE" }, null), "INACTIVE");
  // Guests seated before the table was set aside are still served.
  assert.equal(
    tableStatus({ status: "INACTIVE" }, { cleanedAt: null, needsCleaning: false, status: "OPEN" }),
    "OCCUPIED",
  );
});
