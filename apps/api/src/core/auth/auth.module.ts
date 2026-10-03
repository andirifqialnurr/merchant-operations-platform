import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller.js";
import { AUTH_REPOSITORY, PrismaAuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { InMemoryRateLimitService, RATE_LIMIT_SERVICE } from "../security/rate-limit.service.js";

@Module({
  controllers: [AuthController],
  exports: [AuthService],
  providers: [
    AuthService,
    InMemoryRateLimitService,
    PrismaAuthRepository,
    { provide: AUTH_REPOSITORY, useExisting: PrismaAuthRepository },
    { provide: RATE_LIMIT_SERVICE, useExisting: InMemoryRateLimitService },
  ],
})
export class AuthModule {}
