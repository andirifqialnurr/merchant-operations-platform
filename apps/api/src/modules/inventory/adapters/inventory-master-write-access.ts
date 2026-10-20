import { MODULES, PERMISSIONS } from "@merchant/contracts";
import { Inject, Injectable } from "@nestjs/common";

import { AccessService } from "../../../core/memberships/public.js";
import {
  accessDenied,
  assertAccess,
  EntitlementService,
  evaluateAccess,
} from "../../../core/entitlements/public.js";
import type {
  InventoryMasterWriteAccess,
  InventoryWriteIdentity,
} from "../application/inventory-master-write-access.js";

@Injectable()
export class InventoryMasterWriteAuthorizer implements InventoryMasterWriteAccess {
  constructor(
    @Inject(AccessService) private readonly memberships: Pick<AccessService, "describeAccess">,
    @Inject(EntitlementService)
    private readonly entitlements: Pick<EntitlementService, "describeAccess">,
  ) {}

  async authorize(identity: InventoryWriteIdentity) {
    const access = await this.memberships.describeAccess(identity.userId, identity.tenantId);
    const current = access.context;
    if (
      !access.membershipActive ||
      !current ||
      current.membershipId !== identity.membershipId ||
      current.tenantId !== identity.tenantId ||
      current.userId !== identity.userId
    )
      throw accessDenied("WORKSPACE_ACCESS_DENIED");
    const entitlement = await this.entitlements.describeAccess(
      identity.tenantId,
      MODULES.inventoryBasic,
    );
    assertAccess(
      evaluateAccess(
        {
          allLocations: current.allOutlets && !identity.deviceId,
          membershipActive: true,
          permissionKeys: current.permissionKeys,
          subscriptionUsable: entitlement.subscriptionUsable,
          installation: entitlement.installation ?? "NOT_INSTALLED",
          capabilities: entitlement.capabilities,
          ...(entitlement.module ? { module: entitlement.module } : {}),
        },
        {
          moduleKey: MODULES.inventoryBasic,
          capability: "inventory.item.manage",
          permission: PERMISSIONS.inventoryMasterManage,
          allLocations: true,
        },
      ),
    );
    return { tenantId: current.tenantId, actorId: current.userId };
  }
}
