import assert from "node:assert/strict";
import test from "node:test";

import { PLATFORM_PERMISSIONS, type PlatformPermissionKey } from "@merchant/contracts";
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

import { hashPassword } from "../auth/password.js";
import {
  type CreatePlatformLoginSessionInput,
  type CreatePlatformUserInput,
  type PlatformAuthRepository,
  type PlatformLoginSessionRecord,
  type PlatformUserRecord,
} from "./platform-auth.repository.js";
import {
  PLATFORM_ROLE_PERMISSIONS,
  PlatformAuthService,
  readPlatformSessionTtlHours,
} from "./platform-auth.service.js";
import {
  readPlatformSessionToken,
  serializeExpiredPlatformSessionCookie,
  serializePlatformSessionCookie,
} from "./platform-session-cookie.js";
import { PlatformPermissionGuard } from "./platform-permission.guard.js";

const USER_ID = "019f738d-e61f-7d46-92de-17b35f970c01";

class InMemoryPlatformAuthRepository implements PlatformAuthRepository {
  private readonly sessions = new Map<
    string,
    PlatformLoginSessionRecord & { revokedAt: Date | null; tokenHash: string }
  >();

  constructor(private user: PlatformUserRecord | null) {}

  async findUserByEmail(email: string) {
    return this.user?.email === email ? this.user : null;
  }

  async createUser(input: CreatePlatformUserInput) {
    this.user = { ...input, id: USER_ID, status: "ACTIVE" };
    return this.user;
  }

  async createLoginSession(input: CreatePlatformLoginSessionInput) {
    assert.ok(this.user);
    const session = {
      expiresAt: input.expiresAt,
      id: "019f738d-e61f-7d46-92de-17b35f970c02",
      revokedAt: null,
      tokenHash: input.tokenHash,
      user: {
        displayName: this.user.displayName,
        email: this.user.email,
        id: this.user.id,
        role: this.user.role,
        status: this.user.status,
      },
    } satisfies PlatformLoginSessionRecord & { revokedAt: Date | null; tokenHash: string };
    this.sessions.set(input.tokenHash, session);
    return session;
  }

  async findActiveSession(tokenHash: string, now: Date) {
    const session = this.sessions.get(tokenHash);
    return session && !session.revokedAt && session.expiresAt > now ? session : null;
  }

  async revokeSession(tokenHash: string, revokedAt: Date) {
    const session = this.sessions.get(tokenHash);
    if (session) session.revokedAt = revokedAt;
  }
}

test("creates and revokes a platform session with role-derived permissions", async () => {
  const repository = new InMemoryPlatformAuthRepository({
    displayName: "Platform Support",
    email: "support@example.com",
    id: USER_ID,
    passwordHash: await hashPassword("rahasia-kuat"),
    role: "SUPPORT",
    status: "ACTIVE",
  });
  const service = new PlatformAuthService(repository);
  const login = await service.login({ email: "support@example.com", password: "rahasia-kuat" });

  assert.equal(login.session.user.role, "SUPPORT");
  assert.ok(login.session.user.permissionKeys.includes(PLATFORM_PERMISSIONS.tenantRead));
  assert.ok(!login.session.user.permissionKeys.includes(PLATFORM_PERMISSIONS.tenantManage));
  assert.equal((await service.getSession(login.token)).user.id, USER_ID);

  await service.logout(login.token);
  await assert.rejects(() => service.getSession(login.token), UnauthorizedException);
});

test("keeps owner and support permission boundaries explicit", () => {
  assert.deepEqual(
    [...PLATFORM_ROLE_PERMISSIONS.OWNER].sort(),
    [...Object.values(PLATFORM_PERMISSIONS)].sort(),
  );
  assert.ok(!PLATFORM_ROLE_PERMISSIONS.SUPPORT.includes(PLATFORM_PERMISSIONS.subscriptionManage));
  assert.ok(!PLATFORM_ROLE_PERMISSIONS.SUPPORT.includes(PLATFORM_PERMISSIONS.tenantManage));
});

test("uses a distinct strict platform cookie and rejects the merchant cookie", () => {
  const token = "p".repeat(43);
  const cookie = serializePlatformSessionCookie(token, new Date(Date.now() + 60_000), true);

  assert.match(cookie, /platform_session=/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.equal(readPlatformSessionToken(`merchant_session=${token}`), undefined);
  assert.equal(readPlatformSessionToken(`other=value; platform_session=${token}`), token);
  assert.match(serializeExpiredPlatformSessionCookie(true), /Max-Age=0/);
});

test("bounds the shorter platform session lifetime", () => {
  assert.equal(readPlatformSessionTtlHours("6"), 6);
  assert.equal(readPlatformSessionTtlHours("0"), 12);
  assert.equal(readPlatformSessionTtlHours("24"), 12);
});

test("guard denies support mutations and attaches an allowed platform identity", async () => {
  const token = "g".repeat(43);
  const request: {
    headers: Record<string, string>;
    platformUser?: { id: string };
  } = { headers: { cookie: `platform_session=${token}` } };
  const authService = {
    async getSession(receivedToken: string | undefined) {
      assert.equal(receivedToken, token);
      return {
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        user: {
          displayName: "Platform Support",
          email: "support@example.com",
          id: USER_ID,
          permissionKeys: PLATFORM_ROLE_PERMISSIONS.SUPPORT,
          role: "SUPPORT" as const,
        },
      };
    },
  };
  let requiredPermission: PlatformPermissionKey = PLATFORM_PERMISSIONS.tenantManage;
  const reflector = {
    getAllAndOverride() {
      return requiredPermission;
    },
  };
  const context = {
    getClass: () => PlatformPermissionGuard,
    getHandler: () => test,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const guard = new PlatformPermissionGuard(
    authService as PlatformAuthService,
    reflector as unknown as Reflector,
  );

  await assert.rejects(() => guard.canActivate(context), ForbiddenException);
  requiredPermission = PLATFORM_PERMISSIONS.tenantRead;
  assert.equal(await guard.canActivate(context), true);
  assert.equal(request.platformUser?.id, USER_ID);
});
