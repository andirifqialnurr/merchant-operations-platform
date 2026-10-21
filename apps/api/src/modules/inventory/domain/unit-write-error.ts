export type InventoryUnitWriteCode =
  | "INVENTORY_UNIT_CODE_TAKEN"
  | "INVENTORY_UNIT_NOT_FOUND"
  | "INVENTORY_UNIT_DEFINITION_LOCKED"
  | "IDEMPOTENCY_KEY_REUSED"
  | "IDEMPOTENCY_IN_PROGRESS"
  | "IDEMPOTENCY_FAILED"
  | "IDEMPOTENCY_EXPIRED"
  | "IDEMPOTENCY_RESULT_UNAVAILABLE";

export class InventoryUnitWriteError extends Error {
  constructor(readonly code: InventoryUnitWriteCode) {
    super(code);
  }
}
