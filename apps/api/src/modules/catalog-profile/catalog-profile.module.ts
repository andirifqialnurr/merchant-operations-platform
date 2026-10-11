import { Module } from "@nestjs/common";

import { AuthModule } from "../../core/auth/public.js";
import { AccessModule } from "../../core/memberships/public.js";
import { CatalogModule } from "../../kernels/catalog/public.js";
import { CatalogImageController } from "./adapters/catalog-image.controller.js";
import { CatalogController } from "./adapters/catalog.controller.js";

/** The catalog as a business manages it over HTTP. The rules and the data belong to the catalog kernel. */
@Module({
  controllers: [CatalogController, CatalogImageController],
  imports: [AccessModule, AuthModule, CatalogModule],
})
export class CatalogProfileModule {}
