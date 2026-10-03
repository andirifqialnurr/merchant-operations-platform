import { createHash } from "node:crypto";

import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Redis } from "ioredis";

import {
  InMemoryRateLimitService,
  rateLimitExceeded,
  type RateLimitPolicy,
  type RateLimitService,
} from "./rate-limit.service.js";

/** The part of a Redis client the limiter needs; lets tests pass a fake. */
export type RateLimitRedis = {
  eval(script: string, keyCount: number, key: string, windowMs: number): Promise<unknown>;
  quit(): Promise<unknown>;
};

// Counts the attempt and starts the window on the first one, atomically.
const COUNT_ATTEMPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return count
`;

const WARNING_INTERVAL_MS = 60_000;

/**
 * Rate limit shared by every API instance (SEC-F3). Same rule as the
 * in-memory limiter: `limit` attempts per window, counted from the first.
 *
 * If Redis cannot be reached the limiter falls back to this process's own
 * memory: logins keep working and each instance still limits on its own.
 */
@Injectable()
export class RedisRateLimitService implements RateLimitService, OnModuleDestroy {
  private readonly logger = new Logger(RedisRateLimitService.name);
  private lastWarningAt = 0;

  constructor(
    private readonly redis: RateLimitRedis,
    private readonly fallback: RateLimitService = new InMemoryRateLimitService(),
    private readonly now: () => number = Date.now,
  ) {}

  async consume(key: string, policy: RateLimitPolicy) {
    let count: number;
    try {
      // Keys carry an email and an IP address, so only their hash is stored.
      const hashed = createHash("sha256").update(key).digest("hex");
      count = Number(
        await this.redis.eval(COUNT_ATTEMPT, 1, `rate-limit:${hashed}`, policy.windowMs),
      );
    } catch (error) {
      this.warn(error);
      await this.fallback.consume(key, policy);
      return;
    }
    if (count > policy.limit) throw rateLimitExceeded();
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }

  private warn(error: unknown) {
    const now = this.now();
    if (now - this.lastWarningAt < WARNING_INTERVAL_MS) return;
    this.lastWarningAt = now;
    const reason = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Redis rate limit unavailable; limiting in this process only. ${reason}`);
  }
}

/**
 * A client that gives up on a command quickly: a login must not wait for
 * Redis to come back. Commands sent while the first connection is still being
 * made are held for that short time rather than refused.
 */
export function createRateLimitRedis(url: string): RateLimitRedis {
  const client = new Redis(url, {
    commandTimeout: 1_000,
    connectTimeout: 2_000,
    maxRetriesPerRequest: 1,
  });
  // Connection errors surface through each command; without a listener
  // ioredis would also print every one of them.
  client.on("error", () => undefined);
  return {
    eval: (script, keyCount, key, windowMs) => client.eval(script, keyCount, key, windowMs),
    // disconnect() also stops reconnecting, so shutdown never waits on a dead Redis.
    quit: async () => client.disconnect(),
  };
}
