import { Global, Module } from "@nestjs/common";

import {
  LIMIT_GATE,
  USAGE_GAUGE_REGISTRY,
  UsageGaugeRegistry,
} from "../../shared/limits/limit-gate.js";
import { AuthModule } from "../auth/public.js";
import { EntitlementModule } from "../entitlements/public.js";
import { AccessModule } from "../memberships/public.js";
import { MeteringController } from "./metering.controller.js";
import { METERING_REPOSITORY, PrismaMeteringRepository } from "./metering.repository.js";
import { MeteringService } from "./metering.service.js";
import { PosSalesUsageHandler } from "./pos-sales-usage.handler.js";

/**
 * Global so that the owners of limited data (catalog, workspaces, memberships)
 * can ask the limit gate and report their counts through the tokens in
 * `shared/limits` without importing this unit.
 */
@Global()
@Module({
  controllers: [MeteringController],
  exports: [MeteringService, LIMIT_GATE, USAGE_GAUGE_REGISTRY],
  imports: [AccessModule, AuthModule, EntitlementModule],
  providers: [
    MeteringService,
    PosSalesUsageHandler,
    PrismaMeteringRepository,
    { provide: METERING_REPOSITORY, useExisting: PrismaMeteringRepository },
    { provide: LIMIT_GATE, useExisting: MeteringService },
    { provide: USAGE_GAUGE_REGISTRY, useFactory: () => new UsageGaugeRegistry() },
  ],
})
export class MeteringModule {}
