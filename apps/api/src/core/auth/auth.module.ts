import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller.js";
import { AUTH_REPOSITORY, PrismaAuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { SecurityModule } from "../security/public.js";

@Module({
  controllers: [AuthController],
  exports: [AuthService],
  imports: [SecurityModule],
  providers: [
    AuthService,
    PrismaAuthRepository,
    { provide: AUTH_REPOSITORY, useExisting: PrismaAuthRepository },
  ],
})
export class AuthModule {}
