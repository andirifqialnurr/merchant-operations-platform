import {
  floorAreaSchema,
  floorSchema,
  type CreateFloor,
  type CreateFloorArea,
  type UpdateFloor,
  type UpdateFloorArea,
} from "@merchant/contracts";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  type OnModuleInit,
} from "@nestjs/common";

import type { CommandOrigin } from "../../../shared/command/command-origin.js";
import {
  LIMIT_GATE,
  NO_LIMITS,
  USAGE_GAUGE_REGISTRY,
  type LimitGate,
  type UsageGaugeRegistry,
} from "../../../shared/limits/limit-gate.js";
import {
  FLOOR_STRUCTURE_REPOSITORY,
  FloorNameTakenError,
  type FloorAreaRecord,
  type FloorRecord,
  type FloorStructureRepository,
} from "./floor-structure.repository.js";

export const FLOOR_DIMENSIONS = {
  areas: "floor.areas.active_per_floor",
  floors: "floor.floors.active_per_location",
  tables: "floor.tables.active_per_location",
} as const;

const toFloor = (record: FloorRecord) => floorSchema.parse(record);

const toArea = (record: FloorAreaRecord) => floorAreaSchema.parse(record);

function conflict(code: string, message: string) {
  return new ConflictException({ code, message });
}

async function named<T>(write: () => Promise<T>, code: string) {
  try {
    return await write();
  } catch (error) {
    if (error instanceof FloorNameTakenError) {
      throw conflict(code, "This name is already used here.");
    }
    throw error;
  }
}

/**
 * The floors of an outlet and the areas on them. Nothing is deleted: a floor
 * or area is set aside instead, and only when no active table stands on it
 * and another active one remains, so staff always have somewhere to seat guests.
 */
@Injectable()
export class FloorStructure implements OnModuleInit {
  constructor(
    @Inject(FLOOR_STRUCTURE_REPOSITORY) private readonly floors: FloorStructureRepository,
    @Optional() @Inject(LIMIT_GATE) private readonly limits: LimitGate = NO_LIMITS,
    @Optional() @Inject(USAGE_GAUGE_REGISTRY) private readonly gauges?: UsageGaugeRegistry,
  ) {}

  onModuleInit() {
    for (const what of ["areas", "floors", "tables"] as const) {
      this.gauges?.register(FLOOR_DIMENSIONS[what], async (tenantId, scopeId) =>
        BigInt(await this.floors.countActive(tenantId, what, scopeId)),
      );
    }
  }

  async list(tenantId: string, outletId: string) {
    return (await this.floors.list(tenantId, outletId)).map(toFloor);
  }

  async createFloor(tenantId: string, outletId: string, input: CreateFloor, origin: CommandOrigin) {
    const outlet = await this.floors.findOutlet(tenantId, outletId);
    if (!outlet) {
      throw new NotFoundException({ code: "OUTLET_NOT_FOUND", message: "Outlet was not found." });
    }
    if (outlet.status !== "ACTIVE") throw conflict("OUTLET_INACTIVE", "Outlet is not active.");
    await this.limits.assertCanAdd(tenantId, FLOOR_DIMENSIONS.floors, 1n, outletId);
    return toFloor(
      await named(
        () => this.floors.createFloor(tenantId, outletId, input.name, origin),
        "FLOOR_NAME_TAKEN",
      ),
    );
  }

  async updateFloor(
    tenantId: string,
    outletId: string,
    floorId: string,
    change: UpdateFloor,
    origin: CommandOrigin,
  ) {
    const all = await this.floors.list(tenantId, outletId);
    const floor = all.find((item) => item.id === floorId);
    if (!floor) throw floorNotFound();
    if (change.status === "INACTIVE" && floor.status === "ACTIVE") {
      if (!all.some((item) => item.id !== floorId && item.status === "ACTIVE")) {
        throw conflict("FLOOR_LAST_ACTIVE", "An outlet keeps at least one active floor.");
      }
      if ((await this.floors.countActiveTables(tenantId, { floorId })) > 0) {
        throw conflict("FLOOR_HAS_TABLES", "Set aside or move the floor's tables first.");
      }
    }
    if (change.status === "ACTIVE" && floor.status === "INACTIVE") {
      await this.limits.assertCanAdd(tenantId, FLOOR_DIMENSIONS.floors, 1n, outletId);
    }
    return toFloor(
      await named(
        () => this.floors.updateFloor(tenantId, floor, change, origin),
        "FLOOR_NAME_TAKEN",
      ),
    );
  }

