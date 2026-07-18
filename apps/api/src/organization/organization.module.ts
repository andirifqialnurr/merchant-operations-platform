import { Module } from "@nestjs/common";

import {
  ORGANIZATION_REPOSITORY,
  PrismaOrganizationRepository,
} from "./organization.repository.js";
import { OrganizationService } from "./organization.service.js";

@Module({
  providers: [
    OrganizationService,
    PrismaOrganizationRepository,
    { provide: ORGANIZATION_REPOSITORY, useExisting: PrismaOrganizationRepository },
  ],
})
export class OrganizationModule {}
