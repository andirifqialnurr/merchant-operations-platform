import { createHash } from "node:crypto";

import {
  commandChannelSchema,
  entityIdParamsSchema,
  idempotencyKeySchema,
  inventoryItemSchema,
  requestIdSchema,
  updateInventoryItemSchema,
  type InventoryItem,
  type UpdateInventoryItem,
} from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { buildAuditMetadata } from "../../../../core/audit/public.js";
import {
  runTransactionalWorkspaceCommand,
  TransactionalCommandError,
} from "../../../../core/idempotency/public.js";
import type { InventoryItemUpdater } from "../../application/inventory-item-updater.js";
import type { InventoryItemWriteAttempt } from "../../application/inventory-item-writer.js";
import type { InventoryMasterWriteScope } from "../../application/inventory-master-write-access.js";
import { normalizeInventoryMinimum } from "../../domain/item-definition.js";
import { normalizeInventoryItemPatch, planInventoryItemUpdate } from "../../domain/item-update.js";
import { InventoryItemWriteError } from "../../domain/item-write-error.js";

const select = {
  id: true,
  sku: true,
  name: true,
  categoryId: true,
  baseUnitId: true,
  minStock: true,
  status: true,
} as const;

@Injectable()
export class PrismaInventoryItemUpdater implements InventoryItemUpdater {
  async update(
    scope: InventoryMasterWriteScope,
    target: string,
    body: UpdateInventoryItem,
    attempt: InventoryItemWriteAttempt,
  ) {
    const tenantId = entityIdParamsSchema.parse({ id: scope.tenantId }).id.toLowerCase();
    const actorId = entityIdParamsSchema.parse({ id: scope.actorId }).id.toLowerCase();
    const itemId = entityIdParamsSchema.parse({ id: target }).id.toLowerCase();
    if (attempt.origin.actorId.toLowerCase() !== actorId || attempt.origin.deviceId)
      throw new Error("Invalid Inventory command origin.");
    const channel = commandChannelSchema.parse(attempt.origin.channel ?? "API");
    const requestId =
      attempt.origin.requestId === undefined
        ? undefined
        : requestIdSchema.parse(attempt.origin.requestId);
    const patch = normalizeInventoryItemPatch(updateInventoryItemSchema.parse(body));
    const key = idempotencyKeySchema.parse(attempt.idempotencyKey);
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ itemId, patch }))
      .digest("hex");
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        const saved = await runTransactionalWorkspaceCommand(
          transaction,
          {
            tenantId,
            scope: `inventory.item.update:${actorId}`,
            key,
            requestHash,
            responseStatus: 200,
          },
          (value) => {
            const result = inventoryItemSchema.parse(value);
            if (
              result.id !== itemId ||
              (patch.name !== undefined && result.name !== patch.name) ||
              (patch.sku !== undefined && result.sku !== patch.sku) ||
              (patch.categoryId !== undefined && result.categoryId !== patch.categoryId) ||
              (patch.minStock !== undefined && result.minStock !== patch.minStock)
            )
              throw new Error("Invalid saved item update result.");
            return result;
          },
          async () => {
            // Same workspace convention as create/future lifecycle. No quota check: count/status do not change.
            await transaction.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${tenantId} || ':inventory-items-active', 0))`;
            const binding = await transaction.inventoryItem.findFirst({
              where: { tenantId, id: itemId },
              select: { baseUnitId: true },
            });
            if (!binding) throw new InventoryItemWriteError("INVENTORY_ITEM_NOT_FOUND");
            // Base unit is DB-immutable: safe binding lookup, then parents before target row (DB trigger order).
            const units = await transaction.$queryRaw<Array<{ precision: number }>>`
            SELECT precision FROM inventory_units WHERE tenant_id = ${tenantId}::uuid AND id = ${binding.baseUnitId}::uuid FOR NO KEY UPDATE`;
            if (!units[0]) throw new InventoryItemWriteError("INVENTORY_UNIT_NOT_FOUND");
            let categoryStatus: string | undefined;
            if (patch.categoryId !== undefined && patch.categoryId !== null) {
              const candidates = await transaction.$queryRaw<Array<{ status: string }>>`
              SELECT status FROM inventory_categories WHERE tenant_id = ${tenantId}::uuid AND id = ${patch.categoryId}::uuid FOR NO KEY UPDATE`;
              if (!candidates[0]) throw new InventoryItemWriteError("INVENTORY_CATEGORY_NOT_FOUND");
              categoryStatus = candidates[0].status;
            }
            const rows = await transaction.$queryRaw<InventoryItem[]>`
            SELECT id, sku, name, category_id AS "categoryId", base_unit_id AS "baseUnitId", min_stock::text AS "minStock", status
            FROM inventory_items WHERE tenant_id = ${tenantId}::uuid AND id = ${itemId}::uuid FOR NO KEY UPDATE`;
            if (!rows[0]) throw new InventoryItemWriteError("INVENTORY_ITEM_NOT_FOUND");
            const before = inventoryItemSchema.parse({
              ...rows[0],
              minStock: normalizeInventoryMinimum(rows[0].minStock),
            });
            if (before.baseUnitId !== binding.baseUnitId)
              throw new InventoryItemWriteError("IDEMPOTENCY_RESULT_UNAVAILABLE");
            const plan = planInventoryItemUpdate(before, patch, units[0].precision);
            if (!plan.ok) throw new InventoryItemWriteError(plan.code);
            if (
              plan.categoryChanged &&
              plan.after.categoryId !== null &&
              categoryStatus !== "ACTIVE"
            )
              throw new InventoryItemWriteError("INVENTORY_CATEGORY_INACTIVE");
            if (!plan.changed) return before;
            let row;
            try {
              row = await transaction.inventoryItem.update({
                where: { tenantId_id: { tenantId, id: itemId } },
                data: {
                  ...(patch.name !== undefined ? { name: patch.name } : {}),
                  ...(patch.sku !== undefined ? { sku: patch.sku } : {}),
                  ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
                  ...(patch.minStock !== undefined ? { minStock: patch.minStock } : {}),
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
                throw new InventoryItemWriteError("INVENTORY_ITEM_SKU_TAKEN");
              throw error;
            }
            const result = inventoryItemSchema.parse({
              ...row,
              minStock: row.minStock?.toFixed() ?? null,
            });
            if (
              Object.entries(plan.after).some(
                ([field, expected]) => result[field as keyof InventoryItem] !== expected,
              )
            )
              throw new InventoryItemWriteError("IDEMPOTENCY_RESULT_UNAVAILABLE");
            await transaction.auditLog.create({
              data: {
                tenantId,
                actorId,
                action: "inventory.item.update",
                entityType: "inventory_item",
                entityId: itemId,
                channel,
                ...(requestId ? { requestId, correlationId: requestId } : {}),
                metadata: buildAuditMetadata("inventory.item.update", {
                  ...plan.flags,
                  before: { categoryId: before.categoryId },
                  after: { categoryId: result.categoryId },
                }),
              },
            });
            return result;
          },
        );
        // Mutable current fields/status may differ: original patch result must never be reapplied.
        const exists = await transaction.inventoryItem.findFirst({
          where: { tenantId, id: itemId },
          select: { baseUnitId: true },
        });
        const unit = await transaction.inventoryUnit.findFirst({
          where: { tenantId, id: saved.baseUnitId },
          select: { id: true },
        });
        const category =
          saved.categoryId === null
            ? true
            : await transaction.inventoryCategory.findFirst({
                where: { tenantId, id: saved.categoryId },
                select: { id: true },
              });
        if (!exists || exists.baseUnitId !== saved.baseUnitId || !unit || !category)
          throw new InventoryItemWriteError("IDEMPOTENCY_RESULT_UNAVAILABLE");
        return saved;
      });
    } catch (error) {
      if (error instanceof TransactionalCommandError) throw new InventoryItemWriteError(error.code);
      throw error;
    }
  }
}
