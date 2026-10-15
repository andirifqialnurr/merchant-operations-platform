import type {
  FloorRecordStatus,
  FloorTableRotation,
  FloorTableShape,
  FloorTableSize,
} from "@merchant/contracts";

import type { CommandOrigin } from "../../../shared/command/command-origin.js";

export type FloorTableRecord = {
  areaId: string;
  capacity: number;
  /** The floor of the table's area. */
  floorId: string;
  gridH: number;
  gridW: number;
  gridX: number | null;
  gridY: number | null;
  id: string;
  label: string;
  qrOrdering: boolean;
  rotation: FloorTableRotation;
  shape: FloorTableShape;
  status: FloorRecordStatus;
  visualSize: FloorTableSize;
};

export type FloorTableWrite = Omit<FloorTableRecord, "floorId" | "id">;

export type FloorPlace = {
  areas: Array<{ id: string; status: FloorRecordStatus }>;
  gridCols: number;
  gridRows: number;
  id: string;
  status: FloorRecordStatus;
};

/**
 * Where an outlet's tables are kept. Writes are audited by the store. A label
 * already used at the outlet makes a write throw `FloorTableLabelTakenError`.
 */
export interface FloorTableRepository {
  create(
    tenantId: string,
    outletId: string,
    table: FloorTableWrite,
    origin: CommandOrigin,
  ): Promise<FloorTableRecord>;
  /** The floor with its areas, when it is one of the outlet's. */
  findFloor(tenantId: string, outletId: string, floorId: string): Promise<FloorPlace | null>;
  /** The floor an area lies on, when the area is one of the outlet's. */
  findFloorOfArea(tenantId: string, outletId: string, areaId: string): Promise<FloorPlace | null>;
  /** Every table of the outlet, active or not. */
  list(tenantId: string, outletId: string): Promise<FloorTableRecord[]>;
  /** Writes the changed tables of one floor together, or none of them. */
  saveLayout(
    tenantId: string,
    outletId: string,
    floorId: string,
    tables: ReadonlyArray<FloorTableWrite & { id: string }>,
    origin: CommandOrigin,
  ): Promise<void>;
}

export class FloorTableLabelTakenError extends Error {}

export const FLOOR_TABLE_REPOSITORY = Symbol("FLOOR_TABLE_REPOSITORY");
