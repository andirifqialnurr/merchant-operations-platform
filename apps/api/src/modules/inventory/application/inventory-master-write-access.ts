import type { AuthorizationContext } from "@merchant/contracts";

export type InventoryWriteIdentity = Readonly<
  Pick<AuthorizationContext, "tenantId" | "userId" | "membershipId" | "deviceId">
>;
export type InventoryMasterWriteScope = Readonly<{ tenantId: string; actorId: string }>;

/** Fresh authorization; never a client-supplied role or allOutlets flag. */
export interface InventoryMasterWriteAccess {
  authorize(identity: InventoryWriteIdentity): Promise<InventoryMasterWriteScope>;
}
export const INVENTORY_MASTER_WRITE_ACCESS = Symbol("INVENTORY_MASTER_WRITE_ACCESS");
