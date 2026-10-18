import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { buildAuditMetadata, buildAuditPayload } from "../../../core/audit/public.js";
import type { CommandOrigin } from "../../../shared/command/command-origin.js";
import {
  IntakeSourceLimitReached,
  type IntakeSourceRecord,
  type IntakeSourceRepository,
  type NewIntakeSource,
} from "../application/intake-source.repository.js";

const select = {
  createdAt: true,
  id: true,
  keyPrefix: true,
  label: true,
  lastUsedAt: true,
  outletId: true,
  revokedAt: true,
  secretHash: true,
  status: true,
  tenantId: true,
} as const;

type Transaction = Parameters<Parameters<ReturnType<typeof getPrismaClient>["$transaction"]>[0]>[0];

/** Who made or revoked a source, and when; never its key. */
async function audit(
  transaction: Transaction,
  action: string,
  source: IntakeSourceRecord,
  origin: CommandOrigin,
) {
  await transaction.auditLog.create({
    data: {
      action,
      ...(origin.actorId ? { actorId: origin.actorId } : {}),
      entityId: source.id,
      entityType: "kds_intake_source",
      metadata: buildAuditMetadata(
        action,
        buildAuditPayload({
          after: { keyPrefix: source.keyPrefix, label: source.label, status: source.status },
        }),
      ),
      outletId: source.outletId,
      ...(origin.requestId ? { requestId: origin.requestId } : {}),
      tenantId: source.tenantId,
    },
  });
}

@Injectable()
export class PrismaIntakeSourceRepository implements IntakeSourceRepository {
  async countActive(tenantId: string) {
    return getPrismaClient().kdsIntakeSource.count({ where: { status: "ACTIVE", tenantId } });
  }

  async create(
    tenantId: string,
    source: NewIntakeSource,
    origin: CommandOrigin,
    maxActive?: bigint,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      // Serialize source creation in this workspace, not globally. The
      // preflight gauge alone cannot stop two owners taking the last place.
      await transaction.$queryRaw`
        SELECT 1 AS locked FROM pg_advisory_xact_lock(
          hashtextextended(${tenantId} || ':kds-intake-source', 0)
        )
      `;
      if (maxActive !== undefined) {
        const used = BigInt(
          await transaction.kdsIntakeSource.count({
            where: { status: "ACTIVE", tenantId },
          }),
        );
        if (used >= maxActive) throw new IntakeSourceLimitReached(maxActive, used);
      }
      const created = await transaction.kdsIntakeSource.create({
        data: {
          ...source,
          ...(origin.actorId ? { createdBy: origin.actorId } : {}),
          tenantId,
        },
        select,
      });
      await audit(transaction, "kds.intake_source.create", created, origin);
      return created;
    });
  }

  async findActiveByPrefix(keyPrefix: string) {
    return getPrismaClient().kdsIntakeSource.findFirst({
      select,
      where: { keyPrefix, status: "ACTIVE" },
    });
  }

  async findOutlet(tenantId: string, outletId: string) {
    return getPrismaClient().outlet.findFirst({
      select: { status: true },
      where: { id: outletId, tenantId },
    });
  }

  async list(tenantId: string) {
    return getPrismaClient().kdsIntakeSource.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select,
      where: { tenantId },
    });
  }

  async revoke(tenantId: string, id: string, now: Date, origin: CommandOrigin) {
    return getPrismaClient().$transaction(async (transaction) => {
      const updated = await transaction.kdsIntakeSource.updateMany({
        data: { revokedAt: now, status: "REVOKED", updatedAt: now },
        where: { id, status: "ACTIVE", tenantId },
      });
      if (updated.count === 0) return null;
      const source = await transaction.kdsIntakeSource.findUniqueOrThrow({
        select,
        where: { tenantId_id: { id, tenantId } },
      });
      await audit(transaction, "kds.intake_source.revoke", source, origin);
      return source;
    });
  }

  async touch(id: string, now: Date) {
    await getPrismaClient().kdsIntakeSource.update({
      data: { lastUsedAt: now },
      where: { id },
    });
  }
}
