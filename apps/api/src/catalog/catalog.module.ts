import { Module } from "@nestjs/common";

import { AccessModule } from "../core/memberships/public.js";
import { AuthModule } from "../core/auth/public.js";
import { FileModule } from "../core/files/public.js";
import { CatalogImageController } from "./catalog-image.controller.js";
import { CatalogController } from "./catalog.controller.js";
import { CatalogUsageGauges } from "./catalog.gauges.js";
import { CATALOG_REPOSITORY, PrismaCatalogRepository } from "./catalog.repository.js";
import { CatalogService } from "./catalog.service.js";

@Module({
  controllers: [CatalogController, CatalogImageController],
  exports: [CatalogService],
  imports: [AccessModule, AuthModule, FileModule],
  providers: [
    CatalogService,
    CatalogUsageGauges,
    PrismaCatalogRepository,
    { provide: CATALOG_REPOSITORY, useExisting: PrismaCatalogRepository },
  ],
})
export class CatalogModule {}
