import { floorTableFootprint, type FloorTable, type FloorTableLayout } from "@merchant/contracts";

/** What the editor may change on a table; the footprint always follows from it. */
export type TableEdit = Partial<
  Pick<
    FloorTableLayout,
    | "areaId"
    | "capacity"
    | "gridX"
    | "gridY"
    | "label"
    | "qrOrdering"
    | "rotation"
    | "shape"
    | "status"
    | "visualSize"
  >
>;

/** Unsaved changes by table id. */
export type LayoutDraft = ReadonlyMap<string, TableEdit>;

export type Grid = { cols: number; rows: number };

/** A table as the editor shows it: the saved one with its unsaved changes. */
export function withDraft(table: FloorTable, draft: LayoutDraft): FloorTable {
  const edit = draft.get(table.id);
  if (!edit) return table;
  const next = { ...table, ...edit };
  return { ...next, ...floorTableFootprint(next.shape, next.visualSize, next.rotation) };
}

/** Keeps a placed table inside the grid after its footprint changed. */
export function keepInside(table: FloorTable, grid: Grid): FloorTable {
  if (table.gridX === null || table.gridY === null) return table;
  return {
    ...table,
    gridX: Math.max(0, Math.min(table.gridX, grid.cols - table.gridW)),
    gridY: Math.max(0, Math.min(table.gridY, grid.rows - table.gridH)),
  };
}

const overlaps = (
  left: Pick<FloorTable, "gridH" | "gridW"> & { gridX: number; gridY: number },
  right: Pick<FloorTable, "gridH" | "gridW"> & { gridX: number; gridY: number },
) =>
  left.gridX < right.gridX + right.gridW &&
  left.gridX + left.gridW > right.gridX &&
  left.gridY < right.gridY + right.gridH &&
  left.gridY + left.gridH > right.gridY;

/**
 * The first free spot for a table, scanning rows from the top left, or null
 * when the floor has no room left for it.
 */
export function firstFreeSpot(
  table: Pick<FloorTable, "gridH" | "gridW" | "id">,
  others: readonly FloorTable[],
  grid: Grid,
): { gridX: number; gridY: number } | null {
  const placed = others.flatMap((other) =>
    other.id === table.id || other.gridX === null || other.gridY === null
      ? []
      : [{ ...other, gridX: other.gridX, gridY: other.gridY }],
  );
  for (let gridY = 0; gridY + table.gridH <= grid.rows; gridY += 1) {
    for (let gridX = 0; gridX + table.gridW <= grid.cols; gridX += 1) {
      const spot = { gridH: table.gridH, gridW: table.gridW, gridX, gridY };
      if (!placed.some((other) => overlaps(spot, other))) return { gridX, gridY };
    }
  }
  return null;
}

/** The request body for one table: every field the server takes, nothing it works out. */
export function toLayout(table: FloorTable): FloorTableLayout {
  return {
    areaId: table.areaId,
    capacity: table.capacity,
    gridX: table.gridX,
    gridY: table.gridY,
    id: table.id,
    label: table.label,
    qrOrdering: table.qrOrdering,
    rotation: table.rotation,
    shape: table.shape,
    status: table.status,
    visualSize: table.visualSize,
  };
}

/** Adds an edit to the draft, dropping it again when the table is back as saved. */
export function edited(
  draft: LayoutDraft,
  saved: FloorTable,
  edit: TableEdit,
  grid: Grid,
): Map<string, TableEdit> {
  const next = new Map(draft);
  const merged = keepInside(
    withDraft(saved, new Map([[saved.id, { ...draft.get(saved.id), ...edit }]])),
    grid,
  );
  const change: TableEdit = {};
  for (const key of [
    "areaId",
    "capacity",
    "gridX",
    "gridY",
    "label",
    "qrOrdering",
    "rotation",
    "shape",
    "status",
    "visualSize",
  ] as const) {
    if (merged[key] !== saved[key]) Object.assign(change, { [key]: merged[key] });
  }
  if (Object.keys(change).length === 0) next.delete(saved.id);
  else next.set(saved.id, change);
  return next;
}
