import {
  entityIdParamsSchema,
  inventoryItemListQuerySchema,
  inventoryItemSchema,
  type InventoryItemListQuery,
} from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import type { InventoryItemReader } from "../../application/inventory-item-reader.js";
import type { InventoryMasterScope } from "../../application/inventory-master-reader.js";

@Injectable()
export class PrismaInventoryItemReader implements InventoryItemReader {
  async listItems(scope: InventoryMasterScope, input: InventoryItemListQuery) {
    // Undefined Prisma filters are omitted; reject invalid scope before touching persistence.
    const tenantId = entityIdParamsSchema.parse({ id: scope.tenantId }).id.toLowerCase();
    const query = inventoryItemListQuerySchema.parse(input);
    const rows = await getPrismaClient().inventoryItem.findMany({
      select: {
        id: true,
        sku: true,
        name: true,
        categoryId: true,
        baseUnitId: true,
        minStock: true,
        status: true,
      },
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId.toLowerCase() } : {}),
        ...(query.baseUnitId ? { baseUnitId: query.baseUnitId.toLowerCase() } : {}),
        ...(query.cursor ? { id: { gt: query.cursor.toLowerCase() } } : {}),
      },
      orderBy: { id: "asc" },
      take: query.limit + 1,
    });
    // No precision argument: preserve every stored digit, with no exponent or JS Number.
    return rows.map((row) =>
      inventoryItemSchema.parse({ ...row, minStock: row.minStock?.toFixed() ?? null }),
    );
  }
}
