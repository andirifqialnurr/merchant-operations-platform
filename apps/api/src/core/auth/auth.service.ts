import {
  authSessionSchema,
  type AuthLoginRequest,
  type AuthSession,
  type UpdateUserPreferences,
} from "@merchant/contracts";
import { Inject, Injectable, Optional, UnauthorizedException } from "@nestjs/common";

import {
  buildLoginRateLimitKey,
  InMemoryRateLimitService,
  RATE_LIMIT_POLICIES,
  RATE_LIMIT_SERVICE,
  type RateLimitService,
} from "../security/public.js";
import {
  AUTH_REPOSITORY,
  type AuthRepository,
  type LoginSessionRecord,
} from "./auth.repository.js";
import { createSessionToken, hashSessionToken, verifyPassword } from "./password.js";
import {
  DEVICE_AUTHENTICATOR,
  type DeviceAuthenticator,
} from "../../shared/devices/device-identity.js";

/** A session never lasts longer than this, whatever the configuration says. */
const MAX_SESSION_TTL_HOURS = 24 * 30;
/** Backoffice: a person on any browser signs in again each working day. */
const DEFAULT_SESSION_TTL_HOURS = 12;
/** POS and KDS: long enough for a shift; useless without the device it was opened on. */
const DEFAULT_DEVICE_SESSION_TTL_HOURS = 16;
const DUMMY_PASSWORD_HASH =
  "argon2id$v=1$m=65536,t=3,p=1$MkuMgCmr3bxO5jWNrNI84A$0j31PhlaljELAIA0SThm25s-vr6s-j9l2VypOA9Wr6k";

export type LoginMetadata = {
  /** The credential of the device the person signs in on, if it sent one. */
  deviceCredential?: string;
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

function readTtlHours(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_SESSION_TTL_HOURS
    ? parsed
    : fallback;
}

/** Lifetime of a backoffice session. */
export function readSessionTtlHours(value = process.env.AUTH_SESSION_TTL_HOURS) {
  return readTtlHours(value, DEFAULT_SESSION_TTL_HOURS);
}

/** Lifetime of a session bound to a POS or KDS device. */
export function readDeviceSessionTtlHours(value = process.env.AUTH_DEVICE_SESSION_TTL_HOURS) {
  return readTtlHours(value, DEFAULT_DEVICE_SESSION_TTL_HOURS);
}

function toAuthSession(session: LoginSessionRecord): AuthSession {
  return authSessionSchema.parse({
    expiresAt: session.expiresAt.toISOString(),
    surface: session.surface,
    user: {
      displayName: session.user.displayName,
      email: session.user.email,
      id: session.user.id,
      locale: session.user.locale,
      theme: session.user.theme,
    },
  });
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repository: AuthRepository,
    @Optional()
    @Inject(RATE_LIMIT_SERVICE)
    private readonly rateLimit: RateLimitService = new InMemoryRateLimitService(),
    @Optional() @Inject(DEVICE_AUTHENTICATOR) private readonly devices?: DeviceAuthenticator,
  ) {}

  async login(input: AuthLoginRequest, metadata: LoginMetadata = {}) {
    await this.rateLimit.consume(
      buildLoginRateLimitKey({
        email: input.email,
        ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
      }),
      RATE_LIMIT_POLICIES.merchantLogin,
    );

    const user = await this.repository.findUserByEmail(input.email);
    const passwordMatches = await verifyPassword(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordMatches || user.status !== "ACTIVE") {
      throw invalidCredentials();
    }

    // Signing in on a registered device opens a session for that device only.
    const device = await this.devices?.authenticate(metadata.deviceCredential);
    const ttlHours = device ? readDeviceSessionTtlHours() : readSessionTtlHours();
    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    const session = await this.repository.createLoginSession({
      ...(device ? { deviceId: device.id } : {}),
      expiresAt,
      surface: device ? device.mode : "BACKOFFICE",
      ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress.slice(0, 45) } : {}),
      tokenHash: hashSessionToken(token),
      ...(metadata.userAgent ? { userAgent: metadata.userAgent.slice(0, 512) } : {}),
      userId: user.id,
    });

    return { session: toAuthSession(session), token };
  }

  /**
   * The session behind a token. A session bound to a device also needs that
   * device's credential, still active: copied to another browser, or after
   * the device is revoked, it is worth nothing.
   */
  async getSession(token: string | undefined, deviceCredential?: string) {
    if (!token) {
      throw invalidSession();
    }

    const session = await this.repository.findActiveSession(hashSessionToken(token), new Date());

    if (!session || session.user.status !== "ACTIVE") {
      throw invalidSession();
    }
    if (session.deviceId) {
      const device = await this.devices?.authenticate(deviceCredential);
      if (device?.id !== session.deviceId) throw invalidSession();
    }

    return toAuthSession(session);
  }

  /** Saves the signed-in user's language or theme and returns the updated session. */
  async updatePreferences(
    token: string | undefined,
    input: UpdateUserPreferences,
    deviceCredential?: string,
  ) {
    const session = await this.getSession(token, deviceCredential);
    await this.repository.updatePreferences(session.user.id, {
      ...(input.locale ? { locale: input.locale } : {}),
      ...(input.theme ? { theme: input.theme } : {}),
    });
    return this.getSession(token, deviceCredential);
  }

  async logout(token: string | undefined) {
    if (token) {
      await this.repository.revokeSession(hashSessionToken(token), new Date());
    }

    return { success: true as const };
  }
}
