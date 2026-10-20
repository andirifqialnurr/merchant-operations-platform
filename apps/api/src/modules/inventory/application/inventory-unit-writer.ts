import type { CreateInventoryUnit, InventoryUnit } from "@merchant/contracts";

import type { ActorCommandOrigin } from "../../../shared/command/command-origin.js";
import type {
  InventoryMasterWriteScope,
  InventoryWriteIdentity,
} from "./inventory-master-write-access.js";

export type InventoryUnitWriteAttempt = Readonly<{
  idempotencyKey: string;
  origin: ActorCommandOrigin;
}>;
export type InventoryUnitCreateContext = InventoryUnitWriteAttempt & {
  identity: InventoryWriteIdentity;
};

/** Atomically commits the unit, critical audit and validated non-secret replay result. */
export interface InventoryUnitWriter {
  create(
    scope: InventoryMasterWriteScope,
    input: CreateInventoryUnit,
    attempt: InventoryUnitWriteAttempt,
  ): Promise<InventoryUnit>;
}
export const INVENTORY_UNIT_WRITER = Symbol("INVENTORY_UNIT_WRITER");
