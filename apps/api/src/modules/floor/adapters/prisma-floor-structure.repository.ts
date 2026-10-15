import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { buildAuditMetadata, buildAuditPayload } from "../../../core/audit/public.js";
import type { CommandOrigin } from "../../../shared/command/command-origin.js";
import {
  FloorNameTakenError,
  type FloorAreaRecord,
  type FloorChange,
  type FloorRecord,
  type FloorStructureRepository,
} from "../application/floor-structure.repository.js";

type Transaction = Parameters<Parameters<ReturnType<typeof getPrismaClient>["$transaction"]>[0]>[0];

const MAIN_AREA = "Main Area";

const areaSelect = {
  displayOrder: true,
  floorId: true,
  id: true,
  name: true,
  status: true,
} as const;

const floorSelect = {
  areas: {
    orderBy: [{ displayOrder: "asc" as const }, { createdAt: "asc" as const }],
    select: areaSelect,
  },
  displayOrder: true,
  gridCols: true,
  gridRows: true,
  id: true,
  name: true,
  outletId: true,
  status: true,
};

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function guardName<T>(write: () => Promise<T>) {
  try {
    return await write();
  } catch (error) {
    if (isUniqueViolation(error)) throw new FloorNameTakenError();
    throw error;
  }
}

async function audit(
  transaction: Transaction,
  entry: {
    action: string;
    after: Record<string, unknown>;
    before?: Record<string, unknown>;
    entityId: string;
    entityType: "floor_area" | "floor_floor";
    outletId: string;
    tenantId: string;
  },
  origin: CommandOrigin,
) {
  await transaction.auditLog.create({
    data: {
      action: entry.action,
      ...(origin.actorId ? { actorId: origin.actorId } : {}),
      entityId: entry.entityId,
      entityType: entry.entityType,
      metadata: buildAuditMetadata(
        entry.action,
        buildAuditPayload({
          after: entry.after,
          ...(entry.before ? { before: entry.before } : {}),
        }),
      ),
      outletId: entry.outletId,
      ...(origin.requestId ? { requestId: origin.requestId } : {}),
      tenantId: entry.tenantId,
    },
  });
}

const fullest = (groups: ReadonlyArray<{ _count: { _all: number } }>) =>
  groups.reduce((most, group) => Math.max(most, group._count._all), 0);

/** Only the fields the change names. */
const written = (change: FloorChange) => ({
  ...(change.name !== undefined ? { name: change.name } : {}),
  ...(change.status !== undefined ? { status: change.status } : {}),
});

const ACTIVE_COUNT = { _count: { _all: true } } as const;

@Injectable()
export class PrismaFloorStructureRepository implements FloorStructureRepository {
  async countActive(tenantId: string, what: "areas" | "floors" | "tables", scopeId?: string) {
    const db = getPrismaClient();
    if (what === "floors") {
      if (scopeId) {
        return db.floorFloor.count({ where: { outletId: scopeId, status: "ACTIVE", tenantId } });
      }
      const groups = await db.floorFloor.groupBy({
        ...ACTIVE_COUNT,
        by: ["outletId"],
        where: { status: "ACTIVE", tenantId },
      });
      return fullest(groups);
    }
    if (what === "areas") {
      if (scopeId) {
        return db.floorArea.count({ where: { floorId: scopeId, status: "ACTIVE", tenantId } });
      }
      const groups = await db.floorArea.groupBy({
        ...ACTIVE_COUNT,
        by: ["floorId"],
        where: { status: "ACTIVE", tenantId },
      });
      return fullest(groups);
    }
    if (scopeId) {
      return db.floorServiceTable.count({
        where: { outletId: scopeId, status: "ACTIVE", tenantId },
      });
    }
    const groups = await db.floorServiceTable.groupBy({
      ...ACTIVE_COUNT,
      by: ["outletId"],
      where: { status: "ACTIVE", tenantId },
    });
    return fullest(groups);
  }

  async countActiveTables(tenantId: string, scope: { areaId: string } | { floorId: string }) {
    return getPrismaClient().floorServiceTable.count({
      where: {
        status: "ACTIVE",
        tenantId,
        ...("areaId" in scope ? { areaId: scope.areaId } : { area: { floorId: scope.floorId } }),
      },
    });
  }

