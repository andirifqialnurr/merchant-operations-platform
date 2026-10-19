import { Module } from "@nestjs/common";

import { AuthModule } from "../../core/auth/public.js";
import { AccessModule } from "../../core/memberships/public.js";
import { MeteringModule } from "../../core/metering/public.js";
import { BillingPaymentLedgerModule } from "../../kernels/billing-payment-ledger/public.js";
import { CatalogModule } from "../../kernels/catalog/public.js";
import { OrderIntakeModule } from "../../kernels/order-intake/public.js";
import { OrganizationModule } from "../../core/workspaces/public.js";
import { FloorStructureController } from "./adapters/floor-structure.controller.js";
import { GuestOrderModerationController } from "./adapters/guest-order-moderation.controller.js";
import { FloorTableController } from "./adapters/floor-table.controller.js";
import { PrismaFloorStructureRepository } from "./adapters/prisma-floor-structure.repository.js";
import { PrismaFloorTableRepository } from "./adapters/prisma-floor-table.repository.js";
import { PrismaServiceRequestRepository } from "./adapters/prisma-service-request.repository.js";
import { PrismaTableQrRepository } from "./adapters/prisma-table-qr.repository.js";
import { PrismaTableSessionRepository } from "./adapters/prisma-table-session.repository.js";
import { PublicTableQrController, TableQrController } from "./adapters/table-qr.controller.js";
import { TableSessionController } from "./adapters/table-session.controller.js";
import { FloorStructure } from "./application/floor-structure.js";
import { FLOOR_STRUCTURE_REPOSITORY } from "./application/floor-structure.repository.js";
import { FLOOR_TABLE_REPOSITORY } from "./application/floor-table.repository.js";
import { FloorTables } from "./application/floor-tables.js";
import { GuestOrdering } from "./application/guest-ordering.js";
import { SERVICE_REQUEST_REPOSITORY } from "./application/service-request.repository.js";
import { TableQrCodes } from "./application/table-qr-codes.js";
import { TABLE_QR_REPOSITORY, TABLE_QR_SECRET } from "./application/table-qr.repository.js";
import { TABLE_SESSION_REPOSITORY } from "./application/table-session.repository.js";
import { TableVisitGuard } from "./application/table-visit-guard.js";
import { TableSessions } from "./application/table-sessions.js";

/**
 * The secret table QR tokens are worked out with. Production must set it;
 * changing it makes every printed QR stop working.
 */
export function tableQrSecret(environment: NodeJS.ProcessEnv = process.env) {
  const secret = environment.TABLE_QR_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (environment.NODE_ENV === "production") {
    throw new Error("TABLE_QR_SECRET must be set to at least 32 characters in production.");
  }
  return "local-development-table-qr-secret-not-for-production";
}

/**
 * Tables and self-order. Owns the floor_* tables. Uses the order and billing
 * kernels to see whether a visit is paid; orders and bills only hold the
 * session id as a reference. A new outlet gets its Main
 * Floor and Main Area from a database trigger, so the workspace core never
 * needs to know about this module.
 */
@Module({
  controllers: [
    GuestOrderModerationController,
    FloorStructureController,
    FloorTableController,
    PublicTableQrController,
    TableQrController,
    TableSessionController,
  ],
  // The kitchen's tickets name the table a visit sits at.
  exports: [TableSessions, TableVisitGuard],
  imports: [
    AccessModule,
    AuthModule,
    BillingPaymentLedgerModule,
    CatalogModule,
    MeteringModule,
    OrderIntakeModule,
    OrganizationModule,
  ],
  providers: [
    TableVisitGuard,
    FloorStructure,
    PrismaFloorStructureRepository,
    { provide: FLOOR_STRUCTURE_REPOSITORY, useExisting: PrismaFloorStructureRepository },
    FloorTables,
    PrismaFloorTableRepository,
    { provide: FLOOR_TABLE_REPOSITORY, useExisting: PrismaFloorTableRepository },
    TableSessions,
    PrismaTableSessionRepository,
    { provide: TABLE_SESSION_REPOSITORY, useExisting: PrismaTableSessionRepository },
    PrismaServiceRequestRepository,
    { provide: SERVICE_REQUEST_REPOSITORY, useExisting: PrismaServiceRequestRepository },
    TableQrCodes,
    GuestOrdering,
    PrismaTableQrRepository,
    { provide: TABLE_QR_REPOSITORY, useExisting: PrismaTableQrRepository },
    { provide: TABLE_QR_SECRET, useFactory: tableQrSecret },
  ],
})
export class FloorModule {}
