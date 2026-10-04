import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/public.js";
import { EntitlementModule } from "../entitlements/public.js";
import { AccessModule } from "../memberships/public.js";
import { MeteringController } from "./metering.controller.js";
import { METERING_REPOSITORY, PrismaMeteringRepository } from "./metering.repository.js";
import { MeteringService, USAGE_GAUGE_REGISTRY, UsageGaugeRegistry } from "./metering.service.js";

@Module({
  controllers: [MeteringController],
  exports: [MeteringService, USAGE_GAUGE_REGISTRY],
  imports: [AccessModule, AuthModule, EntitlementModule],
  providers: [
    MeteringService,
    PrismaMeteringRepository,
    { provide: METERING_REPOSITORY, useExisting: PrismaMeteringRepository },
    { provide: USAGE_GAUGE_REGISTRY, useValue: new UsageGaugeRegistry() },
  ],
})
export class MeteringModule {}
