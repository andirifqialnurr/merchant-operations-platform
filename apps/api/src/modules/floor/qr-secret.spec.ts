import assert from "node:assert/strict";
import test from "node:test";

import { tableQrSecret } from "./floor.module.js";

test("production refuses to start without a real QR secret", () => {
  assert.throws(() => tableQrSecret({ NODE_ENV: "production" }), /TABLE_QR_SECRET/);
  assert.throws(
    () => tableQrSecret({ NODE_ENV: "production", TABLE_QR_SECRET: "too-short" }),
    /TABLE_QR_SECRET/,
  );
  const secret = "a".repeat(32);
  assert.equal(tableQrSecret({ NODE_ENV: "production", TABLE_QR_SECRET: secret }), secret);
  // Development works without one.
  assert.ok(tableQrSecret({ NODE_ENV: "development" }).length >= 32);
});