  async createFloor(tenantId: string, outletId: string, name: string, origin: CommandOrigin) {
    return guardName(() =>
      getPrismaClient().$transaction(async (transaction) => {
        const last = await transaction.floorFloor.aggregate({
          _max: { displayOrder: true },
          where: { outletId, tenantId },
        });
        const floor = await transaction.floorFloor.create({
          data: {
            areas: { create: { name: MAIN_AREA } },
            displayOrder: (last._max.displayOrder ?? -1) + 1,
            name,
            outletId,
            tenantId,
          },
          select: floorSelect,
        });
        await audit(
          transaction,
          {
            action: "floor.floor.create",
            after: { name: floor.name, status: floor.status },
            entityId: floor.id,
            entityType: "floor_floor",
            outletId,
            tenantId,
          },
          origin,
        );
        return floor;
      }),
    );
  }

  async createArea(tenantId: string, floor: FloorRecord, name: string, origin: CommandOrigin) {
    return guardName(() =>
      getPrismaClient().$transaction(async (transaction) => {
        const area = await transaction.floorArea.create({
          data: {
            displayOrder:
              floor.areas.reduce((most, item) => Math.max(most, item.displayOrder), -1) + 1,
            floorId: floor.id,
            name,
            outletId: floor.outletId,
            tenantId,
          },
          select: areaSelect,
        });
        await audit(
          transaction,
          {
            action: "floor.area.create",
            after: { floorId: floor.id, name: area.name, status: area.status },
            entityId: area.id,
            entityType: "floor_area",
            outletId: floor.outletId,
            tenantId,
          },
          origin,
        );
        return area;
      }),
    );
  }

  async findOutlet(tenantId: string, outletId: string) {
    return getPrismaClient().outlet.findFirst({
      select: { status: true },
      where: { id: outletId, tenantId },
    });
  }

  async list(tenantId: string, outletId: string): Promise<FloorRecord[]> {
    return getPrismaClient().floorFloor.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: floorSelect,
      where: { outletId, tenantId },
    });
  }

  async reorderFloors(
    tenantId: string,
    outletId: string,
    ids: readonly string[],
    origin: CommandOrigin,
  ) {
    await getPrismaClient().$transaction(async (transaction) => {
      const now = new Date();
      for (const [displayOrder, id] of ids.entries()) {
        await transaction.floorFloor.updateMany({
          data: { displayOrder, updatedAt: now },
          where: { id, outletId, tenantId },
        });
      }
      await audit(
        transaction,
        {
          action: "floor.floor.reorder",
          after: { order: [...ids] },
          entityId: outletId,
          entityType: "floor_floor",
          outletId,
          tenantId,
        },
        origin,
      );
    });
  }

  async reorderAreas(
    tenantId: string,
    floor: FloorRecord,
    ids: readonly string[],
    origin: CommandOrigin,
  ) {
    await getPrismaClient().$transaction(async (transaction) => {
      const now = new Date();
      for (const [displayOrder, id] of ids.entries()) {
        await transaction.floorArea.updateMany({
          data: { displayOrder, updatedAt: now },
          where: { floorId: floor.id, id, tenantId },
        });
      }
      await audit(
        transaction,
        {
          action: "floor.area.reorder",
          after: { order: [...ids] },
          entityId: floor.id,
          entityType: "floor_floor",
          outletId: floor.outletId,
          tenantId,
        },
        origin,
      );
    });
  }

  async updateFloor(
    tenantId: string,
    floor: FloorRecord,
    change: FloorChange,
    origin: CommandOrigin,
  ) {
    return guardName(() =>
      getPrismaClient().$transaction(async (transaction) => {
        const updated = await transaction.floorFloor.update({
          data: { ...written(change), updatedAt: new Date() },
          select: floorSelect,
          where: { tenantId_id: { id: floor.id, tenantId } },
        });
        await audit(
          transaction,
          {
            action: "floor.floor.update",
            after: { name: updated.name, status: updated.status },
            before: { name: floor.name, status: floor.status },
            entityId: floor.id,
            entityType: "floor_floor",
            outletId: floor.outletId,
            tenantId,
          },
          origin,
        );
        return updated;
      }),
    );
  }

  async updateArea(
    tenantId: string,
    area: FloorAreaRecord,
    outletId: string,
    change: FloorChange,
    origin: CommandOrigin,
  ) {
    return guardName(() =>
      getPrismaClient().$transaction(async (transaction) => {
        const updated = await transaction.floorArea.update({
          data: { ...written(change), updatedAt: new Date() },
          select: areaSelect,
          where: { tenantId_id: { id: area.id, tenantId } },
        });
        await audit(
          transaction,
          {
            action: "floor.area.update",
            after: { name: updated.name, status: updated.status },
            before: { name: area.name, status: area.status },
            entityId: area.id,
            entityType: "floor_area",
            outletId,
            tenantId,
          },
          origin,
        );
        return updated;
      }),
    );
  }
}
