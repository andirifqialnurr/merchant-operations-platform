import assert from "node:assert/strict";
import test from "node:test";

import { footprintOf, layoutIssues } from "./layout.js";

const GRID = { cols: 24, rows: 16 };

test("a table's footprint follows its shape and size, turned when rotated", () => {
  assert.deepEqual(footprintOf("SQUARE", "SMALL", 0), { gridH: 2, gridW: 2 });
  assert.deepEqual(footprintOf("ROUND", "LARGE", 90), { gridH: 4, gridW: 4 });
  assert.deepEqual(footprintOf("RECTANGLE", "MEDIUM", 0), { gridH: 2, gridW: 4 });
  assert.deepEqual(footprintOf("RECTANGLE", "MEDIUM", 90), { gridH: 4, gridW: 2 });
});

test("tables side by side are fine; touching edges do not overlap", () => {
  assert.deepEqual(
    layoutIssues(GRID, [
      { gridH: 2, gridW: 2, gridX: 0, gridY: 0, id: "a" },
      { gridH: 2, gridW: 2, gridX: 2, gridY: 0, id: "b" },
      { gridH: 2, gridW: 4, gridX: 20, gridY: 14, id: "c" },
    ]),
    [],
  );
});

test("a table over another or past the edge is named", () => {
  assert.deepEqual(
    layoutIssues(GRID, [
      { gridH: 3, gridW: 3, gridX: 0, gridY: 0, id: "a" },
      { gridH: 2, gridW: 2, gridX: 2, gridY: 2, id: "b" },
      { gridH: 2, gridW: 4, gridX: 21, gridY: 0, id: "c" },
      { gridH: 2, gridW: 2, gridX: 0, gridY: 15, id: "d" },
    ]),
    [
      { kind: "OVERLAP", otherTableId: "b", tableId: "a" },
      { kind: "OUT_OF_BOUNDS", tableId: "c" },
      { kind: "OUT_OF_BOUNDS", tableId: "d" },
    ],
  );
});
