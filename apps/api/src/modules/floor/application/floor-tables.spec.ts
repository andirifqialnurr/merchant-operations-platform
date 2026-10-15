import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { FloorTableLayout } from "@merchant/contracts";

import type { LimitGate } from "../../../shared/limits/limit-gate.js";
import type {
  FloorPlace,
  FloorTableRecord,
  FloorTableRepository,
  FloorTableWrite,
} from "./floor-table.repository.js";
import { FloorTables } from "./floor-tables.js";

const TENANT = "019f8801-d536-746c-8e81-30b8937cef6c";
const OUTLET = "019f8801-d56e-7b2d-b124-b67f253a9b1d";
const ORIGIN = {};

class MemoryTables implements FloorTableRepository {
  floors: Array<FloorPlace> = [];
  tables: FloorTableRecord[] = [];
  saves = 0;

  constructor() {
    this.floors.push(this.floor(), this.floor());
  }

  floor(): FloorPlace {
    return {
      areas: [
        { id: randomUUID(), status: "ACTIVE" },
        { id: randomUUID(), status: "INACTIVE" },
      ],
      gridCols: 24,
      gridRows: 16,
      id: randomUUID(),
      status: "ACTIVE",
    };
  }

  async create(_tenantId: string, _outletId: string, table: FloorTableWrite) {
    const floor = this.floors.find((item) => item.areas.some((area) => area.id === table.areaId))!;
    const record = { ...table, floorId: floor.id, id: randomUUID() };
    this.tables.push(record);
    return record;
  }

  async findFloor(_tenantId: string, _outletId: string, floorId: string) {
    return this.floors.find((item) => item.id === floorId) ?? null;
  }

  async findFloorOfArea(_tenantId: string, _outletId: string, areaId: string) {
    return this.floors.find((item) => item.areas.some((area) => area.id === areaId)) ?? null;
  }

  held = new Set<string>();

  async heldTableIds() {
    return this.held;
  }

  async list() {
    return structuredClone(this.tables);
  }

  async saveLayout(
    _tenantId: string,
    _outletId: string,
    _floorId: string,
    tables: ReadonlyArray<FloorTableWrite & { id: string }>,
  ) {
    this.saves += 1;
    for (const table of tables) {
      Object.assign(
        this.tables.find((item) => item.id === table.id)!,
        table,
      );
    }
  }
}

async function codeOf(action: () => Promise<unknown>) {
  try {
    await action();
    return "OK";
  } catch (error) {
    const response = (error as { getResponse?: () => unknown }).getResponse?.();
    return (response as { code?: string } | undefined)?.code ?? String(error);
  }
}

function setup(limits?: LimitGate) {
  const repository = new MemoryTables();
  const [first, second] = repository.floors;
  return {
    first: first!,
    repository,
    second: second!,
    tables: new FloorTables(repository, limits),
  };
}

const layoutOf = (
  table: {
    areaId: string;
    capacity: number;
    id: string;
    label: string;
    shape: FloorTableLayout["shape"];
    visualSize: FloorTableLayout["visualSize"];
  },
  change: Partial<FloorTableLayout>,
): FloorTableLayout => ({
  areaId: table.areaId,
  capacity: table.capacity,
  gridX: null,
  gridY: null,
  id: table.id,
  label: table.label,
  qrOrdering: true,
  rotation: 0,
  shape: table.shape,
  status: "ACTIVE",
  visualSize: table.visualSize,
  ...change,
});

test("a new table waits in the tray with the footprint of its shape and size", async () => {
  const { first, tables } = setup();
  const made = await tables.create(
    TENANT,
    OUTLET,
    {
      areaId: first.areas[0]!.id,
      capacity: 6,
      label: "T1",
      shape: "RECTANGLE",
      visualSize: "MEDIUM",
    },
    ORIGIN,
  );
  assert.deepEqual(
    { gridH: made.gridH, gridW: made.gridW, gridX: made.gridX, gridY: made.gridY },
    { gridH: 2, gridW: 4, gridX: null, gridY: null },
  );
  // Labels are unique at the outlet, whatever their case.
  assert.equal(
    await codeOf(() =>
      tables.create(
        TENANT,
        OUTLET,
        {
          areaId: first.areas[0]!.id,
          capacity: 2,
          label: "t1",
          shape: "ROUND",
          visualSize: "SMALL",
        },
        ORIGIN,
      ),
    ),
    "FLOOR_TABLE_LABEL_TAKEN",
  );
  assert.equal(
    await codeOf(() =>
      tables.create(
        TENANT,
        OUTLET,
        {
          areaId: first.areas[1]!.id,
          capacity: 2,
          label: "T2",
          shape: "ROUND",
          visualSize: "SMALL",
        },
        ORIGIN,
      ),
    ),
    "FLOOR_AREA_INACTIVE",
  );
  assert.equal(
    await codeOf(() =>
      tables.create(
        TENANT,
        OUTLET,
        { areaId: randomUUID(), capacity: 2, label: "T2", shape: "ROUND", visualSize: "SMALL" },
        ORIGIN,
      ),
    ),
    "FLOOR_AREA_NOT_FOUND",
  );
});

