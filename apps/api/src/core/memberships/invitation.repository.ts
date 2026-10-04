import type { InvitationStatus } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import type { ActorCommandOrigin, CommandOrigin } from "../../shared/command/command-origin.js";
import { buildAuditMetadata, buildAuditPayload } from "../audit/public.js";
import { insertMembership, type MembershipRecord } from "./access.repository.js";

/** An invitation as the application sees it. The hash of its secret never leaves the repository. */
export type InvitationRecord = {
  acceptedAt: Date | null;
  allOutlets: boolean;
  createdAt: Date;
  email: string;
  expiresAt: Date;
  id: string;
  outletIds: string[];
  revokedAt: Date | null;
  roleIds: string[];
  status: InvitationStatus;
  tenantId: string;
};

export type NewInvitation = {
  allOutlets: boolean;
  email: string;
  expiresAt: Date;
  outletIds: string[];
  roleIds: string[];
  tokenHash: string;
};

export type InvitedAccount = { displayName: string; passwordHash: string };

export interface InvitationRepository {
  /**
   * Turns the pending invitation that holds this unexpired secret into a
   * membership, creating the account first when `account` is given. Null when
   * the invitation can no longer be used, so a link works exactly once.
   */
  accept(
    tokenHash: string,
    account: InvitedAccount | undefined,
    now: Date,
    context?: CommandOrigin,
  ): Promise<MembershipRecord | null>;
  create(
    tenantId: string,
    invitation: NewInvitation,
    context: ActorCommandOrigin,
  ): Promise<InvitationRecord>;
  /** Marks pending invitations of this email that ran out, so a new one can be sent. */
  expireStale(tenantId: string, email: string, now: Date): Promise<void>;
  findById(tenantId: string, id: string): Promise<InvitationRecord | null>;
  /** The pending, unexpired invitation behind a secret, with its workspace. */
  findByToken(
    tokenHash: string,
    now: Date,
  ): Promise<(InvitationRecord & { tenant: { name: string; status: string } }) | null>;
  findPending(tenantId: string, email: string): Promise<InvitationRecord | null>;
  findTenantName(tenantId: string): Promise<string>;
  findUserByEmail(email: string): Promise<{ id: string; status: string } | null>;
  list(tenantId: string): Promise<InvitationRecord[]>;
  /** A new secret and a new deadline for a pending invitation; null when it is not pending. */
  reissue(
    tenantId: string,
    id: string,
    tokenHash: string,
    expiresAt: Date,
    context: ActorCommandOrigin,
  ): Promise<InvitationRecord | null>;
  /** Null when the invitation is not pending. */
  revoke(
    tenantId: string,
    id: string,
    now: Date,
    context: ActorCommandOrigin,
  ): Promise<InvitationRecord | null>;
}

export const INVITATION_REPOSITORY = Symbol("INVITATION_REPOSITORY");

const select = {
  acceptedAt: true,
  allOutlets: true,
  createdAt: true,
  email: true,
  expiresAt: true,
  id: true,
  outletIds: true,
  revokedAt: true,
  roleIds: true,
  status: true,
  tenantId: true,
} as const;

type Transaction = Parameters<Parameters<ReturnType<typeof getPrismaClient>["$transaction"]>[0]>[0];

async function audit(
  transaction: Transaction,
  action: string,
  invitation: InvitationRecord,
  context: CommandOrigin | undefined,
) {
  // The email is personal data: the audit entry names the invitation, not the address.
  const payload = buildAuditPayload({
    allOutlets: invitation.allOutlets,
    outletIds: invitation.outletIds,
    roleIds: invitation.roleIds,
    status: invitation.status,
  });
  await transaction.auditLog.create({
    data: {
      action,
      ...(context?.actorId ? { actorId: context.actorId } : {}),
      entityId: invitation.id,
      entityType: "invitation",
      metadata: buildAuditMetadata(action, payload),
      ...(context?.requestId ? { requestId: context.requestId } : {}),
      tenantId: invitation.tenantId,
    },
  });
}

