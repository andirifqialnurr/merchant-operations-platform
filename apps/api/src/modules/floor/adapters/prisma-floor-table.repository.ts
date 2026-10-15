import type { FloorTableRotation } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { buildAuditMetadata, buildAuditPayload } from "../../../core/audit/public.js";
import type { CommandOrigin } from "../../../shared/command/command-origin.js";
import {
  FloorTableLabelTakenError,
  type FloorTableRecord,
  type FloorTableRepository,
  type FloorTableWrite,
} from "../application/floor-table.repository.js";

const select = {
  area: { select: { floorId: true } },
  areaId: true,
  capacity: true,
  gridH: true,
  gridW: true,
  gridX: true,
  gridY: true,
  id: true,
  label: true,
  qrOrdering: true,
  rotation: true,
  shape: true,
  status: true,
  visualSize: true,
} as const;

const floorSelect = {
  areas: { select: { id: true, status: true } },
  gridCols: true,
  gridRows: true,
  id: true,
  status: true,
} as const;

type Row = {
  area: { floorId: string };
  areaId: string;
  capacity: number;
  gridH: number;
  gridW: number;
  gridX: number | null;
  gridY: number | null;
  id: string;
  label: string;
  qrOrdering: boolean;
  rotation: number;
  shape: FloorTableRecord["shape"];
  status: FloorTableRecord["status"];
  visualSize: FloorTableRecord["visualSize"];
};

function toRecord({ area, ...row }: Row): FloorTableRecord {
  return { ...row, floorId: area.floorId, rotation: row.rotation as FloorTableRotation };
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function guardLabel<T>(write: () => Promise<T>) {
  try {
    return await write();
  } catch (error) {
    if (isUniqueViolation(error)) throw new FloorTableLabelTakenError();
    throw error;
  }
}

/** The fields of a table that are written; the footprint arrives already worked out. */
const fields = (table: FloorTableWrite) => ({
  areaId: table.areaId,
  capacity: table.capacity,
  gridH: table.gridH,
  gridW: table.gridW,
  gridX: table.gridX,
  gridY: table.gridY,
  label: table.label,
  qrOrdering: table.qrOrdering,
  rotation: table.rotation,
  shape: table.shape,
  status: table.status,
  visualSize: table.visualSize,
});

@Injectable()
export class PrismaFloorTableRepository implements FloorTableRepository {
  async create(tenantId: string, outletId: string, table: FloorTableWrite, origin: CommandOrigin) {
    return guardLabel(() =>
      getPrismaClient().$transaction(async (transaction) => {
        const created = await transaction.floorServiceTable.create({
          data: { ...fields(table), outletId, tenantId },
          select,
        });
        await transaction.auditLog.create({
          data: {
            action: "floor.table.create",
            ...(origin.actorId ? { actorId: origin.actorId } : {}),
            entityId: created.id,
            entityType: "floor_table",
            metadata: buildAuditMetadata(
              "floor.table.create",
              buildAuditPayload({
                after: {
                  capacity: created.capacity,
                  label: created.label,
                  shape: created.shape,
                  visualSize: created.visualSize,
                },
              }),
            ),
            outletId,
            ...(origin.requestId ? { requestId: origin.requestId } : {}),
            tenantId,
          },
        });
        return toRecord(created);
      }),
    );
  }

  async findFloor(tenantId: string, outletId: string, floorId: string) {
    return getPrismaClient().floorFloor.findFirst({
      select: floorSelect,
      where: { id: floorId, outletId, tenantId },
    });
  }

  async findFloorOfArea(tenantId: string, outletId: string, areaId: string) {
    const area = await getPrismaClient().floorArea.findFirst({
      select: { floor: { select: floorSelect } },
      where: { id: areaId, outletId, tenantId },
    });
    return area?.floor ?? null;
  }

  async heldTableIds(tenantId: string, outletId: string) {
    const rows = await getPrismaClient().floorSessionTable.findMany({
      select: { tableId: true },
      where: { detachedAt: null, outletId, tenantId },
    });
    return new Set(rows.map((row) => row.tableId));
  }

  async list(tenantId: string, outletId: string) {
    const rows = await getPrismaClient().floorServiceTable.findMany({
      orderBy: [{ label: "asc" }],
      select,
      where: { outletId, tenantId },
    });
    return rows.map(toRecord);
  }

  async saveLayout(
    tenantId: string,
    outletId: string,
    floorId: string,
    tables: ReadonlyArray<FloorTableWrite & { id: string }>,
    origin: CommandOrigin,
  ) {
    await guardLabel(() =>
      getPrismaClient().$transaction(async (transaction) => {
        const now = new Date();
        for (const table of tables) {
          await transaction.floorServiceTable.update({
            data: { ...fields(table), updatedAt: now },
            where: { tenantId_id: { id: table.id, tenantId } },
          });
        }
        // One entry per save: which tables changed, not every coordinate.
        await transaction.auditLog.create({
          data: {
            action: "floor.layout.save",
            ...(origin.actorId ? { actorId: origin.actorId } : {}),
            entityId: floorId,
            entityType: "floor_floor",
            metadata: buildAuditMetadata(
              "floor.layout.save",
              buildAuditPayload({ after: { tables: tables.map((table) => table.label) } }),
            ),
            outletId,
            ...(origin.requestId ? { requestId: origin.requestId } : {}),
            tenantId,
          },
        });
      }),
    );
  }
}
