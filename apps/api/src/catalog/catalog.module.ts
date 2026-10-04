import { Module } from "@nestjs/common";

import { AccessModule } from "../core/memberships/public.js";
import { AuthModule } from "../core/auth/public.js";
import { CatalogController } from "./catalog.controller.js";
import { CatalogUsageGauges } from "./catalog.gauges.js";
import { CATALOG_REPOSITORY, PrismaCatalogRepository } from "./catalog.repository.js";
import { CatalogService } from "./catalog.service.js";

@Module({
  controllers: [CatalogController],
  exports: [CatalogService],
  imports: [AccessModule, AuthModule],
  providers: [
    CatalogService,
    CatalogUsageGauges,
    PrismaCatalogRepository,
    { provide: CATALOG_REPOSITORY, useExisting: PrismaCatalogRepository },
  ],
})
export class CatalogModule {}
