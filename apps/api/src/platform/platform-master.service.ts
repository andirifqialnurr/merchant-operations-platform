import {
  platformTenantMasterSchema,
  type CreateTenant,
  type ModuleKey,
  type PlatformSetTenantEntitlement,
  type ReplaceSubscription,
  type UpdateTenant,
} from "@merchant/contracts";
import { Inject, Injectable } from "@nestjs/common";

import { EntitlementService } from "../entitlement/entitlement.service.js";
import { OrganizationService } from "../organization/organization.service.js";

export type PlatformMutationContext = { actorId: string; requestId?: string };

@Injectable()
export class PlatformMasterService {
  constructor(
    @Inject(OrganizationService) private readonly organizationService: OrganizationService,
    @Inject(EntitlementService) private readonly entitlementService: EntitlementService,
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

  replaceSubscription(
    tenantId: string,
    input: ReplaceSubscription,
    context: PlatformMutationContext,
  ) {
    return this.entitlementService.replaceSubscription(tenantId, input, context);
  }

  setEntitlement(
    tenantId: string,
    moduleKey: ModuleKey,
    input: PlatformSetTenantEntitlement,
    context: PlatformMutationContext,
  ) {
    return this.entitlementService.setEntitlement(tenantId, { ...input, moduleKey }, context);
  }
}
