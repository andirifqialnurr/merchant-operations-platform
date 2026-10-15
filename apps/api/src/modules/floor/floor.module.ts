import { Module } from "@nestjs/common";

import { AuthModule } from "../../core/auth/public.js";
import { AccessModule } from "../../core/memberships/public.js";
import { MeteringModule } from "../../core/metering/public.js";
import { BillingPaymentLedgerModule } from "../../kernels/billing-payment-ledger/public.js";
import { OrderIntakeModule } from "../../kernels/order-intake/public.js";
import { OrganizationModule } from "../../core/workspaces/public.js";
import { FloorStructureController } from "./adapters/floor-structure.controller.js";
import { FloorTableController } from "./adapters/floor-table.controller.js";
import { PrismaFloorStructureRepository } from "./adapters/prisma-floor-structure.repository.js";
import { PrismaFloorTableRepository } from "./adapters/prisma-floor-table.repository.js";
import { PrismaTableSessionRepository } from "./adapters/prisma-table-session.repository.js";
import { TableSessionController } from "./adapters/table-session.controller.js";
import { FloorStructure } from "./application/floor-structure.js";
import { FLOOR_STRUCTURE_REPOSITORY } from "./application/floor-structure.repository.js";
import { FLOOR_TABLE_REPOSITORY } from "./application/floor-table.repository.js";
import { FloorTables } from "./application/floor-tables.js";
import { TABLE_SESSION_REPOSITORY } from "./application/table-session.repository.js";
import { TableSessions } from "./application/table-sessions.js";

/**
 * Tables and self-order. Owns the floor_* tables. Uses the order and billing
 * kernels to see whether a visit is paid; orders and bills only hold the
 * session id as a reference. A new outlet gets its Main
 * Floor and Main Area from a database trigger, so the workspace core never
 * needs to know about this module.
 */
@Module({
  controllers: [FloorStructureController, FloorTableController, TableSessionController],
  // The kitchen's tickets name the table a visit sits at.
  exports: [TableSessions],
  imports: [
    AccessModule,
    AuthModule,
    BillingPaymentLedgerModule,
    MeteringModule,
    OrderIntakeModule,
    OrganizationModule,
  ],
  providers: [
    FloorStructure,
    PrismaFloorStructureRepository,
    { provide: FLOOR_STRUCTURE_REPOSITORY, useExisting: PrismaFloorStructureRepository },
    FloorTables,
    PrismaFloorTableRepository,
    { provide: FLOOR_TABLE_REPOSITORY, useExisting: PrismaFloorTableRepository },
    TableSessions,
    PrismaTableSessionRepository,
    { provide: TABLE_SESSION_REPOSITORY, useExisting: PrismaTableSessionRepository },
  ],
})
export class FloorModule {}
