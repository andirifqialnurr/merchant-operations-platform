import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { LimitGate } from "../../../shared/limits/limit-gate.js";
import { FloorStructure } from "./floor-structure.js";
import {
  FloorNameTakenError,
  type FloorAreaRecord,
  type FloorChange,
  type FloorRecord,
  type FloorStructureRepository,
} from "./floor-structure.repository.js";

const TENANT = "019f8801-d536-746c-8e81-30b8937cef6c";
const OUTLET = "019f8801-d56e-7b2d-b124-b67f253a9b1d";
const ORIGIN = {};

/** Keeps floors in memory; tables are only counted. */
class MemoryFloors implements FloorStructureRepository {
  floors: FloorRecord[] = [];
  tables: Array<{ areaId: string; floorId: string }> = [];

  constructor() {
    this.addFloor("Main Floor");
  }

  addFloor(name: string) {
    const id = randomUUID();
    const floor: FloorRecord = {
      areas: [
        { displayOrder: 0, floorId: id, id: randomUUID(), name: "Main Area", status: "ACTIVE" },
      ],
      displayOrder: this.floors.length,
      gridCols: 24,
      gridRows: 16,
      id,
      name,
      outletId: OUTLET,
      status: "ACTIVE",
    };
    this.floors.push(floor);
    return floor;
  }

  async countActive(_tenantId: string, what: "areas" | "floors" | "tables", scopeId?: string) {
    if (what === "floors") return this.floors.filter((item) => item.status === "ACTIVE").length;
    if (what === "areas") {
      const floor = this.floors.find((item) => item.id === scopeId);
      return floor?.areas.filter((item) => item.status === "ACTIVE").length ?? 0;
    }
    return this.tables.length;
  }

  async countActiveTables(_tenantId: string, scope: { areaId: string } | { floorId: string }) {
    return this.tables.filter((table) =>
      "areaId" in scope ? table.areaId === scope.areaId : table.floorId === scope.floorId,
    ).length;
  }

  async createFloor(_tenantId: string, _outletId: string, name: string) {
    if (this.floors.some((item) => item.name === name)) throw new FloorNameTakenError();
    return this.addFloor(name);
  }

  async createArea(_tenantId: string, given: FloorRecord, name: string) {
    const floor = this.floors.find((item) => item.id === given.id)!;
    if (floor.areas.some((item) => item.name === name)) throw new FloorNameTakenError();
    const area: FloorAreaRecord = {
      displayOrder: floor.areas.length,
      floorId: floor.id,
      id: randomUUID(),
      name,
      status: "ACTIVE",
    };
    floor.areas.push(area);
    return area;
  }

  async findOutlet() {
    return { status: "ACTIVE" };
  }

  async list() {
    return structuredClone(
      [...this.floors].sort((left, right) => left.displayOrder - right.displayOrder),
    );
  }

  async reorderAreas(_tenantId: string, floor: FloorRecord, ids: readonly string[]) {
    const stored = this.floors.find((item) => item.id === floor.id)!;
    for (const area of stored.areas) area.displayOrder = ids.indexOf(area.id);
  }

  async reorderFloors(_tenantId: string, _outletId: string, ids: readonly string[]) {
    for (const floor of this.floors) floor.displayOrder = ids.indexOf(floor.id);
  }

  async updateArea(
    _tenantId: string,
    area: FloorAreaRecord,
    _outletId: string,
    change: FloorChange,
  ) {
    const stored = this.floors.flatMap((item) => item.areas).find((item) => item.id === area.id)!;
    Object.assign(stored, change);
    return stored;
  }

