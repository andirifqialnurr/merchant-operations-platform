import assert from "node:assert/strict";
import test from "node:test";

import { HttpException, HttpStatus } from "@nestjs/common";

import {
  buildLoginRateLimitKey,
  buildPlatformLoginRateLimitKey,
  buildQrSubmitRateLimitKey,
  InMemoryRateLimitService,
  RATE_LIMIT_POLICIES,
} from "./rate-limit.service.js";

test("builds separate normalized login rate limit keys", () => {
  assert.equal(
    buildLoginRateLimitKey({ email: "  Owner@Example.com ", ipAddress: "203.0.113.10" }),
    "merchant-login:203.0.113.10:owner@example.com",
  );
  assert.equal(
    buildPlatformLoginRateLimitKey({ email: "  Owner@Example.com ", ipAddress: "203.0.113.10" }),
    "platform-login:203.0.113.10:owner@example.com",
  );
});

test("hashes QR submit token in the rate limit key", () => {
  const rawToken = "qr-token-from-url-123";
  const key = buildQrSubmitRateLimitKey({ ipAddress: "203.0.113.55", qrToken: rawToken });

  assert.match(key, /^qr-submit:203\.0\.113\.55:[a-f0-9]{64}$/);
  assert.equal(key.includes(rawToken), false);
  assert.ok(RATE_LIMIT_POLICIES.qrSubmit.limit > 0);
  assert.ok(RATE_LIMIT_POLICIES.qrSubmit.windowMs > 0);
});

test("returns the shared 429 error contract when a key exceeds its window", () => {
  const service = new InMemoryRateLimitService(() => 1_000);
  service.consume("merchant-login:203.0.113.10:owner@example.com", { limit: 1, windowMs: 60_000 });

  assert.throws(
    () =>
      service.consume("merchant-login:203.0.113.10:owner@example.com", {
        limit: 1,
        windowMs: 60_000,
      }),
    (error: unknown) => {
      if (!(error instanceof HttpException) || error.getStatus() !== HttpStatus.TOO_MANY_REQUESTS) {
        return false;
      }
      assert.deepEqual(error.getResponse(), {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Terlalu banyak percobaan. Coba lagi nanti.",
      });
      return true;
    },
  );
});
