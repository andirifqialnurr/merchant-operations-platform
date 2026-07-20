import {
  PLATFORM_PERMISSIONS,
  platformSessionSchema,
  provisionPlatformUserSchema,
  type AuthLoginRequest,
  type PlatformPermissionKey,
  type PlatformRole,
  type PlatformSession,
  type ProvisionPlatformUser,
} from "@merchant/contracts";
import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";

import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from "../auth/password.js";
import {
  PLATFORM_AUTH_REPOSITORY,
  type PlatformAuthRepository,
  type PlatformLoginSessionRecord,
} from "./platform-auth.repository.js";

const DEFAULT_PLATFORM_SESSION_TTL_HOURS = 12;
const DUMMY_PASSWORD_HASH =
  "argon2id$v=1$m=65536,t=3,p=1$MkuMgCmr3bxO5jWNrNI84A$0j31PhlaljELAIA0SThm25s-vr6s-j9l2VypOA9Wr6k";
const ALL_PLATFORM_PERMISSIONS = Object.values(PLATFORM_PERMISSIONS);

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, PlatformPermissionKey[]> = {
  OWNER: [...ALL_PLATFORM_PERMISSIONS],
  ADMIN: [...ALL_PLATFORM_PERMISSIONS],
  SUPPORT: [
    PLATFORM_PERMISSIONS.docsRead,
    PLATFORM_PERMISSIONS.subscriptionRead,
    PLATFORM_PERMISSIONS.supportAccess,
    PLATFORM_PERMISSIONS.tenantRead,
  ],
};

export type PlatformLoginMetadata = { ipAddress?: string; userAgent?: string };

function invalidCredentials() {
  return new UnauthorizedException({
    code: "PLATFORM_AUTH_INVALID_CREDENTIALS",
    message: "Email atau kata sandi platform tidak valid.",
  });
}

function invalidSession() {
  return new UnauthorizedException({
    code: "PLATFORM_AUTH_SESSION_INVALID",
    message: "Sesi platform tidak valid atau sudah berakhir.",
  });
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export function readPlatformSessionTtlHours(value = process.env.PLATFORM_SESSION_TTL_HOURS) {
  if (!value) return DEFAULT_PLATFORM_SESSION_TTL_HOURS;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= DEFAULT_PLATFORM_SESSION_TTL_HOURS
    ? parsed
    : DEFAULT_PLATFORM_SESSION_TTL_HOURS;
}

function toPlatformSession(session: PlatformLoginSessionRecord): PlatformSession {
  return platformSessionSchema.parse({
    expiresAt: session.expiresAt.toISOString(),
    user: {
      displayName: session.user.displayName,
      email: session.user.email,
      id: session.user.id,
      permissionKeys: PLATFORM_ROLE_PERMISSIONS[session.user.role],
      role: session.user.role,
    },
  });
}

@Injectable()
export class PlatformAuthService {
  constructor(
    @Inject(PLATFORM_AUTH_REPOSITORY) private readonly repository: PlatformAuthRepository,
  ) {}

  async provisionUser(input: ProvisionPlatformUser) {
    const parsed = provisionPlatformUserSchema.parse(input);
    const passwordHash = await hashPassword(parsed.password);
    try {
      const user = await this.repository.createUser({ ...parsed, passwordHash });
      return {
        displayName: user.displayName,
        email: user.email,
        id: user.id,
        permissionKeys: PLATFORM_ROLE_PERMISSIONS[user.role],
        role: user.role,
      };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException({
          code: "PLATFORM_USER_EMAIL_CONFLICT",
          message: "Email platform sudah digunakan.",
        });
      }
      throw error;
    }
  }

  async login(input: AuthLoginRequest, metadata: PlatformLoginMetadata = {}) {
    const user = await this.repository.findUserByEmail(input.email);
    const passwordMatches = await verifyPassword(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !passwordMatches || user.status !== "ACTIVE") throw invalidCredentials();

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + readPlatformSessionTtlHours() * 60 * 60 * 1000);
    const session = await this.repository.createLoginSession({
      expiresAt,
      ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress.slice(0, 45) } : {}),
      tokenHash: hashSessionToken(token),
      ...(metadata.userAgent ? { userAgent: metadata.userAgent.slice(0, 512) } : {}),
      userId: user.id,
    });
    return { session: toPlatformSession(session), token };
  }

  async getSession(token: string | undefined) {
    if (!token) throw invalidSession();
    const session = await this.repository.findActiveSession(hashSessionToken(token), new Date());
    if (!session || session.user.status !== "ACTIVE") throw invalidSession();
    return toPlatformSession(session);
  }

  async logout(token: string | undefined) {
    if (token) await this.repository.revokeSession(hashSessionToken(token), new Date());
    return { success: true as const };
  }
}
