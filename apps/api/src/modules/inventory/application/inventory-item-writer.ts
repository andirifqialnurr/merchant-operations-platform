import type { CreateInventoryItem, InventoryItem } from "@merchant/contracts";

import type { ActorCommandOrigin } from "../../../shared/command/command-origin.js";
import type {
  InventoryMasterWriteScope,
  InventoryWriteIdentity,
} from "./inventory-master-write-access.js";

export type InventoryItemWriteAttempt = Readonly<{
  idempotencyKey: string;
  origin: ActorCommandOrigin;
}>;
export type InventoryItemCreateContext = InventoryItemWriteAttempt & {
  identity: InventoryWriteIdentity;
};

/** ACTIVE item/latch/audit/original result/key together, guarded by scoped parents and hard count. */
export interface InventoryItemWriter {
  create(
    scope: InventoryMasterWriteScope,
    input: CreateInventoryItem,
    attempt: InventoryItemWriteAttempt,
  ): Promise<InventoryItem>;
}
export const INVENTORY_ITEM_WRITER = Symbol("INVENTORY_ITEM_WRITER");
