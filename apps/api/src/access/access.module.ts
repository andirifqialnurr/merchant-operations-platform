import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { EntitlementModule } from "../entitlement/entitlement.module.js";
import { AccessController, AccessWorkspaceController } from "./access.controller.js";
import { ACCESS_REPOSITORY, PrismaAccessRepository } from "./access.repository.js";
import { AccessService } from "./access.service.js";
import { SessionPermissionGuard } from "./session-permission.guard.js";

@Module({
  controllers: [AccessController, AccessWorkspaceController],
  exports: [AccessService, EntitlementModule, SessionPermissionGuard],
  imports: [AuthModule, EntitlementModule],
  providers: [
    AccessService,
    SessionPermissionGuard,
    PrismaAccessRepository,
    { provide: ACCESS_REPOSITORY, useExisting: PrismaAccessRepository },
  ],
})
export class AccessModule {}
