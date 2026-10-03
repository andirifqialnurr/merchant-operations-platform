import { Module } from "@nestjs/common";

import { ENTITLEMENT_REPOSITORY, PrismaEntitlementRepository } from "./entitlement.repository.js";
import { EntitlementService } from "./entitlement.service.js";

@Module({
  exports: [EntitlementService],
  providers: [
    EntitlementService,
    PrismaEntitlementRepository,
    { provide: ENTITLEMENT_REPOSITORY, useExisting: PrismaEntitlementRepository },
  ],
})
export class EntitlementModule {}
