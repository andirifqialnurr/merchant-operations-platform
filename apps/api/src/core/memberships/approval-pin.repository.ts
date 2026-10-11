import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { buildAuditMetadata } from "../audit/public.js";
import type { CommandOrigin } from "../../shared/command/command-origin.js";

export type ApprovalPinRecord = {
  displayName: string;
  failedAttempts: number;
  lockedUntil: Date | null;
  pinHash: string;
  userId: string;
};

export type ApprovalPinAudit = {
  action: "approval_pin.locked" | "approval_pin.reset" | "approval_pin.set";
  context?: CommandOrigin;
  /** Who the PIN belongs to. */
  userId: string;
};

export interface ApprovalPinRepository {
  /** Removes the PIN; false when there was none. */
  delete(tenantId: string, userId: string, audit: ApprovalPinAudit): Promise<boolean>;
  find(tenantId: string, userId: string): Promise<ApprovalPinRecord | null>;
  /** Everyone in the workspace who has set a PIN. */
  list(tenantId: string): Promise<ApprovalPinRecord[]>;
  /**
   * Counts one wrong try. At `maxAttempts` the PIN is locked until
   * `lockUntil` and the count starts over. Returns the state after the try.
   */
  recordFailure(
    tenantId: string,
    userId: string,
    maxAttempts: number,
    lockUntil: Date,
    audit: Omit<ApprovalPinAudit, "action">,
  ): Promise<{ failedAttempts: number; lockedUntil: Date | null }>;
  recordSuccess(tenantId: string, userId: string): Promise<void>;
  /** Sets or replaces the PIN and clears any lock. */
  save(tenantId: string, userId: string, pinHash: string, audit: ApprovalPinAudit): Promise<void>;
  userIdsWithPin(tenantId: string): Promise<Set<string>>;
}

export const APPROVAL_PIN_REPOSITORY = Symbol("APPROVAL_PIN_REPOSITORY");

const select = {
  failedAttempts: true,
  lockedUntil: true,
  pinHash: true,
  user: { select: { displayName: true } },
  userId: true,
} as const;

function toRecord(row: {
  failedAttempts: number;
  lockedUntil: Date | null;
  pinHash: string;
  user: { displayName: string };
  userId: string;
}): ApprovalPinRecord {
  return {
    displayName: row.user.displayName,
    failedAttempts: row.failedAttempts,
    lockedUntil: row.lockedUntil,
    pinHash: row.pinHash,
    userId: row.userId,
  };
}

/** The audit entry says whose PIN changed and who did it; never anything about the PIN. */
function auditData(tenantId: string, audit: ApprovalPinAudit) {
  return {
    action: audit.action,
    ...(audit.context?.actorId ? { actorId: audit.context.actorId } : {}),
    entityId: audit.userId,
    entityType: "approval_pin",
    metadata: buildAuditMetadata(audit.action, { userId: audit.userId }),
    ...(audit.context?.requestId ? { requestId: audit.context.requestId } : {}),
    tenantId,
  };
}

@Injectable()
export class PrismaApprovalPinRepository implements ApprovalPinRepository {
  async find(tenantId: string, userId: string) {
    const row = await getPrismaClient().coreApprovalPin.findUnique({
      select,
      where: { tenantId_userId: { tenantId, userId } },
    });
    return row ? toRecord(row) : null;
  }

  async list(tenantId: string) {
    const rows = await getPrismaClient().coreApprovalPin.findMany({
      orderBy: { user: { displayName: "asc" } },
      select,
      where: { tenantId },
    });
    return rows.map(toRecord);
  }

  async userIdsWithPin(tenantId: string) {
    const rows = await getPrismaClient().coreApprovalPin.findMany({
      select: { userId: true },
      where: { tenantId },
    });
    return new Set(rows.map((row) => row.userId));
  }

  async save(tenantId: string, userId: string, pinHash: string, audit: ApprovalPinAudit) {
    await getPrismaClient().$transaction(async (transaction) => {
      await transaction.coreApprovalPin.upsert({
        create: { pinHash, tenantId, userId },
        update: { failedAttempts: 0, lockedUntil: null, pinHash },
        where: { tenantId_userId: { tenantId, userId } },
      });
      await transaction.auditLog.create({ data: auditData(tenantId, audit) });
    });
  }

  async delete(tenantId: string, userId: string, audit: ApprovalPinAudit) {
    return getPrismaClient().$transaction(async (transaction) => {
      const removed = await transaction.coreApprovalPin.deleteMany({ where: { tenantId, userId } });
      if (removed.count === 0) return false;
      await transaction.auditLog.create({ data: auditData(tenantId, audit) });
      return true;
    });
  }

  async recordFailure(
    tenantId: string,
    userId: string,
    maxAttempts: number,
    lockUntil: Date,
    audit: Omit<ApprovalPinAudit, "action">,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      // One statement, so two wrong tries at the same moment both count.
      const rows = await transaction.$queryRaw<
        Array<{ failed_attempts: number; locked_until: Date | null }>
      >`
        UPDATE core_approval_pins
           SET failed_attempts = CASE WHEN failed_attempts + 1 >= ${maxAttempts} THEN 0
                                      ELSE failed_attempts + 1 END,
               locked_until = CASE WHEN failed_attempts + 1 >= ${maxAttempts} THEN ${lockUntil}
                                   ELSE locked_until END,
               updated_at = now()
         WHERE tenant_id = ${tenantId}::uuid AND user_id = ${userId}::uuid
     RETURNING failed_attempts, locked_until`;
      const state = rows[0];
      if (!state) return { failedAttempts: 0, lockedUntil: null };
      const locked = state.locked_until !== null && state.failed_attempts === 0;
      if (locked) {
        await transaction.auditLog.create({
          data: auditData(tenantId, { ...audit, action: "approval_pin.locked" }),
        });
      }
      return { failedAttempts: state.failed_attempts, lockedUntil: state.locked_until };
    });
  }

  async recordSuccess(tenantId: string, userId: string) {
    await getPrismaClient().coreApprovalPin.updateMany({
      data: { failedAttempts: 0, lockedUntil: null },
      where: { tenantId, userId },
    });
  }
}