  async reorderFloors(
    tenantId: string,
    outletId: string,
    ids: readonly string[],
    origin: CommandOrigin,
  ) {
    const all = await this.floors.list(tenantId, outletId);
    assertSameItems(
      all.map((item) => item.id),
      ids,
    );
    await this.floors.reorderFloors(tenantId, outletId, ids, origin);
    return this.list(tenantId, outletId);
  }

  async createArea(
    tenantId: string,
    outletId: string,
    floorId: string,
    input: CreateFloorArea,
    origin: CommandOrigin,
  ) {
    const floor = (await this.floors.list(tenantId, outletId)).find((item) => item.id === floorId);
    if (!floor) throw floorNotFound();
    await this.limits.assertCanAdd(tenantId, FLOOR_DIMENSIONS.areas, 1n, floorId);
    return toArea(
      await named(
        () => this.floors.createArea(tenantId, floor, input.name, origin),
        "FLOOR_AREA_NAME_TAKEN",
      ),
    );
  }

  async updateArea(
    tenantId: string,
    outletId: string,
    areaId: string,
    change: UpdateFloorArea,
    origin: CommandOrigin,
  ) {
    const floor = (await this.floors.list(tenantId, outletId)).find((item) =>
      item.areas.some((area) => area.id === areaId),
    );
    const area = floor?.areas.find((item) => item.id === areaId);
    if (!floor || !area) {
      throw new NotFoundException({ code: "FLOOR_AREA_NOT_FOUND", message: "Area was not found." });
    }
    if (change.status === "INACTIVE" && area.status === "ACTIVE") {
      if (!floor.areas.some((item) => item.id !== areaId && item.status === "ACTIVE")) {
        throw conflict("FLOOR_AREA_LAST_ACTIVE", "A floor keeps at least one active area.");
      }
      if ((await this.floors.countActiveTables(tenantId, { areaId })) > 0) {
        throw conflict("FLOOR_AREA_HAS_TABLES", "Set aside or move the area's tables first.");
      }
    }
    if (change.status === "ACTIVE" && area.status === "INACTIVE") {
      await this.limits.assertCanAdd(tenantId, FLOOR_DIMENSIONS.areas, 1n, floor.id);
    }
    return toArea(
      await named(
        () => this.floors.updateArea(tenantId, area, outletId, change, origin),
        "FLOOR_AREA_NAME_TAKEN",
      ),
    );
  }

  async reorderAreas(
    tenantId: string,
    outletId: string,
    floorId: string,
    ids: readonly string[],
    origin: CommandOrigin,
  ) {
    const floor = (await this.floors.list(tenantId, outletId)).find((item) => item.id === floorId);
    if (!floor) throw floorNotFound();
    assertSameItems(
      floor.areas.map((item) => item.id),
      ids,
    );
    await this.floors.reorderAreas(tenantId, floor, ids, origin);
    return this.list(tenantId, outletId);
  }
}

function floorNotFound() {
  return new NotFoundException({ code: "FLOOR_NOT_FOUND", message: "Floor was not found." });
}

/** A new order names every item exactly once, and nothing else. */
function assertSameItems(existing: readonly string[], ordered: readonly string[]) {
  const known = new Set(existing);
  if (ordered.length !== existing.length || ordered.some((id) => !known.has(id))) {
    throw new BadRequestException({
      code: "FLOOR_ORDER_INCOMPLETE",
      message: "The new order must list every item once.",
    });
  }
}