@Injectable()
export class PrismaInvitationRepository implements InvitationRepository {
  async list(tenantId: string) {
    return getPrismaClient().coreInvitation.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select,
      where: { tenantId },
    });
  }

  async findById(tenantId: string, id: string) {
    return getPrismaClient().coreInvitation.findFirst({ select, where: { id, tenantId } });
  }

  async findPending(tenantId: string, email: string) {
    return getPrismaClient().coreInvitation.findFirst({
      select,
      where: { email, status: "PENDING", tenantId },
    });
  }

  async findByToken(tokenHash: string, now: Date) {
    return getPrismaClient().coreInvitation.findFirst({
      select: { ...select, tenant: { select: { name: true, status: true } } },
      where: { expiresAt: { gt: now }, status: "PENDING", tokenHash },
    });
  }

  async findTenantName(tenantId: string) {
    const tenant = await getPrismaClient().tenant.findUnique({
      select: { name: true },
      where: { id: tenantId },
    });
    return tenant?.name ?? "";
  }

  async findUserByEmail(email: string) {
    return getPrismaClient().user.findUnique({
      select: { id: true, status: true },
      where: { email },
    });
  }

  async expireStale(tenantId: string, email: string, now: Date) {
    await getPrismaClient().coreInvitation.updateMany({
      data: { status: "EXPIRED", tokenHash: null, updatedAt: now },
      where: { email, expiresAt: { lte: now }, status: "PENDING", tenantId },
    });
  }

  async create(tenantId: string, invitation: NewInvitation, context: ActorCommandOrigin) {
    return getPrismaClient().$transaction(async (transaction) => {
      const created = await transaction.coreInvitation.create({
        data: { ...invitation, invitedBy: context.actorId, tenantId },
        select,
      });
      await audit(transaction, "invitation.create", created, context);
      return created;
    });
  }

  async reissue(
    tenantId: string,
    id: string,
    tokenHash: string,
    expiresAt: Date,
    context: ActorCommandOrigin,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      const updated = await transaction.coreInvitation.updateMany({
        data: { expiresAt, tokenHash, updatedAt: new Date() },
        where: { id, status: "PENDING", tenantId },
      });
      if (updated.count === 0) return null;
      const invitation = await transaction.coreInvitation.findUniqueOrThrow({
        select,
        where: { id },
      });
      await audit(transaction, "invitation.resend", invitation, context);
      return invitation;
    });
  }

  async revoke(tenantId: string, id: string, now: Date, context: ActorCommandOrigin) {
    return getPrismaClient().$transaction(async (transaction) => {
      const updated = await transaction.coreInvitation.updateMany({
        data: {
          revokedAt: now,
          revokedBy: context.actorId,
          status: "REVOKED",
          tokenHash: null,
          updatedAt: now,
        },
        where: { id, status: "PENDING", tenantId },
      });
      if (updated.count === 0) return null;
      const invitation = await transaction.coreInvitation.findUniqueOrThrow({
        select,
        where: { id },
      });
      await audit(transaction, "invitation.revoke", invitation, context);
      return invitation;
    });
  }

  async accept(
    tokenHash: string,
    account: InvitedAccount | undefined,
    now: Date,
    context?: CommandOrigin,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      const pending = await transaction.coreInvitation.findFirst({
        select,
        where: { expiresAt: { gt: now }, status: "PENDING", tokenHash },
      });
      if (!pending) return null;
      // The status in the condition makes two people opening the same link race for one row.
      const claimed = await transaction.coreInvitation.updateMany({
        data: { acceptedAt: now, status: "ACCEPTED", tokenHash: null, updatedAt: now },
        where: { id: pending.id, status: "PENDING", tokenHash },
      });
      if (claimed.count === 0) return null;

      const existing = await transaction.user.findUnique({
        select: { id: true },
        where: { email: pending.email },
      });
      // Without an account and without the details for one, nothing can be created.
      if (!existing && !account) throw new Error("An account is needed to accept this invitation.");
      const user =
        existing ??
        (await transaction.user.create({
          data: {
            displayName: account?.displayName ?? pending.email,
            email: pending.email,
            passwordHash: account?.passwordHash ?? "",
          },
          select: { id: true },
        }));

      // The person who accepts is the actor of their own joining.
      const origin: CommandOrigin = { ...context, actorId: user.id };
      const membership = await insertMembership(
        transaction,
        pending.tenantId,
        {
          allOutlets: pending.allOutlets,
          outletIds: pending.outletIds,
          roleIds: pending.roleIds,
          userId: user.id,
        },
        origin,
      );
      await transaction.coreInvitation.update({
        data: { acceptedUserId: user.id },
        where: { id: pending.id },
      });
      await audit(
        transaction,
        "invitation.accept",
        { ...pending, acceptedAt: now, status: "ACCEPTED" },
        origin,
      );
      return membership;
    });
  }
}
