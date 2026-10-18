import type { CommandOrigin } from "../../../shared/command/command-origin.js";

export type IntakeSourceRecord = {
  createdAt: Date;
  id: string;
  keyPrefix: string;
  label: string;
  lastUsedAt: Date | null;
  outletId: string;
  revokedAt: Date | null;
  secretHash: string;
  status: "ACTIVE" | "REVOKED";
  tenantId: string;
};

export type NewIntakeSource = {
  keyPrefix: string;
  label: string;
  outletId: string;
  secretHash: string;
};

/** Persistence reports a capacity conflict; the application maps it to the API reason. */
export class IntakeSourceLimitReached extends Error {
  constructor(
    readonly limit: bigint,
    readonly usage: bigint,
  ) {
    super("The intake source capacity was reached.");
  }
}

/** Where external intake sources are kept. Writes are audited by the store. */
export interface IntakeSourceRepository {
  countActive(tenantId: string): Promise<number>;
  create(
    tenantId: string,
    source: NewIntakeSource,
    origin: CommandOrigin,
    /** Rechecked under a workspace lock in the same transaction as create/audit. */
    maxActive?: bigint,
  ): Promise<IntakeSourceRecord>;
  /** The active source with this key prefix, in any workspace. */
  findActiveByPrefix(keyPrefix: string): Promise<IntakeSourceRecord | null>;
  findOutlet(tenantId: string, outletId: string): Promise<{ status: string } | null>;
  list(tenantId: string): Promise<IntakeSourceRecord[]>;
  /** Null when the source is not there or was already revoked. */
  revoke(
    tenantId: string,
    id: string,
    now: Date,
    origin: CommandOrigin,
  ): Promise<IntakeSourceRecord | null>;
  touch(id: string, now: Date): Promise<void>;
}

export const INTAKE_SOURCE_REPOSITORY = Symbol("INTAKE_SOURCE_REPOSITORY");
