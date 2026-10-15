import type { FloorRecordStatus, FloorTableStatus, TableSessionStatus } from "@merchant/contracts";

/** The session a table is held by, if any: attached and not yet let go. */
export type HoldingSession = {
  cleanedAt: Date | null;
  needsCleaning: boolean;
  status: TableSessionStatus;
};

/**
 * Whether guests can sit at a table. It is never stored: it follows from the
 * table being set aside and from the session that holds it (M4-BE-03).
 */
export function tableStatus(
  table: { status: FloorRecordStatus },
  session: HoldingSession | null,
): FloorTableStatus {
  if (session) {
    if (session.status === "OPEN") return "OCCUPIED";
    if (session.status === "CLOSING") return "CLOSING";
    // Closed but still holding the table: it waits to be cleaned.
    if (session.needsCleaning && session.cleanedAt === null) return "CLEANING";
  }
  if (table.status === "INACTIVE") return "INACTIVE";
  return "AVAILABLE";
}
