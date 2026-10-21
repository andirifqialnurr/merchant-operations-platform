import { createHash } from "node:crypto";

import {
  commandChannelSchema,
  createInventoryUnitConversionSchema,
  entityIdParamsSchema,
  idempotencyKeySchema,
  inventoryUnitConversionSchema,
  requestIdSchema,
  type CreateInventoryUnitConversion,
} from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import { buildAuditMetadata } from "../../../../core/audit/public.js";
import {
  runTransactionalWorkspaceCommand,
  TransactionalCommandError,
} from "../../../../core/idempotency/public.js";
import type {
  InventoryConversionWriteAttempt,
  InventoryConversionWriter,
} from "../../application/inventory-conversion-writer.js";
import type { InventoryMasterWriteScope } from "../../application/inventory-master-write-access.js";
import { normalizeInventoryUnitConversion } from "../../domain/conversion-definition.js";
import { InventoryConversionWriteError } from "../../domain/conversion-write-error.js";
import { haveCompatibleInventoryUnitDimensions } from "../../domain/unit-dimension.js";

const select = { id: true, fromUnitId: true, toUnitId: true, factor: true } as const;

@Injectable()
export class PrismaInventoryConversionWriter implements InventoryConversionWriter {
  async create(
    scope: InventoryMasterWriteScope,
    body: CreateInventoryUnitConversion,
    attempt: InventoryConversionWriteAttempt,
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
    const input = normalizeInventoryUnitConversion(createInventoryUnitConversionSchema.parse(body));
    const key = idempotencyKeySchema.parse(attempt.idempotencyKey);
    const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    try {
      return await getPrismaClient().$transaction(async (transaction) => {
        const saved = await runTransactionalWorkspaceCommand(
          transaction,
          {
            tenantId,
            scope: `inventory.unit_conversion.create:${actorId}`,
            key,
            requestHash,
            responseStatus: 201,
          },
          (value) => {
            const result = inventoryUnitConversionSchema.parse(value);
            if (
              result.fromUnitId !== input.fromUnitId ||
              result.toUnitId !== input.toUnitId ||
              result.factor !== input.factor
            )
              throw new Error("Invalid saved conversion result.");
            return result;
          },
          async () => {
            // Same deterministic lock order as the DB guard. No scope-free lookup,
            // no code/name inference, and definitions cannot change before the latch.
            const parents = await transaction.$queryRaw<
              Array<{ id: string; dimension: string | null }>
            >`
            SELECT id, dimension FROM inventory_units
            WHERE tenant_id = ${tenantId}::uuid
              AND id IN (${input.fromUnitId}::uuid, ${input.toUnitId}::uuid)
            ORDER BY id FOR NO KEY UPDATE
          `;
            if (parents.length !== 2)
              throw new InventoryConversionWriteError("INVENTORY_UNIT_NOT_FOUND");
            if (
              !haveCompatibleInventoryUnitDimensions(parents[0]!.dimension, parents[1]!.dimension)
            )
              throw new InventoryConversionWriteError("INVENTORY_UNIT_DIMENSIONS_INCOMPATIBLE");
            let row;
            try {
              row = await transaction.inventoryUnitConversion.create({
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
                throw new InventoryConversionWriteError("INVENTORY_CONVERSION_PAIR_TAKEN");
              throw error;
            }
            const result = inventoryUnitConversionSchema.parse({
              ...row,
              factor: row.factor.toFixed(),
            });
            await transaction.auditLog.create({
              data: {
                tenantId,
                actorId,
                action: "inventory.unit_conversion.create",
                entityType: "inventory_unit_conversion",
                entityId: row.id,
                channel,
                ...(requestId ? { requestId, correlationId: requestId } : {}),
                metadata: buildAuditMetadata("inventory.unit_conversion.create", {
                  after: {
                    fromUnitId: result.fromUnitId,
                    toUnitId: result.toUnitId,
                    factor: result.factor,
                  },
                }),
              },
            });
            return result;
          },
        );
        // Owner/parent checks stay outside the parser so DB failures remain infrastructure errors.
        // Compare binding, not the current factor: retries return the ORIGINAL create snapshot.
        const exists = await transaction.inventoryUnitConversion.findFirst({
          where: { tenantId, id: saved.id, fromUnitId: saved.fromUnitId, toUnitId: saved.toUnitId },
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
