import { createHash } from "node:crypto";

import {
  commandChannelSchema,
  createInventoryCategorySchema,
  entityIdParamsSchema,
  idempotencyKeySchema,
  inventoryCategorySchema,
  requestIdSchema,
  type CreateInventoryCategory,
  type InventoryCategory,
} from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { buildAuditMetadata } from "../../../../core/audit/public.js";
import {
  runTransactionalWorkspaceCommand,
  TransactionalCommandError,
} from "../../../../core/idempotency/public.js";
import type {
  InventoryCategoryWriteAttempt,
  InventoryCategoryWriter,
} from "../../application/inventory-category-writer.js";
import type { InventoryMasterWriteScope } from "../../application/inventory-master-write-access.js";
import { InventoryCategoryWriteError } from "../../domain/category-write-error.js";

const select = { id: true, name: true, status: true } as const;

@Injectable()
export class PrismaInventoryCategoryWriter implements InventoryCategoryWriter {
  async create(
    scope: InventoryMasterWriteScope,
    body: CreateInventoryCategory,
    attempt: InventoryCategoryWriteAttempt,
  ) {
    const tenantId = entityIdParamsSchema.parse({ id: scope.tenantId }).id.toLowerCase();
    const actorId = entityIdParamsSchema.parse({ id: scope.actorId }).id.toLowerCase();
    if (attempt.origin.actorId.toLowerCase() !== actorId || attempt.origin.deviceId)
      throw new Error("Invalid Inventory command origin.");
    const channel = commandChannelSchema.parse(attempt.origin.channel ?? "API");
    const requestId =
      attempt.origin.requestId === undefined
        ? undefined
        : requestIdSchema.parse(attempt.origin.requestId);
    const input = createInventoryCategorySchema.parse(body);
    const key = idempotencyKeySchema.parse(attempt.idempotencyKey);
    const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        const saved = await runTransactionalWorkspaceCommand(
          transaction,
          {
            tenantId,
            scope: `inventory.category.create:${actorId}`,
            key,
            requestHash,
            responseStatus: 201,
          },
          (value) => {
            const result = inventoryCategorySchema.parse(value);
            if (result.name !== input.name || result.status !== "ACTIVE")
              throw new Error("Invalid saved category result.");
            return result;
          },
          async () => {
            let row: InventoryCategory;
            try {
              row = await transaction.inventoryCategory.create({
                data: { tenantId, name: input.name, status: "ACTIVE" },
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
            await transaction.auditLog.create({
              data: {
                tenantId,
                actorId,
                action: "inventory.category.create",
                entityType: "inventory_category",
                entityId: row.id,
                channel,
                ...(requestId ? { requestId, correlationId: requestId } : {}),
                metadata: buildAuditMetadata("inventory.category.create", {
                  after: { status: "ACTIVE" },
                }),
              },
            });
            return inventoryCategorySchema.parse(row);
          },
        );
        // Infrastructure failures stay outside result parsing. Current name/status may
        // legitimately differ later: replay MUST retain the original create snapshot.
        const exists = await transaction.inventoryCategory.findFirst({
          where: { tenantId, id: saved.id },
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
