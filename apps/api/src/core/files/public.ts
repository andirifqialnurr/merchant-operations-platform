// The only entry point other parts of the API may import from this folder.
// Enforced by scripts/check-boundaries.mjs.
export { FileModule } from "./file.module.js";
export { FileStorageService } from "./file-storage.service.js";
export type { StoredFile } from "./file-storage.service.js";
export { applyBucketCors, webOrigins } from "./bucket-cors.js";
