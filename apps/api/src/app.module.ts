import { Module } from "@nestjs/common";

import { AuthModule } from "./auth/auth.module.js";
import { HealthController } from "./health.controller.js";
import { OrganizationModule } from "./organization/organization.module.js";

@Module({
  controllers: [HealthController],
  imports: [AuthModule, OrganizationModule],
})
export class AppModule {}
