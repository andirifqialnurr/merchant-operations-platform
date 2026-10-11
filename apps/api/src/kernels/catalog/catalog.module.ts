import { Module } from "@nestjs/common";

import { FileModule } from "../../core/files/public.js";
import { CatalogUsageGauges } from "./adapters/catalog.gauges.js";
import { PrismaCatalogRepository } from "./adapters/prisma-catalog.repository.js";
import { CATALOG_REPOSITORY } from "./application/catalog.repository.js";
import { CatalogService } from "./application/catalog.service.js";

/**
 * Catalog kernel. Owns categories, products, variants, modifiers, product
 * images, and what each outlet sells. Other units reach it through
 * CatalogService; the HTTP surface lives in modules/catalog-profile.
 */
@Module({
  exports: [CatalogService],
  imports: [FileModule],
  providers: [
    CatalogService,
    CatalogUsageGauges,
    PrismaCatalogRepository,
    { provide: CATALOG_REPOSITORY, useExisting: PrismaCatalogRepository },
  ],
})
export class CatalogModule {}
