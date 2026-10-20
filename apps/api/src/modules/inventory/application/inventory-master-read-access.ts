import type { AuthorizationContext } from "@merchant/contracts";

import type { InventoryMasterScope } from "./inventory-master-reader.js";

/** Adapter-supplied session identity, NOT query/body input. Cached roles are not trusted. */
export type InventoryReadIdentity = Readonly<
  Pick<AuthorizationContext, "tenantId" | "userId" | "membershipId" | "deviceId">
>;

export interface InventoryMasterReadAccess {
  authorize(identity: InventoryReadIdentity): Promise<InventoryMasterScope>;
}

export const INVENTORY_MASTER_READ_ACCESS = Symbol("INVENTORY_MASTER_READ_ACCESS");
