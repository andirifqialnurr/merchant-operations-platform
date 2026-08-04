import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDeadLetterEvent,
  nextRetryDecision,
  sanitizeDeadLetterContext,
} from "./queue-retry.js";

test("schedules failed jobs with bounded exponential retry delays", () => {
  assert.deepEqual(
    nextRetryDecision({ attempt: 1, maxAttempts: 4, baseDelayMs: 1_000, maxDelayMs: 30_000 }),
    { action: "retry", nextAttempt: 2, delayMs: 1_000 },
  );
  assert.deepEqual(
    nextRetryDecision({ attempt: 3, maxAttempts: 4, baseDelayMs: 1_000, maxDelayMs: 30_000 }),
    { action: "retry", nextAttempt: 4, delayMs: 4_000 },
  );
  assert.deepEqual(
    nextRetryDecision({ attempt: 5, maxAttempts: 8, baseDelayMs: 10_000, maxDelayMs: 30_000 }),
    { action: "retry", nextAttempt: 6, delayMs: 30_000 },
  );
});

test("moves exhausted jobs to dead letter without scheduling another retry", () => {
  assert.deepEqual(
    nextRetryDecision({ attempt: 4, maxAttempts: 4, baseDelayMs: 1_000, maxDelayMs: 30_000 }),
    { action: "dead-letter", finalAttempt: 4 },
  );
});

test("builds a dead letter event with safe context and a stable error summary", () => {
  const event = buildDeadLetterEvent({
    jobName: "catalog.outlet.sync",
    attempt: 4,
    maxAttempts: 4,
    failedAt: new Date("2026-08-04T13:00:00.000Z"),
    error: new Error("connection refused"),
    context: {
      tenantSlug: "kopi-senja",
      outletCode: "KDS-01",
      token: "secret",
      rawPayload: { shouldNotPersist: true },
    },
  });

  assert.deepEqual(event, {
    jobName: "catalog.outlet.sync",
    attempt: 4,
    maxAttempts: 4,
    failedAt: "2026-08-04T13:00:00.000Z",
    errorName: "Error",
    errorMessage: "connection refused",
    context: {
      tenantSlug: "kopi-senja",
      outletCode: "KDS-01",
    },
  });
});

test("rejects nested sensitive dead letter context before persistence", () => {
  assert.throws(
    () => sanitizeDeadLetterContext({ safe: "value", nested: { sessionToken: "secret" } }),
    /sensitive dead letter context key/i,
  );
});
