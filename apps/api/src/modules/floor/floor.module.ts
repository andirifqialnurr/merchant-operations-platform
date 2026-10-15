import { Module } from "@nestjs/common";

import { AuthModule } from "../../core/auth/public.js";
import { AccessModule } from "../../core/memberships/public.js";
import { MeteringModule } from "../../core/metering/public.js";
import { OrganizationModule } from "../../core/workspaces/public.js";
import { FloorStructureController } from "./adapters/floor-structure.controller.js";
import { FloorTableController } from "./adapters/floor-table.controller.js";
import { PrismaFloorStructureRepository } from "./adapters/prisma-floor-structure.repository.js";
import { PrismaFloorTableRepository } from "./adapters/prisma-floor-table.repository.js";
import { FloorStructure } from "./application/floor-structure.js";
import { FLOOR_STRUCTURE_REPOSITORY } from "./application/floor-structure.repository.js";
import { FLOOR_TABLE_REPOSITORY } from "./application/floor-table.repository.js";
import { FloorTables } from "./application/floor-tables.js";

/**
 * Tables and self-order. Owns the floor_* tables. A new outlet gets its Main
 * Floor and Main Area from a database trigger, so the workspace core never
 * needs to know about this module.
 */
@Module({
  controllers: [FloorStructureController, FloorTableController],
  imports: [AccessModule, AuthModule, MeteringModule, OrganizationModule],
  providers: [
    FloorStructure,
    PrismaFloorStructureRepository,
    { provide: FLOOR_STRUCTURE_REPOSITORY, useExisting: PrismaFloorStructureRepository },
    FloorTables,
    PrismaFloorTableRepository,
    { provide: FLOOR_TABLE_REPOSITORY, useExisting: PrismaFloorTableRepository },
  ],
})
export class FloorModule {}
