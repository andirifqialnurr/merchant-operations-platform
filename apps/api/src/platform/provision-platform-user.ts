import "reflect-metadata";

import { provisionPlatformUserSchema } from "@merchant/contracts";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "../app.module.js";
import { PlatformAuthService } from "./platform-auth.service.js";

async function provisionPlatformUser() {
  const input = provisionPlatformUserSchema.parse({
    displayName: process.env.PLATFORM_USER_DISPLAY_NAME,
    email: process.env.PLATFORM_USER_EMAIL,
    password: process.env.PLATFORM_USER_PASSWORD,
    role: process.env.PLATFORM_USER_ROLE,
  });
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const user = await app.get(PlatformAuthService).provisionUser(input);
    process.stdout.write(`Platform user ${user.email} provisioned with role ${user.role}.\n`);
  } finally {
    await app.close();
  }
}

void provisionPlatformUser();
