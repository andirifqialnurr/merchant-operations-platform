import { createHash } from "node:crypto";

import {
  commandChannelSchema,
  entityIdParamsSchema,
  idempotencyKeySchema,
  inventoryUnitConversionSchema,
  requestIdSchema,
  updateInventoryUnitConversionSchema,
  type InventoryUnitConversion,
  type UpdateInventoryUnitConversion,
} from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { buildAuditMetadata } from "../../../../core/audit/public.js";
import {
  runTransactionalWorkspaceCommand,
  TransactionalCommandError,
} from "../../../../core/idempotency/public.js";
import type { InventoryConversionUpdater } from "../../application/inventory-conversion-updater.js";
import type { InventoryConversionWriteAttempt } from "../../application/inventory-conversion-writer.js";
import type { InventoryMasterWriteScope } from "../../application/inventory-master-write-access.js";
import { normalizeInventoryConversionFactor } from "../../domain/conversion-definition.js";
import { InventoryConversionWriteError } from "../../domain/conversion-write-error.js";
import { haveCompatibleInventoryUnitDimensions } from "../../domain/unit-dimension.js";

const select = { id: true, fromUnitId: true, toUnitId: true, factor: true } as const;

@Injectable()
export class PrismaInventoryConversionUpdater implements InventoryConversionUpdater {
  async update(
    scope: InventoryMasterWriteScope,
    target: string,
    body: UpdateInventoryUnitConversion,
    attempt: InventoryConversionWriteAttempt,
  ) {
    const tenantId = entityIdParamsSchema.parse({ id: scope.tenantId }).id.toLowerCase();
    const actorId = entityIdParamsSchema.parse({ id: scope.actorId }).id.toLowerCase();
    const conversionId = entityIdParamsSchema.parse({ id: target }).id.toLowerCase();
    if (attempt.origin.actorId.toLowerCase() !== actorId || attempt.origin.deviceId)
      throw new Error("Invalid Inventory command origin.");
    const channel = commandChannelSchema.parse(attempt.origin.channel ?? "API");
    const requestId =
      attempt.origin.requestId === undefined
        ? undefined
        : requestIdSchema.parse(attempt.origin.requestId);
    const factor = normalizeInventoryConversionFactor(
      updateInventoryUnitConversionSchema.parse(body).factor,
    );
    const key = idempotencyKeySchema.parse(attempt.idempotencyKey);
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ conversionId, factor }))
      .digest("hex");
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        const saved = await runTransactionalWorkspaceCommand(
          transaction,
          {
            tenantId,
            scope: `inventory.unit_conversion.update:${actorId}`,
            key,
            requestHash,
            responseStatus: 200,
          },
          (value) => {
            const result = inventoryUnitConversionSchema.parse(value);
            if (result.id !== conversionId || result.factor !== factor)
              throw new Error("Invalid saved conversion update result.");
            return result;
          },
          async () => {
            // Initial lookup proves binding only, NOT the current factor. Pair/identity
            // cannot move and masters cannot be deleted under the existing DB guards.
            const binding = await transaction.inventoryUnitConversion.findFirst({
              where: { tenantId, id: conversionId },
              select: { fromUnitId: true, toUnitId: true },
            });
            if (!binding) throw new InventoryConversionWriteError("INVENTORY_CONVERSION_NOT_FOUND");
            // Same parent-first UUID order as create, including reverse-pair writers.
            const parents = await transaction.$queryRaw<
              Array<{ id: string; dimension: string | null }>
            >`
            SELECT id, dimension FROM inventory_units WHERE tenant_id = ${tenantId}::uuid
              AND id IN (${binding.fromUnitId}::uuid, ${binding.toUnitId}::uuid)
            ORDER BY id FOR NO KEY UPDATE
          `;
            if (
              parents.length !== 2 ||
              !haveCompatibleInventoryUnitDimensions(parents[0]!.dimension, parents[1]!.dimension)
            )
              throw new InventoryConversionWriteError("INVENTORY_UNIT_DIMENSIONS_INCOMPATIBLE");
            const rows = await transaction.$queryRaw<InventoryUnitConversion[]>`
            SELECT id, from_unit_id AS "fromUnitId", to_unit_id AS "toUnitId", factor::text AS factor
            FROM inventory_unit_conversions WHERE tenant_id = ${tenantId}::uuid AND id = ${conversionId}::uuid
            FOR NO KEY UPDATE
          `;
            const locked = rows[0];
            if (
              !locked ||
              locked.fromUnitId !== binding.fromUnitId ||
              locked.toUnitId !== binding.toUnitId
            )
              throw new InventoryConversionWriteError("IDEMPOTENCY_RESULT_UNAVAILABLE");
            const before = inventoryUnitConversionSchema.parse({
              ...locked,
              factor: normalizeInventoryConversionFactor(locked.factor),
            });
            if (before.factor === factor) return before;
            const row = await transaction.inventoryUnitConversion.update({
              where: { tenantId_id: { tenantId, id: conversionId } },
              data: { factor },
              select,
            });
            const result = inventoryUnitConversionSchema.parse({
              ...row,
              factor: row.factor.toFixed(),
            });
            if (
              result.id !== conversionId ||
              result.fromUnitId !== binding.fromUnitId ||
              result.toUnitId !== binding.toUnitId ||
              result.factor !== factor
            )
              throw new InventoryConversionWriteError("IDEMPOTENCY_RESULT_UNAVAILABLE");
            await transaction.auditLog.create({
              data: {
                tenantId,
                actorId,
                action: "inventory.unit_conversion.update",
                entityType: "inventory_unit_conversion",
                entityId: conversionId,
                channel,
                ...(requestId ? { requestId, correlationId: requestId } : {}),
                metadata: buildAuditMetadata("inventory.unit_conversion.update", {
                  fromUnitId: before.fromUnitId,
                  toUnitId: before.toUnitId,
                  before: { factor: before.factor },
                  after: { factor: result.factor },
                }),
              },
            });
            return result;
          },
        );
        // Keep DB failures outside result parsing; compare immutable binding/parents,
        // NOT current factor, because valid replay must retain the original result.
        const exists = await transaction.inventoryUnitConversion.findFirst({
          where: {
            tenantId,
            id: conversionId,
            fromUnitId: saved.fromUnitId,
            toUnitId: saved.toUnitId,
          },
          select: {
            id: true,
            fromUnit: { select: { dimension: true } },
            toUnit: { select: { dimension: true } },
          },
        });
        if (
          !exists ||
          !haveCompatibleInventoryUnitDimensions(exists.fromUnit.dimension, exists.toUnit.dimension)
        )
          throw new InventoryConversionWriteError("IDEMPOTENCY_RESULT_UNAVAILABLE");
        return saved;
      });
    } catch (error) {
      if (error instanceof TransactionalCommandError)
        throw new InventoryConversionWriteError(error.code);
      throw error;
    }
  }
}
