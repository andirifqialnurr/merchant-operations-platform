import { Module } from "@nestjs/common";

import { AccessModule } from "./core/memberships/public.js";
import { AuthModule } from "./core/auth/public.js";
import { CatalogModule } from "./catalog/public.js";
import { ManifestModule } from "./core/manifest/public.js";
import { HealthController } from "./health.controller.js";
import { MODULE_MANIFESTS } from "./module-manifests.js";
import { PosSalesModule } from "./modules/pos-sales/public.js";
import { OrganizationModule } from "./core/workspaces/public.js";
import { PlatformModule } from "./core/platform/public.js";

@Module({
  controllers: [HealthController],
  imports: [
    ManifestModule.forManifests(MODULE_MANIFESTS),
    AccessModule,
    AuthModule,
    CatalogModule,
    OrganizationModule,
    PlatformModule,
    PosSalesModule,
  ],
})
export class AppModule {}
