import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/public.js";
import { EntitlementModule } from "../entitlements/public.js";
import { AccessModule } from "../memberships/public.js";
import { InstallationController } from "./installation.controller.js";
import {
  INSTALLATION_REPOSITORY,
  PrismaInstallationRepository,
} from "./installation.repository.js";
import { InstallationService } from "./installation.service.js";

@Module({
  controllers: [InstallationController],
  exports: [InstallationService],
  imports: [AccessModule, AuthModule, EntitlementModule],
  providers: [
    InstallationService,
    PrismaInstallationRepository,
    { provide: INSTALLATION_REPOSITORY, useExisting: PrismaInstallationRepository },
  ],
})
export class InstallationModule {}
