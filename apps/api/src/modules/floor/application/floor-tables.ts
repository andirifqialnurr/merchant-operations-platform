import {
  floorTableSchema,
  type CreateFloorTable,
  type FloorTableLayout,
} from "@merchant/contracts";
import { ConflictException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";

import type { CommandOrigin } from "../../../shared/command/command-origin.js";
import { LIMIT_GATE, NO_LIMITS, type LimitGate } from "../../../shared/limits/limit-gate.js";
import { footprintOf, layoutIssues } from "../domain/layout.js";
import { FLOOR_DIMENSIONS } from "./floor-structure.js";
import {
  FLOOR_TABLE_REPOSITORY,
  FloorTableLabelTakenError,
  type FloorTableRecord,
  type FloorTableRepository,
} from "./floor-table.repository.js";

/** A table as staff see it: the floor is known from its area. */
function toTable(record: FloorTableRecord) {
  const table: Partial<FloorTableRecord> = { ...record };
  delete table.floorId;
  return floorTableSchema.parse(table);
}

function labelTaken(label: string) {
  return new ConflictException({
    code: "FLOOR_TABLE_LABEL_TAKEN",
    details: { label },
    message: "This table label is already used at this outlet.",
  });
}

async function labelled<T>(write: () => Promise<T>, label: string) {
  try {
    return await write();
  } catch (error) {
    if (error instanceof FloorTableLabelTakenError) throw labelTaken(label);
    throw error;
  }
}

const sameLabel = (left: string, right: string) =>
  left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();

/**
 * The tables of an outlet and where they stand. A new table waits in the
 * tray; the editor then saves the changed tables of one floor at once, and
 * the server checks the whole floor before anything is written.
 */
@Injectable()
export class FloorTables {
  constructor(
    @Inject(FLOOR_TABLE_REPOSITORY) private readonly tables: FloorTableRepository,
    @Optional() @Inject(LIMIT_GATE) private readonly limits: LimitGate = NO_LIMITS,
  ) {}

  async list(tenantId: string, outletId: string) {
    return (await this.tables.list(tenantId, outletId)).map(toTable);
  }

  async create(tenantId: string, outletId: string, input: CreateFloorTable, origin: CommandOrigin) {
    const floor = await this.tables.findFloorOfArea(tenantId, outletId, input.areaId);
    const area = floor?.areas.find((item) => item.id === input.areaId);
    if (!floor || !area) {
      throw new NotFoundException({ code: "FLOOR_AREA_NOT_FOUND", message: "Area was not found." });
    }
    if (floor.status !== "ACTIVE" || area.status !== "ACTIVE") {
      throw new ConflictException({
        code: "FLOOR_AREA_INACTIVE",
        message: "Tables are added to an active area of an active floor.",
      });
    }
    const existing = await this.tables.list(tenantId, outletId);
    if (existing.some((table) => sameLabel(table.label, input.label))) {
      throw labelTaken(input.label);
    }
    await this.limits.assertCanAdd(tenantId, FLOOR_DIMENSIONS.tables, 1n, outletId);
    const footprint = footprintOf(input.shape, input.visualSize, 0);
    return toTable(
      await labelled(
        () =>
          this.tables.create(
            tenantId,
            outletId,
            {
              ...input,
              ...footprint,
              gridX: null,
              gridY: null,
              qrOrdering: true,
              rotation: 0,
              status: "ACTIVE",
            },
            origin,
          ),
        input.label,
      ),
    );
  }

  /**
   * Applies the editor's changes to one floor. Footprints are worked out
   * here, never taken from the request; the floor as it would be after the
   * change must have no table over another or past its edge.
   */
  async saveLayout(
    tenantId: string,
    outletId: string,
    floorId: string,
    changes: readonly FloorTableLayout[],
    origin: CommandOrigin,
  ) {
    const floor = await this.tables.findFloor(tenantId, outletId, floorId);
    if (!floor) {
      throw new NotFoundException({ code: "FLOOR_NOT_FOUND", message: "Floor was not found." });
    }
    const all = await this.tables.list(tenantId, outletId);
    const byId = new Map(all.map((table) => [table.id, table]));
    const areaIds = new Set(floor.areas.map((area) => area.id));

    const written = changes.map((change) => {
      const current = byId.get(change.id);
      if (!current || current.floorId !== floorId) {
        throw new NotFoundException({
          code: "FLOOR_TABLE_NOT_FOUND",
          details: { label: change.label },
          message: "A table is not on this floor.",
        });
      }
      const area = floor.areas.find((item) => item.id === change.areaId);
      if (!areaIds.has(change.areaId) || !area) {
        throw new NotFoundException({
          code: "FLOOR_AREA_NOT_FOUND",
          message: "A table was moved to an area that is not on this floor.",
        });
      }
      if (area.status !== "ACTIVE" && change.areaId !== current.areaId) {
        throw new ConflictException({
          code: "FLOOR_AREA_INACTIVE",
          message: "Tables are moved to an active area.",
        });
      }
      return {
        before: current,
        table: {
          ...change,
          ...footprintOf(change.shape, change.visualSize, change.rotation),
        },
      };
    });

    // Labels stay unique at the outlet, the changed ones included.
    const labels = new Map(all.map((table) => [table.id, table.label]));
    for (const { table } of written) labels.set(table.id, table.label);
    for (const { table } of written) {
      const clash = [...labels].find(
        ([id, label]) => id !== table.id && sameLabel(label, table.label),
      );
      if (clash) throw labelTaken(table.label);
    }

    const after = new Map(
      all.filter((table) => table.floorId === floorId).map((table) => [table.id, table]),
    );
    for (const { table } of written) after.set(table.id, { ...table, floorId });
    const placed = [...after.values()].flatMap((table) =>
      table.gridX === null || table.gridY === null
        ? []
        : [
            {
              gridH: table.gridH,
              gridW: table.gridW,
              gridX: table.gridX,
              gridY: table.gridY,
              id: table.id,
            },
          ],
    );
    const issues = layoutIssues({ cols: floor.gridCols, rows: floor.gridRows }, placed);
    if (issues.length > 0) {
      const labelOf = (id: string) => after.get(id)?.label ?? "";
      throw new ConflictException({
        code: "FLOOR_LAYOUT_INVALID",
        details: {
          issues: issues.map((issue) =>
            issue.kind === "OVERLAP"
              ? {
                  kind: issue.kind,
                  label: labelOf(issue.tableId),
                  other: labelOf(issue.otherTableId),
                }
              : { kind: issue.kind, label: labelOf(issue.tableId) },
          ),
        },
        message: "Tables would stand on each other or past the edge of the floor.",
      });
    }

    const reactivated = written.filter(
      ({ before, table }) => before.status === "INACTIVE" && table.status === "ACTIVE",
    ).length;
    if (reactivated > 0) {
      await this.limits.assertCanAdd(
        tenantId,
        FLOOR_DIMENSIONS.tables,
        BigInt(reactivated),
        outletId,
      );
    }

    await labelled(
      () =>
        this.tables.saveLayout(
          tenantId,
          outletId,
          floorId,
          written.map(({ table }) => table),
          origin,
        ),
      written[0]?.table.label ?? "",
    );
    return (await this.tables.list(tenantId, outletId))
      .filter((table) => table.floorId === floorId)
      .map(toTable);
  }
}
