import {
  platformTenantMasterSchema,
  type CreateTenant,
  type ModuleKey,
  type PlatformSetTenantEntitlement,
  type ReplaceSubscription,
  type UpdateTenant,
} from "@merchant/contracts";
import { Inject, Injectable } from "@nestjs/common";

import { EntitlementService } from "../entitlements/public.js";
import { InstallationService } from "../installations/public.js";
import { OrganizationService } from "../workspaces/public.js";

export type PlatformMutationContext = { actorId: string; requestId?: string };

@Injectable()
export class PlatformMasterService {
  constructor(
    @Inject(OrganizationService) private readonly organizationService: OrganizationService,
    @Inject(EntitlementService) private readonly entitlementService: EntitlementService,
    @Inject(InstallationService) private readonly installationService: InstallationService,
  ) {}

  createTenant(input: CreateTenant, context: PlatformMutationContext) {
    return this.organizationService.createTenant(input, context);
  }

  updateTenant(tenantId: string, input: UpdateTenant, context: PlatformMutationContext) {
    return this.organizationService.updateTenant(tenantId, input, context);
  }

  async getTenant(tenantId: string) {
    const [organization, entitlement] = await Promise.all([
      this.organizationService.getSnapshot(tenantId),
      this.entitlementService.getSnapshot(tenantId),
    ]);
    return platformTenantMasterSchema.parse({ entitlement, organization });
  }

  /** A new subscription comes with its modules installed, so the workspace can start working. */
  async replaceSubscription(
    tenantId: string,
    input: ReplaceSubscription,
    context: PlatformMutationContext,
  ) {
    const snapshot = await this.entitlementService.replaceSubscription(tenantId, input, context);
    await this.installationService.provisionEntitled(tenantId, context);
    return snapshot;
  }

  /** A module switched on for a tenant is installed in the same step. */
  async setEntitlement(
    tenantId: string,
    moduleKey: ModuleKey,
    input: PlatformSetTenantEntitlement,
    context: PlatformMutationContext,
  ) {
    const snapshot = await this.entitlementService.setEntitlement(
      tenantId,
      { ...input, moduleKey },
      context,
    );
    if (input.enabled) await this.installationService.provisionEntitled(tenantId, context);
    return snapshot;
  }
}
