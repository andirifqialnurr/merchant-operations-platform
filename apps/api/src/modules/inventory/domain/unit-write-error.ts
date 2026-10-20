export type InventoryUnitWriteCode =
  | "INVENTORY_UNIT_CODE_TAKEN"
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
