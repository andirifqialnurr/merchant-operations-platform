import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { buildAuditMetadata, buildAuditPayload } from "../../../core/audit/public.js";
import type { CommandOrigin } from "../../../shared/command/command-origin.js";
import type {
  NewQrToken,
  QrTokenRecord,
  TableQrRepository,
} from "../application/table-qr.repository.js";

type Transaction = Parameters<Parameters<ReturnType<typeof getPrismaClient>["$transaction"]>[0]>[0];

const select = { salt: true, status: true, version: true } as const;

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/** Who did what to a table's QR, and which version; never the token. */
async function audit(
  transaction: Transaction,
  action: string,
  entry: { outletId: string; tableId: string; tenantId: string; version: number },
  origin: CommandOrigin,
) {
  await transaction.auditLog.create({
    data: {
      action,
      ...(origin.actorId ? { actorId: origin.actorId } : {}),
      entityId: entry.tableId,
      entityType: "floor_table",
      metadata: buildAuditMetadata(
        action,
        buildAuditPayload({ after: { version: entry.version } }),
      ),
      outletId: entry.outletId,
      ...(origin.requestId ? { requestId: origin.requestId } : {}),
      tenantId: entry.tenantId,
    },
  });
}

@Injectable()
export class PrismaTableQrRepository implements TableQrRepository {
  async current(tenantId: string, outletId: string, tableId: string) {
    const table = await getPrismaClient().floorServiceTable.findFirst({
      select: {
        label: true,
        qrTokens: { orderBy: { version: "desc" }, select, take: 1 },
        status: true,
      },
      where: { id: tableId, outletId, tenantId },
    });
    if (!table) return { latest: null, table: null };
    return {
      latest: (table.qrTokens[0] as QrTokenRecord | undefined) ?? null,
      table: { label: table.label, status: table.status },
    };
  }

  async create(
    tenantId: string,
    outletId: string,
    tableId: string,
    token: NewQrToken,
    origin: CommandOrigin,
  ) {
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        const last = await transaction.floorQrToken.aggregate({
          _max: { version: true },
          where: { tableId, tenantId },
        });
        const created = await transaction.floorQrToken.create({
          data: {
            ...(origin.actorId ? { createdBy: origin.actorId } : {}),
            outletId,
            salt: token.salt,
            tableId,
            tenantId,
            tokenHash: token.tokenHash,
            version: (last._max.version ?? 0) + 1,
          },
          select,
        });
        await audit(
          transaction,
          "floor.table_qr.generate",
          { outletId, tableId, tenantId, version: created.version },
          origin,
        );
        return created as QrTokenRecord;
      });
    } catch (error) {
      // Another working QR was made at the same moment.
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  }

  async rotate(
    tenantId: string,
    outletId: string,
    tableId: string,
    token: NewQrToken,
    now: Date,
    origin: CommandOrigin,
  ) {
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        const active = await transaction.floorQrToken.findFirst({
          select: { id: true, version: true },
          where: { outletId, status: "ACTIVE", tableId, tenantId },
        });
        if (!active) return null;
        const retired = await transaction.floorQrToken.updateMany({
          data: { rotatedAt: now, status: "ROTATED" },
          where: { id: active.id, status: "ACTIVE" },
        });
        if (retired.count !== 1) return null;
        const created = await transaction.floorQrToken.create({
          data: {
            ...(origin.actorId ? { createdBy: origin.actorId } : {}),
            outletId,
            salt: token.salt,
            tableId,
            tenantId,
            tokenHash: token.tokenHash,
            version: active.version + 1,
          },
          select,
        });
        await audit(
          transaction,
          "floor.table_qr.rotate",
          { outletId, tableId, tenantId, version: created.version },
          origin,
        );
        return created as QrTokenRecord;
      });
    } catch (error) {
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  }

  async revoke(
    tenantId: string,
    outletId: string,
    tableId: string,
    now: Date,
    origin: CommandOrigin,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      const active = await transaction.floorQrToken.findFirst({
        select: { id: true, version: true },
        where: { outletId, status: "ACTIVE", tableId, tenantId },
      });
      if (!active) return null;
      const revoked = await transaction.floorQrToken.update({
        data: { revokedAt: now, status: "REVOKED" },
        select,
        where: { id: active.id },
      });
      await audit(
        transaction,
        "floor.table_qr.revoke",
        { outletId, tableId, tenantId, version: active.version },
        origin,
      );
      return revoked as QrTokenRecord;
    });
  }

  async resolve(tokenHash: string) {
    const token = await getPrismaClient().floorQrToken.findFirst({
      select: {
        table: {
          select: {
            area: {
              select: {
                floor: {
                  select: {
                    outlet: {
                      select: { brand: { select: { name: true } }, name: true, status: true },
                    },
                    status: true,
                  },
                },
                status: true,
              },
            },
            label: true,
            qrOrdering: true,
            status: true,
          },
        },
        tenantId: true,
      },
      where: { status: "ACTIVE", tokenHash },
    });
    if (!token) return null;
    const { area, label, qrOrdering, status } = token.table;
    const outlet = area.floor.outlet;
    return {
      brandName: outlet.brand.name,
      outletActive: outlet.status === "ACTIVE",
      outletName: outlet.name,
      qrOrdering,
      tableActive:
        status === "ACTIVE" && area.status === "ACTIVE" && area.floor.status === "ACTIVE",
      tableLabel: label,
      tenantId: token.tenantId,
    };
  }
}
