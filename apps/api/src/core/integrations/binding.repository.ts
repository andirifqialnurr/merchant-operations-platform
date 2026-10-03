import type {
  IntegrationBindingHealth,
  IntegrationBindingStatus,
  ModuleKey,
} from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { buildAuditMetadata, buildAuditPayload } from "../audit/public.js";
import { type CommandOrigin } from "../../shared/command/command-origin.js";

export type BindingMutationContext = CommandOrigin;

export type BindingRecord = {
  auditReason: string | null;
  configSchemaVersion: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  eventType: string;
  handlerKey: string;
  health: IntegrationBindingHealth;
  id: string;
  lastError: string | null;
  sourceModuleKey: ModuleKey;
  status: IntegrationBindingStatus;
  targetModuleKey: ModuleKey;
  tenantId: string;
  updatedAt: Date;
};

/** The pair of modules, the event, and the handler a binding connects. */
export type BindingKey = {
  eventType: string;
  handlerKey: string;
  sourceModuleKey: ModuleKey;
  targetModuleKey: ModuleKey;
};

export interface BindingRepository {
  /** Creates the binding as ACTIVE from `effectiveFrom`; does nothing if it exists. */
  createIfMissing(tenantId: string, key: BindingKey, effectiveFrom: Date): Promise<boolean>;
  find(tenantId: string, key: BindingKey): Promise<BindingRecord | null>;
  findById(tenantId: string, id: string): Promise<BindingRecord | null>;
  list(tenantId: string): Promise<BindingRecord[]>;
  listForTarget(tenantId: string, targetModuleKey: ModuleKey): Promise<BindingRecord[]>;
  /** Records how the last delivery went. Not audited: it is not a person's decision. */
  setHealth(id: string, health: IntegrationBindingHealth, lastError: string | null): Promise<void>;
  /** Changes the status if it is still `expected`; null when someone changed it first. */
  setStatus(
    tenantId: string,
    id: string,
    expected: IntegrationBindingStatus,
    change: {
      auditReason?: string | null;
      effectiveFrom?: Date;
      health?: IntegrationBindingHealth;
      lastError?: string | null;
      status: IntegrationBindingStatus;
    },
    options: { action: string; context?: BindingMutationContext },
  ): Promise<BindingRecord | null>;
}

export const BINDING_REPOSITORY = Symbol("BINDING_REPOSITORY");

const select = {
  auditReason: true,
  configSchemaVersion: true,
  effectiveFrom: true,
  effectiveTo: true,
  eventType: true,
  handlerKey: true,
  health: true,
  id: true,
  lastError: true,
  sourceModuleKey: true,
  status: true,
  targetModuleKey: true,
  tenantId: true,
  updatedAt: true,
} as const;

type Row = Omit<BindingRecord, "sourceModuleKey" | "targetModuleKey"> & {
  sourceModuleKey: string;
  targetModuleKey: string;
};

const toRecord = (row: Row): BindingRecord => ({
  ...row,
  sourceModuleKey: row.sourceModuleKey as ModuleKey,
  targetModuleKey: row.targetModuleKey as ModuleKey,
});

const uniqueKey = (tenantId: string, key: BindingKey) => ({
  tenantId_sourceModuleKey_eventType_targetModuleKey_handlerKey: { ...key, tenantId },
});

@Injectable()
export class PrismaBindingRepository implements BindingRepository {
  async createIfMissing(tenantId: string, key: BindingKey, effectiveFrom: Date) {
    const created = await getPrismaClient().coreIntegrationBinding.createMany({
      data: [{ ...key, effectiveFrom, status: "ACTIVE", tenantId }],
      skipDuplicates: true,
    });
    return created.count > 0;
  }

  async find(tenantId: string, key: BindingKey) {
    const row = await getPrismaClient().coreIntegrationBinding.findUnique({
      select,
      where: uniqueKey(tenantId, key),
    });
    return row ? toRecord(row) : null;
  }

  async findById(tenantId: string, id: string) {
    const row = await getPrismaClient().coreIntegrationBinding.findFirst({
      select,
      where: { id, tenantId },
    });
    return row ? toRecord(row) : null;
  }

  async list(tenantId: string) {
    const rows = await getPrismaClient().coreIntegrationBinding.findMany({
      orderBy: [{ targetModuleKey: "asc" }, { eventType: "asc" }, { handlerKey: "asc" }],
      select,
      where: { tenantId },
    });
    return rows.map(toRecord);
  }

  async listForTarget(tenantId: string, targetModuleKey: ModuleKey) {
    const rows = await getPrismaClient().coreIntegrationBinding.findMany({
      orderBy: { handlerKey: "asc" },
      select,
      where: { targetModuleKey, tenantId },
    });
    return rows.map(toRecord);
  }

  async setHealth(id: string, health: IntegrationBindingHealth, lastError: string | null) {
    await getPrismaClient().coreIntegrationBinding.updateMany({
      data: { health, lastError, updatedAt: new Date() },
      // Only write when something changes: this runs after every delivery.
      where: { id, OR: [{ health: { not: health } }, { lastError: { not: lastError } }] },
    });
  }

  async setStatus(
    tenantId: string,
    id: string,
    expected: IntegrationBindingStatus,
    change: {
      auditReason?: string | null;
      effectiveFrom?: Date;
      health?: IntegrationBindingHealth;
      lastError?: string | null;
      status: IntegrationBindingStatus;
    },
    options: { action: string; context?: BindingMutationContext },
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      const actor = options.context?.actorId ? { actorId: options.context.actorId } : {};
      const updated = await transaction.coreIntegrationBinding.updateMany({
        data: { ...change, ...actor, updatedAt: new Date() },
        where: { id, status: expected, tenantId },
      });
      if (updated.count === 0) return null;
      const row = toRecord(
        await transaction.coreIntegrationBinding.findUniqueOrThrow({ select, where: { id } }),
      );
      const payload = buildAuditPayload({
        after: { handlerKey: row.handlerKey, status: row.status },
        before: { handlerKey: row.handlerKey, status: expected },
        ...(change.auditReason ? { reason: change.auditReason } : {}),
      });
      await transaction.auditLog.create({
        data: {
          action: options.action,
          ...actor,
          entityId: id,
          entityType: "integration_binding",
          metadata: buildAuditMetadata(options.action, payload),
          ...(change.auditReason ? { reason: change.auditReason } : {}),
          ...(options.context?.requestId ? { requestId: options.context.requestId } : {}),
          tenantId,
        },
      });
      return row;
    });
  }
}
