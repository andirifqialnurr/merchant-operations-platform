import type { ConnectionOptions, JobsOptions } from "bullmq";

import { nextRetryDecision } from "./queue-retry.js";

/** Every queue the worker serves. Module queues are added as their handlers land. */
export const QUEUES = {
  /** Housekeeping jobs of the worker itself; also what the smoke check uses. */
  system: "system",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const RETRY_POLICY = {
  baseDelayMs: 1_000,
  maxAttempts: 5,
  maxDelayMs: 60_000,
} as const;

/** Defaults for every job: bounded retries, and failed jobs are kept for inspection. */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: RETRY_POLICY.maxAttempts,
  backoff: { type: "custom" },
  removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
  removeOnFail: false,
};

/** Delay before the next attempt; the same rule the dead-letter decision uses. */
export function retryDelayMs(attemptsMade: number) {
  const decision = nextRetryDecision({ ...RETRY_POLICY, attempt: attemptsMade });
  return decision.action === "retry" ? decision.delayMs : 0;
}

/**
 * Connection settings for BullMQ. Workers block on Redis, so commands must
 * wait for a reconnect instead of failing after a few retries.
 */
export function queueConnection(redisUrl: string | undefined): ConnectionOptions {
  if (!redisUrl) throw new Error("REDIS_URL is required to run the worker.");
  const url = new URL(redisUrl);
  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new Error("REDIS_URL must start with redis:// or rediss://.");
  }
  const database = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0;
  if (!Number.isInteger(database) || database < 0) {
    throw new Error("REDIS_URL has an invalid database number.");
  }
  return {
    db: database,
    host: url.hostname,
    maxRetriesPerRequest: null,
    port: url.port ? Number(url.port) : 6379,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
}
