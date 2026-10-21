import { createHash } from "node:crypto";

import {
  commandChannelSchema,
  entityIdParamsSchema,
  idempotencyKeySchema,
  inventoryCategorySchema,
  requestIdSchema,
  updateInventoryCategorySchema,
  type InventoryCategory,
  type UpdateInventoryCategory,
} from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { buildAuditMetadata } from "../../../../core/audit/public.js";
import {
  runTransactionalWorkspaceCommand,
  TransactionalCommandError,
} from "../../../../core/idempotency/public.js";
import type { InventoryCategoryUpdater } from "../../application/inventory-category-updater.js";
import type { InventoryCategoryWriteAttempt } from "../../application/inventory-category-writer.js";
import type { InventoryMasterWriteScope } from "../../application/inventory-master-write-access.js";
import { InventoryCategoryWriteError } from "../../domain/category-write-error.js";

const select = { id: true, name: true, status: true } as const;

@Injectable()
export class PrismaInventoryCategoryUpdater implements InventoryCategoryUpdater {
  async update(
    scope: InventoryMasterWriteScope,
    target: string,
    body: UpdateInventoryCategory,
    attempt: InventoryCategoryWriteAttempt,
  ) {
    const tenantId = entityIdParamsSchema.parse({ id: scope.tenantId }).id.toLowerCase();
    const actorId = entityIdParamsSchema.parse({ id: scope.actorId }).id.toLowerCase();
    const categoryId = entityIdParamsSchema.parse({ id: target }).id.toLowerCase();
    if (attempt.origin.actorId.toLowerCase() !== actorId || attempt.origin.deviceId)
      throw new Error("Invalid Inventory command origin.");
    const channel = commandChannelSchema.parse(attempt.origin.channel ?? "API");
    const requestId =
      attempt.origin.requestId === undefined
        ? undefined
        : requestIdSchema.parse(attempt.origin.requestId);
    const input = updateInventoryCategorySchema.parse(body);
    const key = idempotencyKeySchema.parse(attempt.idempotencyKey);
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ categoryId, name: input.name }))
      .digest("hex");
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        const saved = await runTransactionalWorkspaceCommand(
          transaction,
          {
            tenantId,
            scope: `inventory.category.update:${actorId}`,
            key,
            requestHash,
            responseStatus: 200,
          },
          (value) => {
            const result = inventoryCategorySchema.parse(value);
            if (result.id !== categoryId || result.name !== input.name)
              throw new Error("Invalid saved category update result.");
            return result;
          },
          async () => {
            const rows = await transaction.$queryRaw<InventoryCategory[]>`
            SELECT id, name, status FROM inventory_categories
            WHERE tenant_id = ${tenantId}::uuid AND id = ${categoryId}::uuid FOR NO KEY UPDATE
          `;
            const locked = rows[0];
            if (!locked) throw new InventoryCategoryWriteError("INVENTORY_CATEGORY_NOT_FOUND");
            const before = inventoryCategorySchema.parse(locked);
            if (before.name === input.name) return before;
            let row: InventoryCategory;
            try {
              row = await transaction.inventoryCategory.update({
                where: { tenantId_id: { tenantId, id: categoryId } },
                data: { name: input.name },
                select,
              });
            } catch (error) {
              if (
                typeof error === "object" &&
                error !== null &&
                "code" in error &&
                error.code === "P2002"
              )
                throw new InventoryCategoryWriteError("INVENTORY_CATEGORY_NAME_TAKEN");
              throw error;
            }
            const result = inventoryCategorySchema.parse(row);
            // Rename must never smuggle in lifecycle changes, including via malformed storage output.
            if (
              result.id !== before.id ||
              result.name !== input.name ||
              result.status !== before.status
            )
              throw new InventoryCategoryWriteError("IDEMPOTENCY_RESULT_UNAVAILABLE");
            await transaction.auditLog.create({
              data: {
                tenantId,
                actorId,
                action: "inventory.category.update",
                entityType: "inventory_category",
                entityId: categoryId,
                channel,
                ...(requestId ? { requestId, correlationId: requestId } : {}),
                metadata: buildAuditMetadata("inventory.category.update", { nameChanged: true }),
              },
            });
            return result;
          },
        );
        // Current name/status are mutable and may legitimately differ on replay.
        // Keep DB failures outside parser validation rather than labeling them corrupt DTOs.
        const exists = await transaction.inventoryCategory.findFirst({
          where: { tenantId, id: categoryId },
          select: { id: true },
        });
        if (!exists) throw new InventoryCategoryWriteError("IDEMPOTENCY_RESULT_UNAVAILABLE");
        return saved;
      });
    } catch (error) {
      if (error instanceof TransactionalCommandError)
        throw new InventoryCategoryWriteError(error.code);
      throw error;
    }
  }
}
