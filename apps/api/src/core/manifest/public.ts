// The only entry point other parts of the API may import from this folder.
// Enforced by scripts/check-boundaries.mjs.
export { ManifestModule, MODULE_MANIFEST_REGISTRY } from "./manifest.module.js";
export { ModuleManifestRegistry } from "./module-manifest.registry.js";
export type { NavigationEntry, PackageContent } from "./module-manifest.registry.js";
