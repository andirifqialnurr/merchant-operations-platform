import type { FloorPolicy, FloorRecordStatus, TableSessionStatus } from "@merchant/contracts";
import type { ReadSnapshot } from "../../../shared/query/read-snapshot.js";

import type { ActorCommandOrigin, CommandOrigin } from "../../../shared/command/command-origin.js";
import type { FloorTableRecord } from "./floor-table.repository.js";

export type TableSessionRecord = {
  cleanedAt: Date | null;
  displayNumber: number;
  guestCount: number;
  id: string;
  needsCleaning: boolean;
  openedAt: Date;
  status: TableSessionStatus;
  /** The tables it holds now, the primary one first. */
  tableIds: string[];
};

/** A table with the session that holds it, if one does. */
export type HeldTable = FloorTableRecord & { holder: TableSessionRecord | null };

export type SeatableTable = {
  areaActive: boolean;
  floorActive: boolean;
  held: boolean;
  id: string;
  label: string;
  status: FloorRecordStatus;
};

/**
 * Where table sessions are kept. Opening a session on a table that another
 * session holds throws `TableTakenError`; the database decides, so two
 * cashiers seating the same table at once cannot both succeed.
 */
export interface TableSessionRepository {
  /** Lets go of a closed session's tables once they are cleaned. */
  clean(
    tenantId: string,
    outletId: string,
    tableId: string,
    now: Date,
    origin: CommandOrigin,
  ): Promise<TableSessionRecord | null>;
  close(
    tenantId: string,
    outletId: string,
    sessionId: string,
    change: { needsCleaning: boolean; now: Date },
    origin: ActorCommandOrigin,
    ensureSettled: () => Promise<void>,
  ): Promise<TableSessionRecord | null>;
  findSession(
    tenantId: string,
    outletId: string,
    sessionId: string,
    snapshot?: ReadSnapshot,
  ): Promise<TableSessionRecord | null>;
  findTable(tenantId: string, outletId: string, tableId: string): Promise<SeatableTable | null>;
  /** Every table of the outlet with its holder, and the sessions still holding tables. */
  live(tenantId: string, outletId: string): Promise<HeldTable[]>;
  /**
   * Moves a visit from its primary table to another. Null when the visit is
   * closed; `TableTakenError` when the other table was taken meanwhile.
   */
  move(
    tenantId: string,
    outletId: string,
    sessionId: string,
    toTableId: string,
    origin: ActorCommandOrigin,
  ): Promise<{ fromTableId: string | null; session: TableSessionRecord } | null>;
  /** Staff open a visit as themselves; guests from the QR open it with no user. */
  open(
    tenantId: string,
    outletId: string,
    seat: { guestCount: number; tableId: string },
    origin: CommandOrigin,
  ): Promise<TableSessionRecord>;
  /** The visit holding the table now, open, closing, or waiting to be cleaned. */
  holderOf(tenantId: string, outletId: string, tableId: string): Promise<TableSessionRecord | null>;
  policy(tenantId: string, outletId: string): Promise<FloorPolicy>;
  /** The label of the visit's primary table, the last one it had once closed. */
  primaryTableLabel(
    tenantId: string,
    outletId: string,
    sessionId: string,
    snapshot?: ReadSnapshot,
  ): Promise<string | null>;
  setPolicy(
    tenantId: string,
    outletId: string,
    policy: FloorPolicy,
    origin: CommandOrigin,
  ): Promise<FloorPolicy>;
}

export class TableTakenError extends Error {}

export const TABLE_SESSION_REPOSITORY = Symbol("TABLE_SESSION_REPOSITORY");
