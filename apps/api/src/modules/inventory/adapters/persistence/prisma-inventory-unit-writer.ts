import { createHash } from "node:crypto";

import {
  createInventoryUnitSchema,
  entityIdParamsSchema,
  idempotencyKeySchema,
  inventoryUnitSchema,
  type CreateInventoryUnit,
  type InventoryUnit,
} from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { buildAuditMetadata } from "../../../../core/audit/public.js";
import {
  runTransactionalWorkspaceCommand,
  TransactionalCommandError,
} from "../../../../core/idempotency/public.js";
import type { InventoryMasterWriteScope } from "../../application/inventory-master-write-access.js";
import type {
  InventoryUnitWriteAttempt,
  InventoryUnitWriter,
} from "../../application/inventory-unit-writer.js";
import { InventoryUnitWriteError } from "../../domain/unit-write-error.js";

const select = { id: true, code: true, name: true, precision: true } as const;

@Injectable()
export class PrismaInventoryUnitWriter implements InventoryUnitWriter {
  async create(
    scope: InventoryMasterWriteScope,
    body: CreateInventoryUnit,
    attempt: InventoryUnitWriteAttempt,
  ) {
    const tenantId = entityIdParamsSchema.parse({ id: scope.tenantId }).id.toLowerCase();
    const actorId = entityIdParamsSchema.parse({ id: scope.actorId }).id.toLowerCase();
    if (attempt.origin.actorId.toLowerCase() !== actorId || attempt.origin.deviceId)
      throw new Error("Invalid Inventory command origin.");
    const input = createInventoryUnitSchema.parse(body);
    const key = idempotencyKeySchema.parse(attempt.idempotencyKey);
    // Schema field order and trimming define the logical command, not client JSON order.
    const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        const saved = await runTransactionalWorkspaceCommand(
          transaction,
          {
            tenantId,
            scope: `inventory.unit.create:${actorId}`,
            key,
            requestHash,
            responseStatus: 201,
          },
          (value) => {
            const result = inventoryUnitSchema.parse(value);
            if (
              result.code !== input.code ||
              result.name !== input.name ||
              result.precision !== input.precision
            )
              throw new Error("Invalid saved unit result.");
            return result;
          },
          async () => {
            let row: InventoryUnit;
            try {
              row = await transaction.inventoryUnit.create({
                data: { ...input, tenantId },
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
            await transaction.auditLog.create({
              data: {
                tenantId,
                actorId,
                action: "inventory.unit.create",
                entityType: "inventory_unit",
                entityId: row.id,
                channel: attempt.origin.channel ?? "API",
                ...(attempt.origin.requestId
                  ? { requestId: attempt.origin.requestId, correlationId: attempt.origin.requestId }
                  : {}),
                metadata: buildAuditMetadata("inventory.unit.create", {
                  after: { code: row.code, precision: row.precision },
                }),
              },
            });
            return inventoryUnitSchema.parse(row);
          },
        );
        // Keep DB failures outside the result parser: unavailable infrastructure
        // must not be mislabeled as a corrupt saved DTO. Still inside the same TX.
        const exists = await transaction.inventoryUnit.findFirst({
          where: { id: saved.id, tenantId },
          select: { id: true },
        });
        if (!exists) throw new InventoryUnitWriteError("IDEMPOTENCY_RESULT_UNAVAILABLE");
        return saved;
      });
    } catch (error) {
      if (error instanceof TransactionalCommandError) throw new InventoryUnitWriteError(error.code);
      throw error;
    }
  }
}
