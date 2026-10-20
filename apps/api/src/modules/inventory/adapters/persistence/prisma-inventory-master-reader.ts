import {
  entityIdParamsSchema,
  inventoryUnitConversionListQuerySchema,
  inventoryUnitConversionSchema,
  inventoryUnitListQuerySchema,
  inventoryUnitSchema,
  type InventoryUnitConversionListQuery,
  type InventoryUnitListQuery,
} from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import type {
  InventoryMasterReader,
  InventoryMasterScope,
} from "../../application/inventory-master-reader.js";

const unitSelect = { id: true, code: true, name: true, precision: true } as const;
const conversionSelect = { id: true, fromUnitId: true, toUnitId: true, factor: true } as const;

@Injectable()
export class PrismaInventoryMasterReader implements InventoryMasterReader {
  async listUnits(scope: InventoryMasterScope, input: InventoryUnitListQuery) {
    // Prisma omits undefined filters: validate even for an accidental internal caller.
    const tenantId = entityIdParamsSchema.parse({ id: scope.tenantId }).id;
    const query = inventoryUnitListQuerySchema.parse(input);
    const rows = await getPrismaClient().inventoryUnit.findMany({
      select: unitSelect,
      where: { tenantId, ...(query.cursor ? { id: { gt: query.cursor } } : {}) },
      orderBy: { id: "asc" },
      take: query.limit + 1,
    });
    return rows.map((row) => inventoryUnitSchema.parse(row));
  }

  async listConversions(scope: InventoryMasterScope, input: InventoryUnitConversionListQuery) {
    const tenantId = entityIdParamsSchema.parse({ id: scope.tenantId }).id;
    const query = inventoryUnitConversionListQuerySchema.parse(input);
    const rows = await getPrismaClient().inventoryUnitConversion.findMany({
      select: conversionSelect,
      where: {
        tenantId,
        ...(query.cursor ? { id: { gt: query.cursor } } : {}),
        ...(query.fromUnitId ? { fromUnitId: query.fromUnitId } : {}),
        ...(query.toUnitId ? { toUnitId: query.toUnitId } : {}),
      },
      orderBy: { id: "asc" },
      take: query.limit + 1,
    });
    // No decimalPlaces argument: format ALL saved digits without exponent or rounding.
    return rows.map((row) =>
      inventoryUnitConversionSchema.parse({ ...row, factor: row.factor.toFixed() }),
    );
  }
}
