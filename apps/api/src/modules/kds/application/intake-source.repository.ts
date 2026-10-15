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

/** Where external intake sources are kept. Writes are audited by the store. */
export interface IntakeSourceRepository {
  countActive(tenantId: string): Promise<number>;
  create(
    tenantId: string,
    source: NewIntakeSource,
    origin: CommandOrigin,
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
