import assert from "node:assert/strict";
import test from "node:test";

import { HttpException, HttpStatus, UnauthorizedException } from "@nestjs/common";

import {
  type AuthRepository,
  type AuthUserRecord,
  type CreateLoginSessionInput,
  type LoginSessionRecord,
} from "./auth.repository.js";
import { AuthService, readSessionTtlHours } from "./auth.service.js";
import { hashPassword, hashSessionToken, verifyPassword } from "./password.js";
import { InMemoryRateLimitService, RATE_LIMIT_POLICIES } from "../security/rate-limit.service.js";
import {
  readSessionToken,
  serializeExpiredSessionCookie,
  serializeSessionCookie,
} from "./session-cookie.js";

const USER_ID = "019f738d-e61f-7d46-92de-17b35f970b91";

class InMemoryAuthRepository implements AuthRepository {
  findUserByEmailCalls = 0;

  private readonly sessions = new Map<
    string,
    LoginSessionRecord & { revokedAt: Date | null; tokenHash: string }
  >();

  constructor(private readonly user: AuthUserRecord) {}

  async findUserByEmail(email: string) {
    this.findUserByEmailCalls += 1;
    return email === this.user.email ? this.user : null;
  }

  async createLoginSession(input: CreateLoginSessionInput) {
    const session = {
      expiresAt: input.expiresAt,
      id: "019f738d-e61f-7d46-92de-17b35f970b92",
      revokedAt: null,
      tokenHash: input.tokenHash,
      user: {
        displayName: this.user.displayName,
        email: this.user.email,
        id: this.user.id,
        status: this.user.status,
      },
    } satisfies LoginSessionRecord & { revokedAt: Date | null; tokenHash: string };

    this.sessions.set(input.tokenHash, session);
    return session;
  }

  async findActiveSession(tokenHash: string, now: Date) {
    const session = this.sessions.get(tokenHash);
    return session && !session.revokedAt && session.expiresAt > now ? session : null;
  }

  async revokeSession(tokenHash: string, revokedAt: Date) {
    const session = this.sessions.get(tokenHash);

    if (session) {
      session.revokedAt = revokedAt;
    }
  }
}

test("hashes passwords with Argon2id and rejects the wrong password", async () => {
  const encodedHash = await hashPassword("rahasia-kuat");

  assert.match(encodedHash, /^argon2id\$v=1\$m=65536,t=3,p=1\$/);
  assert.equal(await verifyPassword("rahasia-kuat", encodedHash), true);
  assert.equal(await verifyPassword("password-salah", encodedHash), false);
});

test("creates, resolves, and revokes an opaque login session", async () => {
  const passwordHash = await hashPassword("rahasia-kuat");
  const repository = new InMemoryAuthRepository({
    displayName: "Pemilik Merchant",
    email: "owner@example.com",
    id: USER_ID,
    passwordHash,
    status: "ACTIVE",
  });
  const service = new AuthService(repository);
  const login = await service.login({ email: "owner@example.com", password: "rahasia-kuat" });

  assert.equal(login.token.length, 43);
  assert.equal(login.session.user.id, USER_ID);
  assert.equal(hashSessionToken(login.token).length, 64);
  assert.equal((await service.getSession(login.token)).user.email, "owner@example.com");

  await service.logout(login.token);
  await assert.rejects(() => service.getSession(login.token), UnauthorizedException);
});

test("returns one generic error for invalid credentials", async () => {
  const repository = new InMemoryAuthRepository({
    displayName: "Pemilik Merchant",
    email: "owner@example.com",
    id: USER_ID,
    passwordHash: await hashPassword("rahasia-kuat"),
    status: "ACTIVE",
  });
  const service = new AuthService(repository);

  await assert.rejects(
    () => service.login({ email: "owner@example.com", password: "password-salah" }),
    (error: unknown) => {
      if (!(error instanceof UnauthorizedException)) {
        return false;
      }

      const response = error.getResponse();
      return (
        typeof response === "object" &&
        response !== null &&
        "code" in response &&
        response.code === "AUTH_INVALID_CREDENTIALS"
      );
    },
  );
});

test("rate limits repeated merchant login attempts before credential lookup", async () => {
  const originalPolicy = RATE_LIMIT_POLICIES.merchantLogin;
  const repository = new InMemoryAuthRepository({
    displayName: "Pemilik Merchant",
    email: "owner@example.com",
    id: USER_ID,
    passwordHash: await hashPassword("rahasia-kuat"),
    status: "ACTIVE",
  });
  const rateLimit = new InMemoryRateLimitService(() => 1_000);
  const service = new AuthService(repository, rateLimit);

  RATE_LIMIT_POLICIES.merchantLogin = { limit: 1, windowMs: 60_000 };
  try {
    await service.login(
      { email: "owner@example.com", password: "rahasia-kuat" },
      { ipAddress: "203.0.113.10" },
    );

    await assert.rejects(
      () =>
        service.login(
          { email: " OWNER@example.com ", password: "rahasia-kuat" },
          { ipAddress: "203.0.113.10" },
        ),
      (error: unknown) => {
        if (
          !(error instanceof HttpException) ||
          error.getStatus() !== HttpStatus.TOO_MANY_REQUESTS
        ) {
          return false;
        }
        const response = error.getResponse();
        return (
          typeof response === "object" &&
          response !== null &&
          "code" in response &&
          response.code === "RATE_LIMIT_EXCEEDED"
        );
      },
    );
    assert.equal(repository.findUserByEmailCalls, 1);
  } finally {
    RATE_LIMIT_POLICIES.merchantLogin = originalPolicy;
  }
});

test("serializes secure session cookies and ignores malformed tokens", () => {
  const token = "a".repeat(43);
  const cookie = serializeSessionCookie(token, new Date(Date.now() + 60_000), true);

  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Secure/);
  assert.equal(readSessionToken(`other=value; merchant_session=${token}`), token);
  assert.equal(readSessionToken("merchant_session=invalid"), undefined);
  assert.match(serializeExpiredSessionCookie(true), /Max-Age=0/);
});

test("bounds session lifetime configuration", () => {
  assert.equal(readSessionTtlHours("24"), 24);
  assert.equal(readSessionTtlHours("0"), 720);
  assert.equal(readSessionTtlHours("9999"), 720);
});
