import { Module } from "@nestjs/common";

import { EntitlementModule } from "../entitlement/entitlement.module.js";
import { OrganizationModule } from "../organization/organization.module.js";
import { PlatformAuthController } from "./platform-auth.controller.js";
import {
  PLATFORM_AUTH_REPOSITORY,
  PrismaPlatformAuthRepository,
} from "./platform-auth.repository.js";
import { PlatformAuthService } from "./platform-auth.service.js";
import { PlatformMasterController } from "./platform-master.controller.js";
import { PlatformMasterService } from "./platform-master.service.js";
import { PlatformPermissionGuard } from "./platform-permission.guard.js";

@Module({
  controllers: [PlatformAuthController, PlatformMasterController],
  exports: [PlatformAuthService, PlatformPermissionGuard],
  imports: [EntitlementModule, OrganizationModule],
  providers: [
    PlatformAuthService,
    PlatformMasterService,
    PlatformPermissionGuard,
    PrismaPlatformAuthRepository,
    { provide: PLATFORM_AUTH_REPOSITORY, useExisting: PrismaPlatformAuthRepository },
  ],
})
export class PlatformModule {}
