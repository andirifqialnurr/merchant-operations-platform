import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/public.js";
import { AccessModule } from "../memberships/public.js";
import { FileController } from "./file.controller.js";
import { FileStorageService, OBJECT_STORAGE } from "./file-storage.service.js";
import { createObjectStorage } from "./s3-object-storage.js";

@Module({
  controllers: [FileController],
  exports: [FileStorageService],
  imports: [AccessModule, AuthModule],
  providers: [
    FileStorageService,
    { provide: OBJECT_STORAGE, useFactory: () => createObjectStorage() },
  ],
})
export class FileModule {}
