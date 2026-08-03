import { createHash } from "node:crypto";

import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

export type RateLimitPolicy = {
  limit: number;
  windowMs: number;
};

export type RateLimitService = {
  consume(key: string, policy: RateLimitPolicy): void;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type LoginRateLimitKeyInput = {
  email: string;
  ipAddress?: string;
};

type QrSubmitRateLimitKeyInput = {
  ipAddress?: string;
  qrToken: string;
};

const UNKNOWN_IP = "unknown";

export const RATE_LIMIT_SERVICE = Symbol("RATE_LIMIT_SERVICE");

export const RATE_LIMIT_POLICIES: Record<
  "merchantLogin" | "platformLogin" | "qrSubmit",
  RateLimitPolicy
> = {
  merchantLogin: { limit: 5, windowMs: 15 * 60 * 1_000 },
  platformLogin: { limit: 5, windowMs: 15 * 60 * 1_000 },
  qrSubmit: { limit: 20, windowMs: 60 * 1_000 },
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeIp(ipAddress: string | undefined) {
  return ipAddress?.trim() || UNKNOWN_IP;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function rateLimitExceeded() {
  return new HttpException(
    {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Terlalu banyak percobaan. Coba lagi nanti.",
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

export function buildLoginRateLimitKey(input: LoginRateLimitKeyInput) {
  return `merchant-login:${normalizeIp(input.ipAddress)}:${normalizeEmail(input.email)}`;
}

export function buildPlatformLoginRateLimitKey(input: LoginRateLimitKeyInput) {
  return `platform-login:${normalizeIp(input.ipAddress)}:${normalizeEmail(input.email)}`;
}

export function buildQrSubmitRateLimitKey(input: QrSubmitRateLimitKeyInput) {
  return `qr-submit:${normalizeIp(input.ipAddress)}:${hashToken(input.qrToken)}`;
}

@Injectable()
export class InMemoryRateLimitService implements RateLimitService {
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(private readonly now: () => number = Date.now) {}

  consume(key: string, policy: RateLimitPolicy) {
    const now = this.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + policy.windowMs });
      return;
    }

    if (bucket.count >= policy.limit) {
      throw rateLimitExceeded();
    }

    bucket.count += 1;
  }
}
