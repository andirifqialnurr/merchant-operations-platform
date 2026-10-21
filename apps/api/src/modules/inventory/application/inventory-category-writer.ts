import type { CreateInventoryCategory, InventoryCategory } from "@merchant/contracts";

import type { ActorCommandOrigin } from "../../../shared/command/command-origin.js";
import type {
  InventoryMasterWriteScope,
  InventoryWriteIdentity,
} from "./inventory-master-write-access.js";

export type InventoryCategoryWriteAttempt = Readonly<{
  idempotencyKey: string;
  origin: ActorCommandOrigin;
}>;
export type InventoryCategoryCreateContext = InventoryCategoryWriteAttempt & {
  identity: InventoryWriteIdentity;
};

/** Commits a new ACTIVE category, critical audit and original non-secret replay in one transaction. */
export interface InventoryCategoryWriter {
  create(
    scope: InventoryMasterWriteScope,
    input: CreateInventoryCategory,
    attempt: InventoryCategoryWriteAttempt,
  ): Promise<InventoryCategory>;
}
export const INVENTORY_CATEGORY_WRITER = Symbol("INVENTORY_CATEGORY_WRITER");
