import {
  inventoryItemListQuerySchema,
  inventoryItemPageSchema,
  inventoryItemSchema,
} from "@merchant/contracts";
import { Inject, Injectable } from "@nestjs/common";

import { INVENTORY_ITEM_READER, type InventoryItemReader } from "./inventory-item-reader.js";
import {
  INVENTORY_MASTER_READ_ACCESS,
  type InventoryMasterReadAccess,
  type InventoryReadIdentity,
} from "./inventory-master-read-access.js";
import { masterPage } from "./master-page.js";

@Injectable()
export class ReadInventoryItems {
  constructor(
    @Inject(INVENTORY_MASTER_READ_ACCESS) private readonly access: InventoryMasterReadAccess,
    @Inject(INVENTORY_ITEM_READER) private readonly reader: InventoryItemReader,
  ) {}

  async execute(input: unknown, identity: InventoryReadIdentity) {
    const scope = await this.access.authorize(identity);
    const query = inventoryItemListQuerySchema.parse(input);
    const raw = await this.reader.listItems(scope, query);
    if (raw.length > query.limit + 1)
      throw new Error("Inventory item reader returned an unbounded page.");
    // Validate the peek as well: do not hide a leaked or malformed row behind pagination.
    const rows = raw.map((row) => inventoryItemSchema.parse(row));
    if (
      rows.some(
        (row, i) =>
          (query.status && row.status !== query.status) ||
          (query.categoryId && row.categoryId?.toLowerCase() !== query.categoryId.toLowerCase()) ||
          (query.baseUnitId && row.baseUnitId.toLowerCase() !== query.baseUnitId.toLowerCase()) ||
          (query.cursor && row.id.toLowerCase() <= query.cursor.toLowerCase()) ||
          (i > 0 && row.id.toLowerCase() <= rows[i - 1]!.id.toLowerCase()),
      )
    )
      throw new Error("Inventory item reader returned an incorrectly filtered or ordered page.");
    return inventoryItemPageSchema.parse(masterPage(rows, query.limit));
  }
}
