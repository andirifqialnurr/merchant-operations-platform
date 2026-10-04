import { Global, Module } from "@nestjs/common";

import { DEVICE_AUTHENTICATOR } from "../../shared/devices/device-identity.js";

import { AuthModule } from "../auth/public.js";
import { AccessModule } from "../memberships/public.js";
import { SecurityModule } from "../security/public.js";
import { DeviceController, DeviceSessionController } from "./device.controller.js";
import { DEVICE_REPOSITORY, PrismaDeviceRepository } from "./device.repository.js";
import { DeviceService } from "./device.service.js";

/**
 * Global so that sign-in can ask which device a request comes from through
 * the token in `shared/devices` without importing this unit.
 */
@Global()
@Module({
  controllers: [DeviceController, DeviceSessionController],
  exports: [DeviceService, DEVICE_AUTHENTICATOR],
  imports: [AccessModule, AuthModule, SecurityModule],
  providers: [
    DeviceService,
    PrismaDeviceRepository,
    { provide: DEVICE_REPOSITORY, useExisting: PrismaDeviceRepository },
    { provide: DEVICE_AUTHENTICATOR, useExisting: DeviceService },
  ],
})
export class DeviceModule {}
