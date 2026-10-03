import { Module } from "@nestjs/common";

import {
  InMemoryRateLimitService,
  RATE_LIMIT_SERVICE,
  type RateLimitService,
} from "./rate-limit.service.js";
import { createRateLimitRedis, RedisRateLimitService } from "./redis-rate-limit.service.js";

type RateLimitEnvironment = { RATE_LIMIT_STORE?: string; REDIS_URL?: string };

/**
 * `RATE_LIMIT_STORE=redis` shares the limit between API instances and keeps
 * it across restarts; it needs `REDIS_URL`. The default, `memory`, is enough
 * for one instance and for tests.
 */
export function createRateLimitService(
  environment: RateLimitEnvironment = process.env,
): RateLimitService {
  const store = environment.RATE_LIMIT_STORE ?? "memory";
  if (store === "memory") return new InMemoryRateLimitService();
  if (store !== "redis") {
    throw new Error(`RATE_LIMIT_STORE must be "memory" or "redis", not "${store}".`);
  }
  if (!environment.REDIS_URL) {
    throw new Error("RATE_LIMIT_STORE=redis needs REDIS_URL.");
  }
  return new RedisRateLimitService(createRateLimitRedis(environment.REDIS_URL));
}

/** One limiter for the whole API, so every login path counts against the same store. */
@Module({
  exports: [RATE_LIMIT_SERVICE],
  providers: [{ provide: RATE_LIMIT_SERVICE, useFactory: () => createRateLimitService() }],
})
export class SecurityModule {}
