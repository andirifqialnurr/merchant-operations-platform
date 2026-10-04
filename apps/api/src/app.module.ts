import { Module } from "@nestjs/common";

import { AccessModule } from "./core/memberships/public.js";
import { AuthModule } from "./core/auth/public.js";
import { CatalogModule } from "./catalog/public.js";
import { DeviceModule } from "./core/devices/public.js";
import { EventsModule } from "./core/events/public.js";
import { FileModule } from "./core/files/public.js";
import { InstallationModule } from "./core/installations/public.js";
import { ManifestModule } from "./core/manifest/public.js";
import { MeteringModule } from "./core/metering/public.js";
import { HealthController } from "./health.controller.js";
import { MODULE_MANIFESTS } from "./module-manifests.js";
import { PosSalesModule } from "./modules/pos-sales/public.js";
import { OrganizationModule } from "./core/workspaces/public.js";
import { PlatformModule } from "./core/platform/public.js";

@Module({
  controllers: [HealthController],
  imports: [
    ManifestModule.forManifests(MODULE_MANIFESTS),
    EventsModule,
    AccessModule,
    AuthModule,
    CatalogModule,
    DeviceModule,
    FileModule,
    InstallationModule,
    MeteringModule,
    OrganizationModule,
    PlatformModule,
    PosSalesModule,
  ],
})
export class AppModule {}
