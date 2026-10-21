import { createHash } from "node:crypto";

import {
  commandChannelSchema,
  entityIdParamsSchema,
  idempotencyKeySchema,
  inventoryUnitSchema,
  requestIdSchema,
  updateInventoryUnitSchema,
  type InventoryUnit,
  type UpdateInventoryUnit,
} from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { buildAuditMetadata } from "../../../../core/audit/public.js";
import {
  runTransactionalWorkspaceCommand,
  TransactionalCommandError,
} from "../../../../core/idempotency/public.js";
import type { InventoryMasterWriteScope } from "../../application/inventory-master-write-access.js";
import type { InventoryUnitUpdater } from "../../application/inventory-unit-updater.js";
import type { InventoryUnitWriteAttempt } from "../../application/inventory-unit-writer.js";
import { planInventoryUnitUpdate } from "../../domain/unit-update.js";
import { InventoryUnitWriteError } from "../../domain/unit-write-error.js";

const select = { id: true, code: true, name: true, precision: true, dimension: true } as const;

@Injectable()
export class PrismaInventoryUnitUpdater implements InventoryUnitUpdater {
  async update(
    scope: InventoryMasterWriteScope,
    target: string,
    body: UpdateInventoryUnit,
    attempt: InventoryUnitWriteAttempt,
  ) {
    const tenantId = entityIdParamsSchema.parse({ id: scope.tenantId }).id.toLowerCase();
    const actorId = entityIdParamsSchema.parse({ id: scope.actorId }).id.toLowerCase();
    const unitId = entityIdParamsSchema.parse({ id: target }).id.toLowerCase();
    if (attempt.origin.actorId.toLowerCase() !== actorId || attempt.origin.deviceId)
      throw new Error("Invalid Inventory command origin.");
    const channel = commandChannelSchema.parse(attempt.origin.channel ?? "API");
    const requestId =
      attempt.origin.requestId === undefined
        ? undefined
        : requestIdSchema.parse(attempt.origin.requestId);
    const patch = updateInventoryUnitSchema.parse(body);
    const key = idempotencyKeySchema.parse(attempt.idempotencyKey);
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ unitId, patch }))
      .digest("hex");
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        const saved = await runTransactionalWorkspaceCommand(
          transaction,
          {
            tenantId,
            scope: `inventory.unit.update:${actorId}`,
            key,
            requestHash,
            responseStatus: 200,
          },
          (value) => {
            const result = inventoryUnitSchema.parse(value);
            if (
              result.id !== unitId ||
              (patch.code !== undefined && result.code !== patch.code) ||
              (patch.name !== undefined && result.name !== patch.name) ||
              (patch.precision !== undefined && result.precision !== patch.precision)
            )
              throw new Error("Invalid saved unit update result.");
            return result;
          },
          async () => {
            const rows = await transaction.$queryRaw<
              Array<InventoryUnit & { definitionLocked: boolean }>
            >`
            SELECT id, code, name, precision, dimension, definition_locked AS "definitionLocked"
            FROM inventory_units WHERE tenant_id = ${tenantId}::uuid AND id = ${unitId}::uuid
            FOR NO KEY UPDATE
          `;
            const before = rows[0];
            if (!before) throw new InventoryUnitWriteError("INVENTORY_UNIT_NOT_FOUND");
            const plan = planInventoryUnitUpdate(before, patch);
            if (!plan.ok) throw new InventoryUnitWriteError(plan.code);
            if (!plan.changed)
              return inventoryUnitSchema.parse({
                id: before.id,
                code: before.code,
                name: before.name,
                precision: before.precision,
                dimension: before.dimension,
              });
            let row: InventoryUnit;
            try {
              row = await transaction.inventoryUnit.update({
                where: { tenantId_id: { tenantId, id: unitId } },
                data: {
                  ...(patch.code !== undefined ? { code: patch.code } : {}),
                  ...(patch.name !== undefined ? { name: patch.name } : {}),
                  ...(patch.precision !== undefined ? { precision: patch.precision } : {}),
                },
                select,
              });
            } catch (error) {
              if (
                typeof error === "object" &&
                error !== null &&
                "code" in error &&
                error.code === "P2002"
              )
                throw new InventoryUnitWriteError("INVENTORY_UNIT_CODE_TAKEN");
              throw error;
            }
            const result = inventoryUnitSchema.parse(row);
            if (
              result.id !== before.id ||
              result.code !== (patch.code ?? before.code) ||
              result.name !== (patch.name ?? before.name) ||
              result.precision !== (patch.precision ?? before.precision) ||
              result.dimension !== before.dimension
            )
              throw new InventoryUnitWriteError("IDEMPOTENCY_RESULT_UNAVAILABLE");
            await transaction.auditLog.create({
              data: {
                tenantId,
                actorId,
                action: "inventory.unit.update",
                entityType: "inventory_unit",
                entityId: unitId,
                channel,
                ...(requestId ? { requestId, correlationId: requestId } : {}),
                metadata: buildAuditMetadata("inventory.unit.update", {
                  before: { code: before.code, precision: before.precision },
                  after: { code: result.code, precision: result.precision },
                  nameChanged: plan.nameChanged,
                }),
              },
            });
            return result;
          },
        );
        // Current mutable fields may differ from the original snapshot on replay.
        // DB checks are outside the parser so infrastructure failures are not mislabeled as corrupt DTOs.
        const exists = await transaction.inventoryUnit.findFirst({
          where: { tenantId, id: unitId },
          select: { dimension: true },
        });
        if (!exists || exists.dimension !== saved.dimension)
          throw new InventoryUnitWriteError("IDEMPOTENCY_RESULT_UNAVAILABLE");
        return saved;
      });
    } catch (error) {
      if (error instanceof TransactionalCommandError) throw new InventoryUnitWriteError(error.code);
      throw error;
    }
  }
}