  async updateFloor(_tenantId: string, floor: FloorRecord, change: FloorChange) {
    const stored = this.floors.find((item) => item.id === floor.id)!;
    if (
      change.name &&
      this.floors.some((item) => item.id !== floor.id && item.name === change.name)
    ) {
      throw new FloorNameTakenError();
    }
    Object.assign(stored, change);
    return stored;
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
  const floors = new MemoryFloors();
  return { floors, structure: new FloorStructure(floors, limits) };
}

test("a new floor comes with a Main Area and goes after the others", async () => {
  const { structure } = setup();
  const floor = await structure.createFloor(TENANT, OUTLET, { name: "Lantai 2" }, ORIGIN);
  assert.deepEqual(
    floor.areas.map((area) => area.name),
    ["Main Area"],
  );
  assert.deepEqual(
    (await structure.list(TENANT, OUTLET)).map((item) => item.name),
    ["Main Floor", "Lantai 2"],
  );
  assert.equal(
    await codeOf(() => structure.createFloor(TENANT, OUTLET, { name: "Lantai 2" }, ORIGIN)),
    "FLOOR_NAME_TAKEN",
  );
});

test("the last active floor and a floor with tables cannot be set aside", async () => {
  const { floors, structure } = setup();
  const [main] = floors.floors;
  assert.equal(
    await codeOf(() =>
      structure.updateFloor(TENANT, OUTLET, main!.id, { status: "INACTIVE" }, ORIGIN),
    ),
    "FLOOR_LAST_ACTIVE",
  );
  const terrace = await structure.createFloor(TENANT, OUTLET, { name: "Teras" }, ORIGIN);
  floors.tables.push({ areaId: terrace.areas[0]!.id, floorId: terrace.id });
  assert.equal(
    await codeOf(() =>
      structure.updateFloor(TENANT, OUTLET, terrace.id, { status: "INACTIVE" }, ORIGIN),
    ),
    "FLOOR_HAS_TABLES",
  );
  const away = await structure.updateFloor(
    TENANT,
    OUTLET,
    main!.id,
    { status: "INACTIVE" },
    ORIGIN,
  );
  assert.equal(away.status, "INACTIVE");
});

test("areas are added, renamed, reordered, and set aside under the same rules", async () => {
  const { floors, structure } = setup();
  const floor = floors.floors[0]!;
  const main = floor.areas[0]!;
  const terrace = await structure.createArea(TENANT, OUTLET, floor.id, { name: "Teras" }, ORIGIN);
  assert.equal(
    await codeOf(() => structure.createArea(TENANT, OUTLET, floor.id, { name: "Teras" }, ORIGIN)),
    "FLOOR_AREA_NAME_TAKEN",
  );
  const renamed = await structure.updateArea(
    TENANT,
    OUTLET,
    terrace.id,
    { name: "Teras luar" },
    ORIGIN,
  );
  assert.equal(renamed.name, "Teras luar");

  const reordered = await structure.reorderAreas(
    TENANT,
    OUTLET,
    floor.id,
    [terrace.id, main.id],
    ORIGIN,
  );
  assert.deepEqual(
    [...reordered[0]!.areas].sort((a, b) => a.displayOrder - b.displayOrder).map((a) => a.name),
    ["Teras luar", "Main Area"],
  );
  assert.equal(
    await codeOf(() => structure.reorderAreas(TENANT, OUTLET, floor.id, [terrace.id], ORIGIN)),
    "FLOOR_ORDER_INCOMPLETE",
  );

  floors.tables.push({ areaId: main.id, floorId: floor.id });
  assert.equal(
    await codeOf(() =>
      structure.updateArea(TENANT, OUTLET, main.id, { status: "INACTIVE" }, ORIGIN),
    ),
    "FLOOR_AREA_HAS_TABLES",
  );
  await structure.updateArea(TENANT, OUTLET, terrace.id, { status: "INACTIVE" }, ORIGIN);
  floors.tables = [];
  assert.equal(
    await codeOf(() =>
      structure.updateArea(TENANT, OUTLET, main.id, { status: "INACTIVE" }, ORIGIN),
    ),
    "FLOOR_AREA_LAST_ACTIVE",
  );
});

test("package limits are asked per outlet for floors and per floor for areas", async () => {
  const asked: Array<[string, string | undefined]> = [];
  const { floors, structure } = setup({
    assertCanAdd: async (_tenantId, dimensionKey, _adding, scopeId) => {
      asked.push([dimensionKey, scopeId]);
    },
  });
  const floor = floors.floors[0]!;
  await structure.createFloor(TENANT, OUTLET, { name: "Lantai 2" }, ORIGIN);
  await structure.createArea(TENANT, OUTLET, floor.id, { name: "Teras" }, ORIGIN);
  const second = await structure.createFloor(TENANT, OUTLET, { name: "Rooftop" }, ORIGIN);
  await structure.updateFloor(TENANT, OUTLET, second.id, { status: "INACTIVE" }, ORIGIN);
  await structure.updateFloor(TENANT, OUTLET, second.id, { status: "ACTIVE" }, ORIGIN);
  assert.deepEqual(asked, [
    ["floor.floors.active_per_location", OUTLET],
    ["floor.areas.active_per_floor", floor.id],
    ["floor.floors.active_per_location", OUTLET],
    ["floor.floors.active_per_location", OUTLET],
  ]);
});
