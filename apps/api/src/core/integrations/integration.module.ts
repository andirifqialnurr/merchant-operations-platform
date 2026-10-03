import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/public.js";
import { AccessModule } from "../memberships/public.js";
import { BindingController } from "./binding.controller.js";
import { BINDING_REPOSITORY, PrismaBindingRepository } from "./binding.repository.js";
import { BindingService } from "./binding.service.js";

@Module({
  controllers: [BindingController],
  exports: [BindingService],
  imports: [AccessModule, AuthModule],
  providers: [
    BindingService,
    PrismaBindingRepository,
    { provide: BINDING_REPOSITORY, useExisting: PrismaBindingRepository },
  ],
})
export class IntegrationModule {}
