import { Module } from "@nestjs/common";

import { AccessModule } from "./access/access.module.js";
import { AuthModule } from "./core/auth/auth.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { HealthController } from "./health.controller.js";
import { PosSalesModule } from "./modules/pos-sales/pos-sales.module.js";
import { OrganizationModule } from "./organization/organization.module.js";
import { PlatformModule } from "./platform/platform.module.js";

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
