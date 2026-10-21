import { createHash } from "node:crypto";

import {
  commandChannelSchema,
  entityIdParamsSchema,
  idempotencyKeySchema,
  inventoryCategorySchema,
  requestIdSchema,
  setInventoryCategoryStatusSchema,
  type InventoryCategory,
  type SetInventoryCategoryStatus,
} from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { buildAuditMetadata } from "../../../../core/audit/public.js";
import {
  runTransactionalWorkspaceCommand,
  TransactionalCommandError,
} from "../../../../core/idempotency/public.js";
import type { InventoryCategoryStatusWriter } from "../../application/inventory-category-status-writer.js";
import type { InventoryCategoryWriteAttempt } from "../../application/inventory-category-writer.js";
import type { InventoryMasterWriteScope } from "../../application/inventory-master-write-access.js";
import { InventoryCategoryWriteError } from "../../domain/category-write-error.js";

const select = { id: true, name: true, status: true } as const;

@Injectable()
export class PrismaInventoryCategoryStatusWriter implements InventoryCategoryStatusWriter {
  async setStatus(
    scope: InventoryMasterWriteScope,
    target: string,
    body: SetInventoryCategoryStatus,
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
    const input = setInventoryCategoryStatusSchema.parse(body);
    const key = idempotencyKeySchema.parse(attempt.idempotencyKey);
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ categoryId, status: input.status }))
      .digest("hex");
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        const saved = await runTransactionalWorkspaceCommand(
          transaction,
          {
            tenantId,
            scope: `inventory.category.status_change:${actorId}`,
            key,
            requestHash,
            responseStatus: 200,
          },
          (value) => {
            const result = inventoryCategorySchema.parse(value);
            if (result.id !== categoryId || result.status !== input.status)
              throw new Error("Invalid saved category lifecycle result.");
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
            if (before.status === input.status) return before;
            const row = await transaction.inventoryCategory.update({
              where: { tenantId_id: { tenantId, id: categoryId } },
              data: { status: input.status },
              select,
            });
            const result = inventoryCategorySchema.parse(row);
            if (
              result.id !== before.id ||
              result.name !== before.name ||
              result.status !== input.status
            )
              throw new InventoryCategoryWriteError("IDEMPOTENCY_RESULT_UNAVAILABLE");
            await transaction.auditLog.create({
              data: {
                tenantId,
                actorId,
                action: "inventory.category.status_change",
                entityType: "inventory_category",
                entityId: categoryId,
                channel,
                ...(requestId ? { requestId, correlationId: requestId } : {}),
                metadata: buildAuditMetadata("inventory.category.status_change", {
                  before: { status: before.status },
                  after: { status: result.status },
                }),
              },
            });
            return result;
          },
        );
        // Name and status are mutable: replay returns its ORIGINAL outcome, not
        // another mutation or a read of the current master. DB errors stay outside parsing.
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
