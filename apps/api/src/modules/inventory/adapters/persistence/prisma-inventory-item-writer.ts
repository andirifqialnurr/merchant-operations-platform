import { createHash } from "node:crypto";

import {
  commandChannelSchema,
  createInventoryItemSchema,
  entityIdParamsSchema,
  idempotencyKeySchema,
  inventoryItemSchema,
  requestIdSchema,
  type CreateInventoryItem,
} from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { Inject, Injectable } from "@nestjs/common";

import { buildAuditMetadata } from "../../../../core/audit/public.js";
import {
  runTransactionalWorkspaceCommand,
  TransactionalCommandError,
} from "../../../../core/idempotency/public.js";
import { LIMIT_GATE, type CountedLimitGate } from "../../../../shared/limits/limit-gate.js";
import type {
  InventoryItemWriteAttempt,
  InventoryItemWriter,
} from "../../application/inventory-item-writer.js";
import type { InventoryMasterWriteScope } from "../../application/inventory-master-write-access.js";
import { normalizeInventoryItem } from "../../domain/item-definition.js";
import { InventoryItemWriteError } from "../../domain/item-write-error.js";
import { parseInventoryQuantity } from "../../domain/quantity.js";

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
export class PrismaInventoryItemWriter implements InventoryItemWriter {
  constructor(@Inject(LIMIT_GATE) private readonly limits: CountedLimitGate) {}

  async create(
    scope: InventoryMasterWriteScope,
    body: CreateInventoryItem,
    attempt: InventoryItemWriteAttempt,
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
    const input = normalizeInventoryItem(createInventoryItemSchema.parse(body));
    const key = idempotencyKeySchema.parse(attempt.idempotencyKey);
    const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    // Resolve policy before reserving a TX connection: no nested pool IO under locks.
    // This does not check usage or reject replay solely for a lowered/full quota.
    const limit = await this.limits.prepareCounted(tenantId, "inventory.items.active");
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        const saved = await runTransactionalWorkspaceCommand(
          transaction,
          {
            tenantId,
            scope: `inventory.item.create:${actorId}`,
            key,
            requestHash,
            responseStatus: 201,
          },
          (value) => {
            const result = inventoryItemSchema.parse(value);
            if (
              result.name !== input.name ||
              result.sku !== input.sku ||
              result.categoryId !== input.categoryId ||
              result.baseUnitId !== input.baseUnitId ||
              result.minStock !== input.minStock ||
              result.status !== "ACTIVE"
            )
              throw new Error("Invalid saved item result.");
            return result;
          },
          async () => {
            await transaction.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${tenantId} || ':inventory-items-active', 0))`;
            const units = await transaction.$queryRaw<Array<{ id: string; precision: number }>>`
            SELECT id, precision FROM inventory_units WHERE tenant_id = ${tenantId}::uuid AND id = ${input.baseUnitId}::uuid FOR NO KEY UPDATE`;
            if (!units[0]) throw new InventoryItemWriteError("INVENTORY_UNIT_NOT_FOUND");
            if (input.categoryId !== null) {
              const categories = await transaction.$queryRaw<Array<{ status: string }>>`
              SELECT status FROM inventory_categories WHERE tenant_id = ${tenantId}::uuid AND id = ${input.categoryId}::uuid FOR NO KEY UPDATE`;
              if (!categories[0]) throw new InventoryItemWriteError("INVENTORY_CATEGORY_NOT_FOUND");
              if (categories[0].status !== "ACTIVE")
                throw new InventoryItemWriteError("INVENTORY_CATEGORY_INACTIVE");
            }
            if (
              input.minStock !== null &&
              !parseInventoryQuantity(input.minStock, units[0].precision).ok
            )
              throw new InventoryItemWriteError("INVENTORY_MINIMUM_PRECISION_EXCEEDED");
            const counts = await transaction.$queryRaw<Array<{ used: bigint }>>`
              SELECT count(*) AS used FROM inventory_items WHERE tenant_id = ${tenantId}::uuid AND status = 'ACTIVE'`;
            limit.assertCanAdd(counts[0]!.used);
            let row;
            try {
              row = await transaction.inventoryItem.create({
                data: { ...input, tenantId, status: "ACTIVE" },
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
            await transaction.auditLog.create({
              data: {
                tenantId,
                actorId,
                action: "inventory.item.create",
                entityType: "inventory_item",
                entityId: row.id,
                channel,
                ...(requestId ? { requestId, correlationId: requestId } : {}),
                metadata: buildAuditMetadata("inventory.item.create", {
                  after: {
                    status: "ACTIVE",
                    baseUnitId: input.baseUnitId,
                    categoryId: input.categoryId,
                  },
                }),
              },
            });
            return result;
          },
        );
        // Check original scoped identity/parents, not mutable current item fields or parent status.
        const item = await transaction.inventoryItem.findFirst({
          where: { tenantId, id: saved.id },
          select: { id: true },
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
        if (!item || !unit || !category)
          throw new InventoryItemWriteError("IDEMPOTENCY_RESULT_UNAVAILABLE");
        return saved;
      });
    } catch (error) {
      if (error instanceof TransactionalCommandError) throw new InventoryItemWriteError(error.code);
      throw error;
    }
  }
}
