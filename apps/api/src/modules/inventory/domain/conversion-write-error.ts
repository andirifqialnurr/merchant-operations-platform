export type InventoryConversionWriteCode =
  | "INVENTORY_UNIT_NOT_FOUND"
  | "INVENTORY_UNIT_DIMENSIONS_INCOMPATIBLE"
  | "INVENTORY_CONVERSION_PAIR_TAKEN"
  | "IDEMPOTENCY_KEY_REUSED"
  | "IDEMPOTENCY_IN_PROGRESS"
  | "IDEMPOTENCY_FAILED"
  | "IDEMPOTENCY_EXPIRED"
  | "IDEMPOTENCY_RESULT_UNAVAILABLE";

export class InventoryConversionWriteError extends Error {
  constructor(readonly code: InventoryConversionWriteCode) {
    super(code);
  }
}
