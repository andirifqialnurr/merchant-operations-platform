/** The order kernel does not own or query the Floor module's tables. */
export interface TableVisitSource {
  /** Called while the shared visit lock is held, so close cannot race it. */
  ensureOpen(tenantId: string, outletId: string, visitId: string): Promise<void>;
}

export const TABLE_VISIT_SOURCE = Symbol("TABLE_VISIT_SOURCE");
