import { inventoryCategoryListQuerySchema, inventoryCategoryPageSchema } from "@merchant/contracts";
import { Inject, Injectable } from "@nestjs/common";

import {
  INVENTORY_CATEGORY_READER,
  type InventoryCategoryReader,
} from "./inventory-category-reader.js";
import {
  INVENTORY_MASTER_READ_ACCESS,
  type InventoryMasterReadAccess,
  type InventoryReadIdentity,
} from "./inventory-master-read-access.js";
import { masterPage } from "./master-page.js";

@Injectable()
export class ReadInventoryCategories {
  constructor(
    @Inject(INVENTORY_MASTER_READ_ACCESS) private readonly access: InventoryMasterReadAccess,
    @Inject(INVENTORY_CATEGORY_READER) private readonly reader: InventoryCategoryReader,
  ) {}

  async execute(input: unknown, identity: InventoryReadIdentity) {
    const scope = await this.access.authorize(identity);
    const query = inventoryCategoryListQuerySchema.parse(input);
    const rows = await this.reader.listCategories(scope, query);
    if (
      rows.length > query.limit + 1 ||
      (query.status && rows.some((row) => row.status !== query.status))
    )
      throw new Error(
        "Inventory category reader returned an unbounded or incorrectly filtered page.",
      );
    return inventoryCategoryPageSchema.parse(masterPage(rows, query.limit));
  }
}
