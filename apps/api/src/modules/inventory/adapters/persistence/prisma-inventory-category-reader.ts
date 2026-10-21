import {
  entityIdParamsSchema,
  inventoryCategoryListQuerySchema,
  inventoryCategorySchema,
  type InventoryCategoryListQuery,
} from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import type { InventoryCategoryReader } from "../../application/inventory-category-reader.js";
import type { InventoryMasterScope } from "../../application/inventory-master-reader.js";

@Injectable()
export class PrismaInventoryCategoryReader implements InventoryCategoryReader {
  async listCategories(scope: InventoryMasterScope, input: InventoryCategoryListQuery) {
    // Undefined Prisma filters are omitted, so fail closed before any accidental unscoped read.
    const tenantId = entityIdParamsSchema.parse({ id: scope.tenantId }).id.toLowerCase();
    const query = inventoryCategoryListQuerySchema.parse(input);
    const rows = await getPrismaClient().inventoryCategory.findMany({
      select: { id: true, name: true, status: true },
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.cursor ? { id: { gt: query.cursor.toLowerCase() } } : {}),
      },
      orderBy: { id: "asc" },
      take: query.limit + 1,
    });
    return rows.map((row) => inventoryCategorySchema.parse(row));
  }
}
