import type { SessionSurface } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

export type AuthUserRecord = {
  displayName: string;
  email: string;
  id: string;
  locale: string | null;
  passwordHash: string;
  status: "ACTIVE" | "DISABLED";
  theme: string | null;
};

export type SessionUserRecord = Omit<AuthUserRecord, "passwordHash">;

export type LoginSessionRecord = {
  /** Set for a session bound to a device. */
  deviceId: string | null;
  expiresAt: Date;
  id: string;
  surface: string;
  user: SessionUserRecord;
};

export type CreateLoginSessionInput = {
  deviceId?: string;
  expiresAt: Date;
  surface: SessionSurface;
  ipAddress?: string;
  tokenHash: string;
  userAgent?: string;
  userId: string;
};

export interface AuthRepository {
  createLoginSession(input: CreateLoginSessionInput): Promise<LoginSessionRecord>;
  findActiveSession(tokenHash: string, now: Date): Promise<LoginSessionRecord | null>;
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  revokeSession(tokenHash: string, revokedAt: Date): Promise<void>;
  /** Ends every sign-in of the person, on every surface. Returns how many were ended. */
  revokeUserSessions(userId: string, revokedAt: Date): Promise<number>;
  updatePreferences(
    userId: string,
    preferences: { locale?: string; theme?: string },
  ): Promise<void>;
}

export const AUTH_REPOSITORY = Symbol("AUTH_REPOSITORY");

const sessionUserSelect = {
  displayName: true,
  email: true,
  id: true,
  locale: true,
  status: true,
  theme: true,
} as const;

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  async findUserByEmail(email: string) {
    return getPrismaClient().user.findUnique({
      select: {
        displayName: true,
        email: true,
        id: true,
        locale: true,
        passwordHash: true,
        status: true,
        theme: true,
      },
      where: { email },
    });
  }

  async createLoginSession(input: CreateLoginSessionInput) {
    const client = getPrismaClient();
    const [session] = await client.$transaction([
      client.loginSession.create({
        data: {
          ...(input.deviceId ? { deviceId: input.deviceId } : {}),
          expiresAt: input.expiresAt,
          ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
          surface: input.surface,
          tokenHash: input.tokenHash,
          ...(input.userAgent ? { userAgent: input.userAgent } : {}),
          userId: input.userId,
        },
        select: {
          deviceId: true,
          expiresAt: true,
          id: true,
          surface: true,
          user: {
            select: sessionUserSelect,
          },
        },
      }),
      client.user.update({
        data: { lastLoginAt: new Date() },
        select: { id: true },
        where: { id: input.userId },
      }),
    ]);

    return session;
  }

  async findActiveSession(tokenHash: string, now: Date) {
    return getPrismaClient().loginSession.findFirst({
      select: {
        deviceId: true,
        expiresAt: true,
        id: true,
        surface: true,
        user: {
          select: sessionUserSelect,
        },
      },
      where: {
        expiresAt: { gt: now },
        revokedAt: null,
        tokenHash,
        user: { status: "ACTIVE" },
      },
    });
  }

  async updatePreferences(userId: string, preferences: { locale?: string; theme?: string }) {
    await getPrismaClient().user.update({
      data: preferences,
      select: { id: true },
      where: { id: userId },
    });
  }

  async revokeSession(tokenHash: string, revokedAt: Date) {
    await getPrismaClient().loginSession.updateMany({
      data: { revokedAt },
      where: { revokedAt: null, tokenHash },
    });
  }

  async revokeUserSessions(userId: string, revokedAt: Date) {
    const revoked = await getPrismaClient().loginSession.updateMany({
      data: { revokedAt },
      where: { expiresAt: { gt: revokedAt }, revokedAt: null, userId },
    });
    return revoked.count;
  }
}
