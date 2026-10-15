import type { FloorRecordStatus } from "@merchant/contracts";

import type { CommandOrigin } from "../../../shared/command/command-origin.js";

export type QrTokenRecord = {
  salt: string;
  status: "ACTIVE" | "EXPIRED" | "REVOKED" | "ROTATED";
  version: number;
};

export type NewQrToken = { salt: string; tokenHash: string };

/** What a guest's QR leads to; ids stay on this side. */
export type QrTarget = {
  brandName: string;
  outletActive: boolean;
  outletName: string;
  qrOrdering: boolean;
  tableActive: boolean;
  tableLabel: string;
  tenantId: string;
};

/**
 * Where QR tokens are kept. A table has at most one working token; the
 * database refuses a second, so two people generating at once get one QR.
 */
export interface TableQrRepository {
  /** The table, and its newest token whatever its state. */
  current(
    tenantId: string,
    outletId: string,
    tableId: string,
  ): Promise<{
    latest: QrTokenRecord | null;
    table: { label: string; status: FloorRecordStatus } | null;
  }>;
  /** A new working token with the next version; null when one already works. */
  create(
    tenantId: string,
    outletId: string,
    tableId: string,
    token: NewQrToken,
    origin: CommandOrigin,
  ): Promise<QrTokenRecord | null>;
  /** Replaces the working token; null when none works. */
  rotate(
    tenantId: string,
    outletId: string,
    tableId: string,
    token: NewQrToken,
    now: Date,
    origin: CommandOrigin,
  ): Promise<QrTokenRecord | null>;
  /** Stops the working token; null when none works. */
  revoke(
    tenantId: string,
    outletId: string,
    tableId: string,
    now: Date,
    origin: CommandOrigin,
  ): Promise<QrTokenRecord | null>;
  /** The table of a working token, found by its hash. */
  resolve(tokenHash: string): Promise<QrTarget | null>;
}

export const TABLE_QR_REPOSITORY = Symbol("TABLE_QR_REPOSITORY");

/** The server's secret that QR tokens are worked out with. */
export const TABLE_QR_SECRET = Symbol("TABLE_QR_SECRET");
