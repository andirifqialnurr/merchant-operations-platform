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
  InventoryMasterReadAccess,
  InventoryReadIdentity,
} from "../application/inventory-master-read-access.js";

const READ_PERMISSIONS = [
  PERMISSIONS.inventoryReceive,
  PERMISSIONS.inventoryAdjust,
  PERMISSIONS.inventoryStocktake,
] as const;

/** Read shared definitions only. Operational permissions NEVER authorize master mutations. */
@Injectable()
export class InventoryMasterReadAuthorizer implements InventoryMasterReadAccess {
  constructor(
    @Inject(AccessService) private readonly memberships: Pick<AccessService, "describeAccess">,
    @Inject(EntitlementService)
    private readonly entitlements: Pick<EntitlementService, "describeAccess">,
  ) {}

  async authorize(identity: InventoryReadIdentity) {
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
    const permission =
      READ_PERMISSIONS.find((key) => current.permissionKeys.includes(key)) ??
      PERMISSIONS.inventoryReceive;
    assertAccess(
      evaluateAccess(
        {
          allLocations: current.allOutlets,
          membershipActive: true,
          permissionKeys: current.permissionKeys,
          subscriptionUsable: entitlement.subscriptionUsable,
          installation: entitlement.installation ?? "NOT_INSTALLED",
          capabilities: entitlement.capabilities,
          ...(entitlement.module ? { module: entitlement.module } : {}),
        },
        { moduleKey: MODULES.inventoryBasic, capability: "inventory.item.manage", permission },
      ),
    );
    // These workspace-shared definitions contain no outlet stock, costs or contacts.
    // Outlet-scoped staff may read them, but a POS/KDS device session may not.
    if (identity.deviceId) throw accessDenied("LOCATION_SCOPE_DENIED");
    return { tenantId: current.tenantId };
  }
}
