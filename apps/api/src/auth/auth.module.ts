import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller.js";
import { AUTH_REPOSITORY, PrismaAuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaAuthRepository,
    { provide: AUTH_REPOSITORY, useExisting: PrismaAuthRepository },
  ],
})
export class AuthModule {}
