import { Module } from "@nestjs/common";

import { AccessModule } from "../memberships/public.js";
import { AuthModule } from "../auth/public.js";
import { OrganizationController } from "./organization.controller.js";
import {
  ORGANIZATION_REPOSITORY,
  PrismaOrganizationRepository,
} from "./organization.repository.js";
import { OrganizationUsageGauges } from "./organization.gauges.js";
import { OrganizationService } from "./organization.service.js";

@Module({
  controllers: [OrganizationController],
  exports: [OrganizationService],
  imports: [AccessModule, AuthModule],
  providers: [
    OrganizationService,
    OrganizationUsageGauges,
    PrismaOrganizationRepository,
    { provide: ORGANIZATION_REPOSITORY, useExisting: PrismaOrganizationRepository },
  ],
})
export class OrganizationModule {}
