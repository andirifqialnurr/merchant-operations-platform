import type { ModuleInstallationStatus, ModuleKey } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { buildAuditMetadata, buildAuditPayload } from "../audit/public.js";
import { eventOrigin, type CommandOrigin } from "../../shared/command/command-origin.js";
import { safeEventPayload } from "../../shared/command/event-payload.js";

export type InstallationMutationContext = CommandOrigin;

export type InstallationRecord = {
  activatedAt: Date | null;
  configSchemaVersion: number;
  errorMessage: string | null;
  id: string;
  moduleKey: ModuleKey;
  provisionedAt: Date | null;
  setupRequiredReason: string | null;
  status: ModuleInstallationStatus;
  suspendedReason: string | null;
  tenantId: string;
  updatedAt: Date;
};

/** The facts that go with a status change. Anything left out keeps its value. */
export type InstallationChange = {
  activatedAt?: Date | null;
  configSchemaVersion?: number;
  errorMessage?: string | null;
  provisionedAt?: Date | null;
  setupRequiredReason?: string | null;
  status: ModuleInstallationStatus;
  suspendedReason?: string | null;
};

/** What is announced to other modules together with the change, if anything. */
export type InstallationEvent = { type: "module.installed.v1" };

export interface InstallationRepository {
  find(tenantId: string, moduleKey: ModuleKey): Promise<InstallationRecord | null>;
  list(tenantId: string): Promise<InstallationRecord[]>;
  /**
   * Creates the installation or moves it to the new status, but only if its
   * status is still `expected` (null: it must not exist yet). Returns null
   * when someone else changed it first.
   */
  save(
    tenantId: string,
    moduleKey: ModuleKey,
    expected: ModuleInstallationStatus | null,
    change: InstallationChange,
    options: { action: string; context?: InstallationMutationContext; event?: InstallationEvent },
  ): Promise<InstallationRecord | null>;
}

export const INSTALLATION_REPOSITORY = Symbol("INSTALLATION_REPOSITORY");

const select = {
  activatedAt: true,
  configSchemaVersion: true,
  errorMessage: true,
  id: true,
  moduleKey: true,
  provisionedAt: true,
  setupRequiredReason: true,
  status: true,
  suspendedReason: true,
  tenantId: true,
  updatedAt: true,
} as const;

const toRecord = (row: Omit<InstallationRecord, "moduleKey"> & { moduleKey: string }) =>
  ({ ...row, moduleKey: row.moduleKey as ModuleKey }) satisfies InstallationRecord;

@Injectable()
export class PrismaInstallationRepository implements InstallationRepository {
  async find(tenantId: string, moduleKey: ModuleKey) {
    const row = await getPrismaClient().coreModuleInstallation.findUnique({
      select,
      where: { tenantId_moduleKey: { moduleKey, tenantId } },
    });
    return row ? toRecord(row) : null;
  }

  async list(tenantId: string) {
    const rows = await getPrismaClient().coreModuleInstallation.findMany({
      orderBy: { moduleKey: "asc" },
      select,
      where: { tenantId },
    });
    return rows.map(toRecord);
  }

  async save(
    tenantId: string,
    moduleKey: ModuleKey,
    expected: ModuleInstallationStatus | null,
    change: InstallationChange,
    options: { action: string; context?: InstallationMutationContext; event?: InstallationEvent },
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      const actor = options.context?.actorId ? { actorId: options.context.actorId } : {};
      const now = new Date();
      let id: string;
      if (expected === null) {
        // Two requests may try to create it at once; the unique key lets one through.
        const created = await transaction.coreModuleInstallation.createMany({
          data: [{ ...change, ...actor, moduleKey, tenantId, updatedAt: now }],
          skipDuplicates: true,
        });
        if (created.count === 0) return null;
        id = (
          await transaction.coreModuleInstallation.findUniqueOrThrow({
            select: { id: true },
            where: { tenantId_moduleKey: { moduleKey, tenantId } },
          })
        ).id;
      } else {
        // The status is part of the condition, so a stale decision changes nothing.
        const updated = await transaction.coreModuleInstallation.updateMany({
          data: { ...change, ...actor, updatedAt: now },
          where: { moduleKey, status: expected, tenantId },
        });
        if (updated.count === 0) return null;
        id = (
          await transaction.coreModuleInstallation.findUniqueOrThrow({
            select: { id: true },
            where: { tenantId_moduleKey: { moduleKey, tenantId } },
          })
        ).id;
      }

      const row = toRecord(
        await transaction.coreModuleInstallation.findUniqueOrThrow({ select, where: { id } }),
      );
      // Settings for this schema version exist as soon as the module is provisioned.
      await transaction.coreModuleConfig.createMany({
        data: [{ installationId: id, schemaVersion: row.configSchemaVersion, tenantId }],
        skipDuplicates: true,
      });

      const payload = buildAuditPayload({
        after: { moduleKey, status: row.status },
        ...(expected ? { before: { moduleKey, status: expected } } : {}),
      });
      await transaction.auditLog.create({
        data: {
          action: options.action,
          ...actor,
          entityId: id,
          entityType: "module_installation",
          metadata: buildAuditMetadata(options.action, payload),
          ...(options.context?.requestId ? { requestId: options.context.requestId } : {}),
          tenantId,
        },
      });
      if (options.event) {
        await transaction.outboxEvent.create({
          data: {
            ...eventOrigin(options.context, "CORE_SUBSCRIPTION"),
            aggregateId: id,
            aggregateType: "module_installation",
            payload: safeEventPayload({ moduleKey, status: row.status }),
            tenantId,
            type: options.event.type,
          },
        });
      }
      return row;
    });
  }
}
