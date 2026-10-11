import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/public.js";
import { FeatureFlagModule } from "../feature-flags/public.js";
import { EntitlementModule } from "../entitlements/public.js";
import { SecurityModule } from "../security/public.js";
import { AccessController, AccessWorkspaceController } from "./access.controller.js";
import { ACCESS_REPOSITORY, PrismaAccessRepository } from "./access.repository.js";
import { AccessUsageGauges } from "./access.gauges.js";
import { AccessService } from "./access.service.js";
import { ApprovalPinController } from "./approval-pin.controller.js";
import { APPROVAL_PIN_REPOSITORY, PrismaApprovalPinRepository } from "./approval-pin.repository.js";
import { ApprovalPinService } from "./approval-pin.service.js";
import { InvitationAcceptController, InvitationController } from "./invitation.controller.js";
import { createInvitationDelivery, INVITATION_DELIVERY } from "./invitation-delivery.js";
import { INVITATION_REPOSITORY, PrismaInvitationRepository } from "./invitation.repository.js";
import { InvitationService } from "./invitation.service.js";
import { SessionPermissionGuard } from "./session-permission.guard.js";

@Module({
  controllers: [
    AccessController,
    AccessWorkspaceController,
    ApprovalPinController,
    InvitationController,
    InvitationAcceptController,
  ],
  exports: [
    AccessService,
    ApprovalPinService,
    EntitlementModule,
    FeatureFlagModule,
    SessionPermissionGuard,
  ],
  imports: [AuthModule, EntitlementModule, FeatureFlagModule, SecurityModule],
  providers: [
    AccessService,
    AccessUsageGauges,
    ApprovalPinService,
    PrismaApprovalPinRepository,
    { provide: APPROVAL_PIN_REPOSITORY, useExisting: PrismaApprovalPinRepository },
    SessionPermissionGuard,
    PrismaAccessRepository,
    { provide: ACCESS_REPOSITORY, useExisting: PrismaAccessRepository },
    InvitationService,
    PrismaInvitationRepository,
    { provide: INVITATION_REPOSITORY, useExisting: PrismaInvitationRepository },
    { provide: INVITATION_DELIVERY, useFactory: () => createInvitationDelivery() },
  ],
})
export class AccessModule {}
