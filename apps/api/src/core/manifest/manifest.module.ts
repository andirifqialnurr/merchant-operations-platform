import type { ModuleManifest } from "@merchant/contracts";
import { Global, Module, type DynamicModule } from "@nestjs/common";

import { ModuleManifestRegistry } from "./module-manifest.registry.js";

export const MODULE_MANIFEST_REGISTRY = Symbol("MODULE_MANIFEST_REGISTRY");

/**
 * Makes the manifest registry available everywhere. The manifests are handed
 * in by the composition root, because core must not import modules.
 */
@Global()
@Module({})
export class ManifestModule {
  static forManifests(manifests: readonly ModuleManifest[]): DynamicModule {
    return {
      exports: [MODULE_MANIFEST_REGISTRY],
      module: ManifestModule,
      providers: [
        { provide: MODULE_MANIFEST_REGISTRY, useValue: new ModuleManifestRegistry(manifests) },
      ],
    };
  }
}
