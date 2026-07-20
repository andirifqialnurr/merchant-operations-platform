import { Module } from "@nestjs/common";

import { CATALOG_REPOSITORY, PrismaCatalogRepository } from "./catalog.repository.js";
import { CatalogService } from "./catalog.service.js";

@Module({
  exports: [CatalogService],
  providers: [
    CatalogService,
    PrismaCatalogRepository,
    { provide: CATALOG_REPOSITORY, useExisting: PrismaCatalogRepository },
  ],
})
export class CatalogModule {}
