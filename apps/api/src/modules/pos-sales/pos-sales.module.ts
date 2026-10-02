import { Module } from "@nestjs/common";

import { AccessModule } from "../../access/access.module.js";
import { AuthModule } from "../../auth/auth.module.js";
import { CatalogModule } from "../../catalog/catalog.module.js";
import { MenuController } from "./adapters/menu.controller.js";
import { PrismaRegisterSessionRepository } from "./adapters/prisma-register-session.repository.js";
import { ShiftController } from "./adapters/shift.controller.js";
import { REGISTER_SESSION_REPOSITORY } from "./application/register-session.repository.js";
import { ShiftService } from "./application/shift.service.js";

/** POS & Sales. Owns pos_register_sessions and pos_cash_movements. */
@Module({
  controllers: [MenuController, ShiftController],
  imports: [AccessModule, AuthModule, CatalogModule],
  providers: [
    ShiftService,
    PrismaRegisterSessionRepository,
    { provide: REGISTER_SESSION_REPOSITORY, useExisting: PrismaRegisterSessionRepository },
  ],
})
export class PosSalesModule {}
