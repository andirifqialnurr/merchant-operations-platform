import { inventoryUnitListQuerySchema, inventoryUnitPageSchema } from "@merchant/contracts";
import { Inject, Injectable } from "@nestjs/common";

import {
  INVENTORY_MASTER_READ_ACCESS,
  type InventoryMasterReadAccess,
  type InventoryReadIdentity,
} from "./inventory-master-read-access.js";
import { INVENTORY_MASTER_READER, type InventoryMasterReader } from "./inventory-master-reader.js";
import { masterPage } from "./master-page.js";

@Injectable()
export class ReadInventoryUnits {
  constructor(
    @Inject(INVENTORY_MASTER_READ_ACCESS) private readonly access: InventoryMasterReadAccess,
    @Inject(INVENTORY_MASTER_READER) private readonly reader: InventoryMasterReader,
  ) {}

  async execute(input: unknown, identity: InventoryReadIdentity) {
    const scope = await this.access.authorize(identity);
    const query = inventoryUnitListQuerySchema.parse(input);
    const rows = await this.reader.listUnits(scope, query);
    return inventoryUnitPageSchema.parse(masterPage(rows, query.limit));
  }
}
