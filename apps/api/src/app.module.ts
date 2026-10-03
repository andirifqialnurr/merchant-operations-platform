import { Module } from "@nestjs/common";

import { AccessModule } from "./core/memberships/public.js";
import { AuthModule } from "./core/auth/public.js";
import { CatalogModule } from "./catalog/public.js";
import { HealthController } from "./health.controller.js";
import { PosSalesModule } from "./modules/pos-sales/public.js";
import { OrganizationModule } from "./core/workspaces/public.js";
import { PlatformModule } from "./core/platform/public.js";

@Module({
  controllers: [HealthController],
  imports: [
    AccessModule,
    AuthModule,
    CatalogModule,
    OrganizationModule,
    PlatformModule,
    PosSalesModule,
  ],
})
export class AppModule {}
