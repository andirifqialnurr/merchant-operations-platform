import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/public.js";
import { AccessModule } from "../memberships/public.js";
import { SecurityModule } from "../security/public.js";
import { DeviceController, DeviceSessionController } from "./device.controller.js";
import { DEVICE_REPOSITORY, PrismaDeviceRepository } from "./device.repository.js";
import { DeviceService } from "./device.service.js";

@Module({
  controllers: [DeviceController, DeviceSessionController],
  exports: [DeviceService],
  imports: [AccessModule, AuthModule, SecurityModule],
  providers: [
    DeviceService,
    PrismaDeviceRepository,
    { provide: DEVICE_REPOSITORY, useExisting: PrismaDeviceRepository },
  ],
})
export class DeviceModule {}
