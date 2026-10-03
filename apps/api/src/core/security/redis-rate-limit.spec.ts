import assert from "node:assert/strict";
import test from "node:test";

import { HttpException } from "@nestjs/common";

import { InMemoryRateLimitService } from "./rate-limit.service.js";
import { RedisRateLimitService, type RateLimitRedis } from "./redis-rate-limit.service.js";
import { createRateLimitService } from "./security.module.js";

/** Behaves like the INCR + PEXPIRE script against one Redis. */
class FakeRedis implements RateLimitRedis {
  readonly counts = new Map<string, number>();
  readonly windows = new Map<string, number>();
  down = false;

  async eval(_script: string, _keyCount: number, key: string, windowMs: number) {
    if (this.down) throw new Error("Connection is closed.");
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    if (count === 1) this.windows.set(key, windowMs);
    return count;
  }

  async quit() {
    return "OK";
  }
}

const policy = { limit: 2, windowMs: 60_000 };
const KEY = "merchant-login:203.0.113.10:owner@example.com";

async function rejects(action: () => Promise<void>) {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof HttpException);
    assert.equal(error.getStatus(), 429);
    assert.deepEqual((error.getResponse() as { code: string }).code, "RATE_LIMIT_EXCEEDED");
    return true;
  });
}

test("two API instances share one limit through Redis", async () => {
  const redis = new FakeRedis();
  const first = new RedisRateLimitService(redis);
  const second = new RedisRateLimitService(redis);

  await first.consume(KEY, policy);
  await second.consume(KEY, policy);
  await rejects(() => first.consume(KEY, policy));
  await rejects(() => second.consume(KEY, policy));
});

test("the window starts on the first attempt and the key hides the email", async () => {
  const redis = new FakeRedis();
  await new RedisRateLimitService(redis).consume(KEY, policy);

  const [stored] = [...redis.counts.keys()];
  assert.match(stored ?? "", /^rate-limit:[0-9a-f]{64}$/);
  assert.equal(redis.windows.get(stored ?? ""), 60_000);
});

test("when Redis is down the instance still limits on its own", async () => {
  const redis = new FakeRedis();
  redis.down = true;
  const service = new RedisRateLimitService(redis, new InMemoryRateLimitService());

  await service.consume(KEY, policy);
  await service.consume(KEY, policy);
  await rejects(() => service.consume(KEY, policy));
});

test("the store is chosen by RATE_LIMIT_STORE and misconfiguration is refused", () => {
  assert.ok(createRateLimitService({}) instanceof InMemoryRateLimitService);
  assert.ok(
    createRateLimitService({ RATE_LIMIT_STORE: "memory" }) instanceof InMemoryRateLimitService,
  );
  assert.throws(() => createRateLimitService({ RATE_LIMIT_STORE: "redis" }), /needs REDIS_URL/);
  assert.throws(() => createRateLimitService({ RATE_LIMIT_STORE: "file" }), /"memory" or "redis"/);
});