test("a saved layout takes footprints from the server, not the request", async () => {
  const { first, tables } = setup();
  const made = await tables.create(
    TENANT,
    OUTLET,
    {
      areaId: first.areas[0]!.id,
      capacity: 6,
      label: "T1",
      shape: "RECTANGLE",
      visualSize: "MEDIUM",
    },
    ORIGIN,
  );
  const saved = await tables.saveLayout(
    TENANT,
    OUTLET,
    first.id,
    [layoutOf(made, { gridX: 22, gridY: 0, rotation: 90 })],
    ORIGIN,
  );
  assert.deepEqual(
    { gridH: saved[0]!.gridH, gridW: saved[0]!.gridW, gridX: saved[0]!.gridX },
    { gridH: 4, gridW: 2, gridX: 22 },
  );
});

test("a layout with tables on each other or past the edge is refused whole", async () => {
  const { first, repository, tables } = setup();
  const area = first.areas[0]!.id;
  const one = await tables.create(
    TENANT,
    OUTLET,
    { areaId: area, capacity: 4, label: "T1", shape: "SQUARE", visualSize: "MEDIUM" },
    ORIGIN,
  );
  const two = await tables.create(
    TENANT,
    OUTLET,
    { areaId: area, capacity: 4, label: "T2", shape: "SQUARE", visualSize: "MEDIUM" },
    ORIGIN,
  );
  await tables.saveLayout(
    TENANT,
    OUTLET,
    first.id,
    [layoutOf(one, { gridX: 0, gridY: 0 })],
    ORIGIN,
  );

  assert.equal(
    await codeOf(() =>
      tables.saveLayout(TENANT, OUTLET, first.id, [layoutOf(two, { gridX: 2, gridY: 2 })], ORIGIN),
    ),
    "FLOOR_LAYOUT_INVALID",
  );
  assert.equal(
    await codeOf(() =>
      tables.saveLayout(TENANT, OUTLET, first.id, [layoutOf(two, { gridX: 22, gridY: 0 })], ORIGIN),
    ),
    "FLOOR_LAYOUT_INVALID",
  );
  assert.equal(repository.saves, 1);
  // Moving the first away in the same save makes room.
  await tables.saveLayout(
    TENANT,
    OUTLET,
    first.id,
    [layoutOf(one, { gridX: 10, gridY: 10 }), layoutOf(two, { gridX: 2, gridY: 2 })],
    ORIGIN,
  );
  assert.equal(repository.saves, 2);
});

test("a table is saved only on its own floor, under a label nobody else has", async () => {
  const { first, second, tables } = setup();
  const one = await tables.create(
    TENANT,
    OUTLET,
    { areaId: first.areas[0]!.id, capacity: 2, label: "T1", shape: "ROUND", visualSize: "SMALL" },
    ORIGIN,
  );
  await tables.create(
    TENANT,
    OUTLET,
    { areaId: second.areas[0]!.id, capacity: 2, label: "L2", shape: "ROUND", visualSize: "SMALL" },
    ORIGIN,
  );
  assert.equal(
    await codeOf(() => tables.saveLayout(TENANT, OUTLET, second.id, [layoutOf(one, {})], ORIGIN)),
    "FLOOR_TABLE_NOT_FOUND",
  );
  assert.equal(
    await codeOf(() =>
      tables.saveLayout(
        TENANT,
        OUTLET,
        first.id,
        [layoutOf(one, { areaId: second.areas[0]!.id })],
        ORIGIN,
      ),
    ),
    "FLOOR_AREA_NOT_FOUND",
  );
  assert.equal(
    await codeOf(() =>
      tables.saveLayout(TENANT, OUTLET, first.id, [layoutOf(one, { label: "l2" })], ORIGIN),
    ),
    "FLOOR_TABLE_LABEL_TAKEN",
  );
});

test("bringing tables back counts against the outlet's table limit", async () => {
  const asked: Array<[string, bigint | undefined, string | undefined]> = [];
  const { first, tables } = setup({
    assertCanAdd: async (_tenantId, dimensionKey, adding, scopeId) => {
      asked.push([dimensionKey, adding, scopeId]);
    },
  });
  const one = await tables.create(
    TENANT,
    OUTLET,
    { areaId: first.areas[0]!.id, capacity: 2, label: "T1", shape: "ROUND", visualSize: "SMALL" },
    ORIGIN,
  );
  await tables.saveLayout(
    TENANT,
    OUTLET,
    first.id,
    [layoutOf(one, { status: "INACTIVE" })],
    ORIGIN,
  );
  await tables.saveLayout(TENANT, OUTLET, first.id, [layoutOf(one, { status: "ACTIVE" })], ORIGIN);
  assert.deepEqual(asked, [
    ["floor.tables.active_per_location", 1n, OUTLET],
    ["floor.tables.active_per_location", 1n, OUTLET],
  ]);
});

test("a table with guests at it stays in service", async () => {
  const { first, repository, tables } = setup();
  const one = await tables.create(
    TENANT,
    OUTLET,
    { areaId: first.areas[0]!.id, capacity: 2, label: "T1", shape: "ROUND", visualSize: "SMALL" },
    ORIGIN,
  );
  repository.held.add(one.id);
  assert.equal(
    await codeOf(() =>
      tables.saveLayout(TENANT, OUTLET, first.id, [layoutOf(one, { status: "INACTIVE" })], ORIGIN),
    ),
    "FLOOR_TABLE_IN_USE",
  );
  // Moving it on the plan is fine: the guests stay where they are.
  await tables.saveLayout(
    TENANT,
    OUTLET,
    first.id,
    [layoutOf(one, { gridX: 3, gridY: 3 })],
    ORIGIN,
  );
});
