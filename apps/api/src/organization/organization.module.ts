import { Module } from "@nestjs/common";

import { AccessModule } from "../access/access.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { OrganizationController } from "./organization.controller.js";
import {
  ORGANIZATION_REPOSITORY,
  PrismaOrganizationRepository,
} from "./organization.repository.js";
import { OrganizationService } from "./organization.service.js";

@Module({
  controllers: [OrganizationController],
  exports: [OrganizationService],
  imports: [AccessModule, AuthModule],
  providers: [
    OrganizationService,
    PrismaOrganizationRepository,
    { provide: ORGANIZATION_REPOSITORY, useExisting: PrismaOrganizationRepository },
  ],
})
export class OrganizationModule {}
