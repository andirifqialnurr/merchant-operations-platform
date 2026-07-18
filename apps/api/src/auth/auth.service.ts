import { authSessionSchema, type AuthLoginRequest, type AuthSession } from "@merchant/contracts";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";

import {
  AUTH_REPOSITORY,
  type AuthRepository,
  type LoginSessionRecord,
} from "./auth.repository.js";
import { createSessionToken, hashSessionToken, verifyPassword } from "./password.js";

const DEFAULT_SESSION_TTL_HOURS = 24 * 30;
const DUMMY_PASSWORD_HASH =
  "argon2id$v=1$m=65536,t=3,p=1$MkuMgCmr3bxO5jWNrNI84A$0j31PhlaljELAIA0SThm25s-vr6s-j9l2VypOA9Wr6k";

export type LoginMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

function invalidCredentials() {
  return new UnauthorizedException({
    code: "AUTH_INVALID_CREDENTIALS",
    message: "Email atau kata sandi tidak valid.",
  });
}

function invalidSession() {
  return new UnauthorizedException({
    code: "AUTH_SESSION_INVALID",
    message: "Sesi tidak valid atau sudah berakhir.",
  });
}

export function readSessionTtlHours(value = process.env.AUTH_SESSION_TTL_HOURS) {
  if (!value) {
    return DEFAULT_SESSION_TTL_HOURS;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= DEFAULT_SESSION_TTL_HOURS
    ? parsed
    : DEFAULT_SESSION_TTL_HOURS;
}

function toAuthSession(session: LoginSessionRecord): AuthSession {
  return authSessionSchema.parse({
    expiresAt: session.expiresAt.toISOString(),
    user: {
      displayName: session.user.displayName,
      email: session.user.email,
      id: session.user.id,
    },
  });
}

@Injectable()
export class AuthService {
  constructor(@Inject(AUTH_REPOSITORY) private readonly repository: AuthRepository) {}

  async login(input: AuthLoginRequest, metadata: LoginMetadata = {}) {
    const user = await this.repository.findUserByEmail(input.email);
    const passwordMatches = await verifyPassword(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordMatches || user.status !== "ACTIVE") {
      throw invalidCredentials();
    }

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + readSessionTtlHours() * 60 * 60 * 1000);
    const session = await this.repository.createLoginSession({
      expiresAt,
      ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress.slice(0, 45) } : {}),
      tokenHash: hashSessionToken(token),
      ...(metadata.userAgent ? { userAgent: metadata.userAgent.slice(0, 512) } : {}),
      userId: user.id,
    });

    return { session: toAuthSession(session), token };
  }

  async getSession(token: string | undefined) {
    if (!token) {
      throw invalidSession();
    }

    const session = await this.repository.findActiveSession(hashSessionToken(token), new Date());

    if (!session || session.user.status !== "ACTIVE") {
      throw invalidSession();
    }

    return toAuthSession(session);
  }

  async logout(token: string | undefined) {
    if (token) {
      await this.repository.revokeSession(hashSessionToken(token), new Date());
    }

    return { success: true as const };
  }
}
