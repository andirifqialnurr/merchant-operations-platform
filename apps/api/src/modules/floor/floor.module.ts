import { Module } from "@nestjs/common";

import { AuthModule } from "../../core/auth/public.js";
import { AccessModule } from "../../core/memberships/public.js";
import { MeteringModule } from "../../core/metering/public.js";
import { OrganizationModule } from "../../core/workspaces/public.js";
import { FloorStructureController } from "./adapters/floor-structure.controller.js";
import { PrismaFloorStructureRepository } from "./adapters/prisma-floor-structure.repository.js";
import { FloorStructure } from "./application/floor-structure.js";
import { FLOOR_STRUCTURE_REPOSITORY } from "./application/floor-structure.repository.js";

/**
 * Tables and self-order. Owns the floor_* tables. A new outlet gets its Main
 * Floor and Main Area from a database trigger, so the workspace core never
 * needs to know about this module.
 */
@Module({
  controllers: [FloorStructureController],
  imports: [AccessModule, AuthModule, MeteringModule, OrganizationModule],
  providers: [
    FloorStructure,
    PrismaFloorStructureRepository,
    { provide: FLOOR_STRUCTURE_REPOSITORY, useExisting: PrismaFloorStructureRepository },
  ],
})
export class FloorModule {}
