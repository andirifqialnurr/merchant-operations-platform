import { getPrismaClient } from "@merchant/database";
import type { PlatformRole } from "@merchant/contracts";
import { Injectable } from "@nestjs/common";

export type PlatformUserRecord = {
  displayName: string;
  email: string;
  id: string;
  passwordHash: string;
  role: PlatformRole;
  status: "ACTIVE" | "DISABLED";
};

export type PlatformSessionUserRecord = Omit<PlatformUserRecord, "passwordHash">;

export type PlatformLoginSessionRecord = {
  expiresAt: Date;
  id: string;
  user: PlatformSessionUserRecord;
};

export type CreatePlatformLoginSessionInput = {
  expiresAt: Date;
  ipAddress?: string;
  tokenHash: string;
  userAgent?: string;
  userId: string;
};

export type CreatePlatformUserInput = {
  displayName: string;
  email: string;
  passwordHash: string;
  role: PlatformRole;
};

export interface PlatformAuthRepository {
  createLoginSession(input: CreatePlatformLoginSessionInput): Promise<PlatformLoginSessionRecord>;
  createUser(input: CreatePlatformUserInput): Promise<PlatformUserRecord>;
  findActiveSession(tokenHash: string, now: Date): Promise<PlatformLoginSessionRecord | null>;
  findUserByEmail(email: string): Promise<PlatformUserRecord | null>;
  revokeSession(tokenHash: string, revokedAt: Date): Promise<void>;
}

export const PLATFORM_AUTH_REPOSITORY = Symbol("PLATFORM_AUTH_REPOSITORY");

const platformUserSelect = {
  displayName: true,
  email: true,
  id: true,
  passwordHash: true,
  role: true,
  status: true,
} as const;

@Injectable()
export class PrismaPlatformAuthRepository implements PlatformAuthRepository {
  async findUserByEmail(email: string) {
    return getPrismaClient().platformUser.findUnique({
      select: platformUserSelect,
      where: { email },
    });
  }

  async createUser(input: CreatePlatformUserInput) {
    return getPrismaClient().platformUser.create({ data: input, select: platformUserSelect });
  }

  async createLoginSession(input: CreatePlatformLoginSessionInput) {
    const client = getPrismaClient();
    const [session] = await client.$transaction([
      client.platformLoginSession.create({
        data: {
          expiresAt: input.expiresAt,
          ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
          tokenHash: input.tokenHash,
          ...(input.userAgent ? { userAgent: input.userAgent } : {}),
          userId: input.userId,
        },
        select: {
          expiresAt: true,
          id: true,
          user: {
            select: { displayName: true, email: true, id: true, role: true, status: true },
          },
        },
      }),
      client.platformUser.update({
        data: { lastLoginAt: new Date() },
        select: { id: true },
        where: { id: input.userId },
      }),
    ]);
    return session;
  }

  async findActiveSession(tokenHash: string, now: Date) {
    return getPrismaClient().platformLoginSession.findFirst({
      select: {
        expiresAt: true,
        id: true,
        user: { select: { displayName: true, email: true, id: true, role: true, status: true } },
      },
      where: {
        expiresAt: { gt: now },
        revokedAt: null,
        tokenHash,
        user: { status: "ACTIVE" },
      },
    });
  }

  async revokeSession(tokenHash: string, revokedAt: Date) {
    await getPrismaClient().platformLoginSession.updateMany({
      data: { revokedAt },
      where: { revokedAt: null, tokenHash },
    });
  }
}
