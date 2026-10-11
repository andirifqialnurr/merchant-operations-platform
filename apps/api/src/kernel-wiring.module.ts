import { Global, Module } from "@nestjs/common";

import { CatalogModule, CatalogService } from "./kernels/catalog/public.js";
import { SELLABLE_MENU_SOURCE } from "./kernels/order-intake/public.js";

/**
 * Connects the ports one kernel declares to the kernel that answers them.
 * Kernels never import each other; this root file is the only place that
 * knows both sides.
 */
@Global()
@Module({
  exports: [SELLABLE_MENU_SOURCE],
  imports: [CatalogModule],
  // Orders are priced from the catalog's sellable menu.
  providers: [{ provide: SELLABLE_MENU_SOURCE, useExisting: CatalogService }],
})
export class KernelWiringModule {}
