import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_JOB_OPTIONS, queueConnection, RETRY_POLICY, retryDelayMs } from "./queues.js";

test("reads host, port, database, credentials, and TLS from REDIS_URL", () => {
  assert.deepEqual(queueConnection("redis://localhost:6379"), {
    db: 0,
    host: "localhost",
    maxRetriesPerRequest: null,
    port: 6379,
  });
  assert.deepEqual(queueConnection("rediss://worker:p%40ss@cache.internal:6380/2"), {
    db: 2,
    host: "cache.internal",
    maxRetriesPerRequest: null,
    password: "p@ss",
    port: 6380,
    tls: {},
    username: "worker",
  });
});

test("refuses to start without a usable REDIS_URL", () => {
  assert.throws(() => queueConnection(undefined), /REDIS_URL is required/);
  assert.throws(() => queueConnection("http://localhost:6379"), /redis:\/\/ or rediss:\/\//);
  assert.throws(() => queueConnection("redis://localhost:6379/abc"), /invalid database/);
});

test("retries back off exponentially up to the cap, then stop", () => {
  assert.equal(DEFAULT_JOB_OPTIONS.attempts, RETRY_POLICY.maxAttempts);
  assert.deepEqual([1, 2, 3, 4].map(retryDelayMs), [1_000, 2_000, 4_000, 8_000]);
  assert.equal(retryDelayMs(RETRY_POLICY.maxAttempts), 0);
  assert.equal(DEFAULT_JOB_OPTIONS.removeOnFail, false);
});
