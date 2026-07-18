import { Module } from "@nestjs/common";

import { AccessModule } from "./access/access.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { HealthController } from "./health.controller.js";
import { OrganizationModule } from "./organization/organization.module.js";

@Module({
  controllers: [HealthController],
  imports: [AccessModule, AuthModule, OrganizationModule],
})
export class AppModule {}
