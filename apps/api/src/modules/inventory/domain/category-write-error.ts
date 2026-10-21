export type InventoryCategoryWriteCode =
  | "INVENTORY_CATEGORY_NAME_TAKEN"
  | "INVENTORY_CATEGORY_NOT_FOUND"
  | "IDEMPOTENCY_KEY_REUSED"
  | "IDEMPOTENCY_IN_PROGRESS"
  | "IDEMPOTENCY_FAILED"
  | "IDEMPOTENCY_EXPIRED"
  | "IDEMPOTENCY_RESULT_UNAVAILABLE";

export class InventoryCategoryWriteError extends Error {
  constructor(readonly code: InventoryCategoryWriteCode) {
    super(code);
  }
}
