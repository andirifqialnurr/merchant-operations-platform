import type { FloorRecordStatus } from "@merchant/contracts";

import type { CommandOrigin } from "../../../shared/command/command-origin.js";

export type FloorAreaRecord = {
  displayOrder: number;
  floorId: string;
  id: string;
  name: string;
  status: FloorRecordStatus;
};

export type FloorRecord = {
  areas: FloorAreaRecord[];
  displayOrder: number;
  gridCols: number;
  gridRows: number;
  id: string;
  name: string;
  outletId: string;
  status: FloorRecordStatus;
};

export type FloorChange = { name?: string | undefined; status?: FloorRecordStatus | undefined };

/**
 * Where an outlet's floors and areas are kept. Every write is audited by the
 * store, in the same transaction. A name already used on the same outlet
 * (floor) or floor (area) makes a write throw `FloorNameTakenError`.
 */
export interface FloorStructureRepository {
  /**
   * For package limits: active floors of an outlet, active areas of a floor,
   * or active tables of an outlet. Without a scope, the fullest one.
   */
  countActive(
    tenantId: string,
    what: "areas" | "floors" | "tables",
    scopeId?: string,
  ): Promise<number>;
  /** Active tables on the floor or in the area. */
  countActiveTables(
    tenantId: string,
    scope: { areaId: string } | { floorId: string },
  ): Promise<number>;
  /** A new floor holding a `Main Area`, placed after the others. */
  createFloor(
    tenantId: string,
    outletId: string,
    name: string,
    origin: CommandOrigin,
  ): Promise<FloorRecord>;
  createArea(
    tenantId: string,
    floor: FloorRecord,
    name: string,
    origin: CommandOrigin,
  ): Promise<FloorAreaRecord>;
  findOutlet(tenantId: string, outletId: string): Promise<{ status: string } | null>;
  /** Every floor of the outlet with its areas, active or not, in display order. */
  list(tenantId: string, outletId: string): Promise<FloorRecord[]>;
  reorderAreas(
    tenantId: string,
    floor: FloorRecord,
    ids: readonly string[],
    origin: CommandOrigin,
  ): Promise<void>;
  reorderFloors(
    tenantId: string,
    outletId: string,
    ids: readonly string[],
    origin: CommandOrigin,
  ): Promise<void>;
  updateArea(
    tenantId: string,
    area: FloorAreaRecord,
    outletId: string,
    change: FloorChange,
    origin: CommandOrigin,
  ): Promise<FloorAreaRecord>;
  updateFloor(
    tenantId: string,
    floor: FloorRecord,
    change: FloorChange,
    origin: CommandOrigin,
  ): Promise<FloorRecord>;
}

export class FloorNameTakenError extends Error {}

export const FLOOR_STRUCTURE_REPOSITORY = Symbol("FLOOR_STRUCTURE_REPOSITORY");
