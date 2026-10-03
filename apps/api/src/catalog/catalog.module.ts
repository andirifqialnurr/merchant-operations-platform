import { Module } from "@nestjs/common";

import { AccessModule } from "../core/memberships/access.module.js";
import { AuthModule } from "../core/auth/auth.module.js";
import { CatalogController } from "./catalog.controller.js";
import { CATALOG_REPOSITORY, PrismaCatalogRepository } from "./catalog.repository.js";
import { CatalogService } from "./catalog.service.js";

@Module({
  controllers: [CatalogController],
  exports: [CatalogService],
  imports: [AccessModule, AuthModule],
  providers: [
    CatalogService,
    PrismaCatalogRepository,
    { provide: CATALOG_REPOSITORY, useExisting: PrismaCatalogRepository },
  ],
})
export class CatalogModule {}
