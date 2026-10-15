import { floorTableFootprint } from "@merchant/contracts";

export type GridSize = { cols: number; rows: number };

export type Footprint = { gridH: number; gridW: number };

/** A table that has a place on a floor. */
export type PlacedTable = Footprint & { gridX: number; gridY: number; id: string };

/**
 * How many cells a table takes. The rule lives in the contracts so the editor
 * draws exactly what the server will accept.
 */
export const footprintOf = floorTableFootprint;

export type LayoutIssue =
  | { kind: "OUT_OF_BOUNDS"; tableId: string }
  | { kind: "OVERLAP"; otherTableId: string; tableId: string };

function overlaps(first: PlacedTable, second: PlacedTable) {
  return (
    first.gridX < second.gridX + second.gridW &&
    first.gridX + first.gridW > second.gridX &&
    first.gridY < second.gridY + second.gridH &&
    first.gridY + first.gridH > second.gridY
  );
}

/** What is wrong with the tables placed on one floor; empty when nothing is. */
export function layoutIssues(grid: GridSize, tables: readonly PlacedTable[]): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  tables.forEach((table, index) => {
    if (
      table.gridX < 0 ||
      table.gridY < 0 ||
      table.gridX + table.gridW > grid.cols ||
      table.gridY + table.gridH > grid.rows
    ) {
      issues.push({ kind: "OUT_OF_BOUNDS", tableId: table.id });
    }
    for (const other of tables.slice(index + 1)) {
      if (overlaps(table, other)) {
        issues.push({ kind: "OVERLAP", otherTableId: other.id, tableId: table.id });
      }
    }
  });
  return issues;
}
