import type { CreateInventoryUnitConversion, InventoryUnitConversion } from "@merchant/contracts";

import type { ActorCommandOrigin } from "../../../shared/command/command-origin.js";
import type {
  InventoryMasterWriteScope,
  InventoryWriteIdentity,
} from "./inventory-master-write-access.js";

export type InventoryConversionWriteAttempt = Readonly<{
  idempotencyKey: string;
  origin: ActorCommandOrigin;
}>;
export type InventoryConversionCreateContext = InventoryConversionWriteAttempt & {
  identity: InventoryWriteIdentity;
};

/** Locks scoped parents, checks compatibility and commits definition/audit/replay atomically. */
export interface InventoryConversionWriter {
  create(
    scope: InventoryMasterWriteScope,
    input: CreateInventoryUnitConversion,
    attempt: InventoryConversionWriteAttempt,
  ): Promise<InventoryUnitConversion>;
}
export const INVENTORY_CONVERSION_WRITER = Symbol("INVENTORY_CONVERSION_WRITER");
