import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

export type AuthUserRecord = {
  displayName: string;
  email: string;
  id: string;
  passwordHash: string;
  status: "ACTIVE" | "DISABLED";
};

export type SessionUserRecord = Omit<AuthUserRecord, "passwordHash">;

export type LoginSessionRecord = {
  expiresAt: Date;
  id: string;
  user: SessionUserRecord;
};

export type CreateLoginSessionInput = {
  expiresAt: Date;
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
}

export const AUTH_REPOSITORY = Symbol("AUTH_REPOSITORY");

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  async findUserByEmail(email: string) {
    return getPrismaClient().user.findUnique({
      select: {
        displayName: true,
        email: true,
        id: true,
        passwordHash: true,
        status: true,
      },
      where: { email },
    });
  }

  async createLoginSession(input: CreateLoginSessionInput) {
    const client = getPrismaClient();
    const [session] = await client.$transaction([
      client.loginSession.create({
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
            select: { displayName: true, email: true, id: true, status: true },
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
        expiresAt: true,
        id: true,
        user: {
          select: { displayName: true, email: true, id: true, status: true },
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

  async revokeSession(tokenHash: string, revokedAt: Date) {
    await getPrismaClient().loginSession.updateMany({
      data: { revokedAt },
      where: { revokedAt: null, tokenHash },
    });
  }
}
