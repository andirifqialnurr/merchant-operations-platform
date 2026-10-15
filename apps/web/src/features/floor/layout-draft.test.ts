import assert from "node:assert/strict";
import test from "node:test";

import type { FloorTable } from "@merchant/contracts";

import { edited, firstFreeSpot, toLayout, withDraft } from "./layout-draft.ts";

const GRID = { cols: 24, rows: 16 };

const table = (id: string, change: Partial<FloorTable> = {}): FloorTable => ({
  areaId: "019f8801-d536-746c-8e81-30b8937cef6c",
  capacity: 4,
  gridH: 3,
  gridW: 3,
  gridX: null,
  gridY: null,
  id,
  label: id.toUpperCase(),
  qrOrdering: true,
  rotation: 0,
  shape: "SQUARE",
  status: "ACTIVE",
  visualSize: "MEDIUM",
  ...change,
});

test("an edit changes the footprint the way the server will", () => {
  const saved = table("t1", { gridX: 0, gridY: 0 });
  const draft = edited(new Map(), saved, { shape: "RECTANGLE", visualSize: "LARGE" }, GRID);
  const shown = withDraft(saved, draft);
  assert.deepEqual([shown.gridW, shown.gridH], [6, 3]);
  const turned = withDraft(saved, edited(draft, saved, { rotation: 90 }, GRID));
  assert.deepEqual([turned.gridW, turned.gridH], [3, 6]);
});

test("a table that grows at the edge is pulled back inside the floor", () => {
  const saved = table("t1", { gridX: 22, gridY: 14, gridH: 2, gridW: 2, visualSize: "SMALL" });
  const shown = withDraft(saved, edited(new Map(), saved, { visualSize: "LARGE" }, GRID));
  assert.deepEqual([shown.gridX, shown.gridY], [20, 12]);
});

test("an edit undone by hand leaves nothing unsaved", () => {
  const saved = table("t1", { gridX: 4, gridY: 4 });
  const moved = edited(new Map(), saved, { gridX: 5 }, GRID);
  assert.equal(moved.size, 1);
  assert.equal(edited(moved, saved, { gridX: 4 }, GRID).size, 0);
});

test("a table from the tray goes to the first spot where it fits", () => {
  const placed = [table("a", { gridX: 0, gridY: 0 }), table("b", { gridX: 3, gridY: 0 })];
  assert.deepEqual(firstFreeSpot(table("c"), placed, GRID), { gridX: 6, gridY: 0 });
  assert.equal(firstFreeSpot(table("c"), placed, { cols: 6, rows: 3 }), null);
});

test("the request carries no footprint", () => {
  assert.equal("gridW" in toLayout(table("t1")), false);
});
