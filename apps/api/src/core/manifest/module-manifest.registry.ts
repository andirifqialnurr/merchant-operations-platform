import {
  moduleManifestSchema,
  PERMISSIONS,
  type ModuleKey,
  type ModuleManifest,
  type ModuleTier,
  type PermissionKey,
} from "@merchant/contracts";

const TIER_RANK: Record<ModuleTier, number> = { ADVANCED: 3, BASIC: 1, PRO: 2 };
const KNOWN_PERMISSIONS = new Set<string>(Object.values(PERMISSIONS));

/**
 * Key namespaces of modules that are planned but have no code, and so no
 * manifest, yet. They keep capabilities and limits that packages already
 * mention attached to the right module. Each entry goes away when the module
 * lands with its own manifest.
 */
const PLANNED_MODULE_NAMESPACES: Partial<Record<ModuleKey, readonly string[]>> = {
  CAFE_PROFILE: ["profile"],
  CUSTOMER_BASIC: ["customer"],
  FINANCE_BASIC: ["finance"],
  INVENTORY_BASIC: ["inventory"],
  KDS: ["kds"],
  TABLE_SELF_ORDER: ["floor", "self_order"],
};

export type NavigationEntry = { label: string; moduleKey: ModuleKey; path: string };

export type PackageContent = {
  capabilities: ReadonlyArray<{ capabilityKey: string; included: boolean }>;
  limits: ReadonlyArray<{ dimensionKey: string }>;
  modules: ReadonlyArray<{ moduleKey: ModuleKey; tier: ModuleTier }>;
};

const namespaceOf = (key: string) => key.slice(0, key.indexOf("."));

/**
 * Every module's own description of itself: what it can do at which tier,
 * what it is limited by, which permissions and menu entries it brings, which
 * events it produces and reacts to, and what it depends on. Built once at
 * start-up; a manifest that contradicts itself or another one stops the API.
 */
export class ModuleManifestRegistry {
  private readonly manifests = new Map<ModuleKey, ModuleManifest>();
  private readonly namespaceOwners = new Map<string, ModuleKey>();

  constructor(manifests: readonly ModuleManifest[] = []) {
    for (const candidate of manifests) {
      const manifest = moduleManifestSchema.parse(candidate);
      if (this.manifests.has(manifest.key)) {
        throw new Error(`Module ${manifest.key} has more than one manifest.`);
      }
      const unknown = [
        ...manifest.permissions,
        ...[...manifest.navigation, ...manifest.routes, ...manifest.settings].flatMap((item) =>
          item.permissionKey ? [item.permissionKey] : [],
        ),
      ].filter((permission) => !KNOWN_PERMISSIONS.has(permission));
      if (unknown.length > 0) {
        throw new Error(`Module ${manifest.key} names unknown permissions: ${unknown.join(", ")}.`);
      }
      for (const namespace of manifest.namespaces) {
        const owner = this.namespaceOwners.get(namespace);
        if (owner) {
          throw new Error(`Namespace "${namespace}" is claimed by ${owner} and ${manifest.key}.`);
        }
        this.namespaceOwners.set(namespace, manifest.key);
      }
      this.manifests.set(manifest.key, manifest);
    }

    for (const manifest of this.manifests.values()) {
      const missing = manifest.internalDependencies.filter((key) => !this.manifests.has(key));
      if (missing.length > 0) {
        throw new Error(
          `Module ${manifest.key} depends on modules without a manifest: ${missing.join(", ")}.`,
        );
      }
    }
    const produced = new Set([...this.manifests.values()].flatMap((item) => item.eventsProduced));
    for (const manifest of this.manifests.values()) {
      for (const handler of manifest.eventHandlers) {
        if (!produced.has(handler.eventType)) {
          throw new Error(
            `Module ${manifest.key} handles ${handler.eventType}, which no module produces.`,
          );
        }
      }
    }

    for (const [moduleKey, namespaces] of Object.entries(PLANNED_MODULE_NAMESPACES)) {
      if (this.manifests.has(moduleKey as ModuleKey)) continue;
      for (const namespace of namespaces ?? []) {
        if (!this.namespaceOwners.has(namespace)) {
          this.namespaceOwners.set(namespace, moduleKey as ModuleKey);
        }
      }
    }
  }

  all() {
    return [...this.manifests.values()];
  }

  get(moduleKey: ModuleKey) {
    return this.manifests.get(moduleKey);
  }

  /** The module that owns a capability or limit key, by the key's namespace. */
  ownerOf(key: string): ModuleKey | undefined {
    return this.namespaceOwners.get(namespaceOf(key));
  }

  /**
   * Capabilities the module gives at `tier`: everything that starts at that
   * tier or below. A module without a manifest gives none by default.
   */
  capabilitiesAt(moduleKey: ModuleKey, tier: ModuleTier): string[] {
    const manifest = this.manifests.get(moduleKey);
    if (!manifest) return [];
    return manifest.capabilities.filter(
      (key) => TIER_RANK[manifest.capabilityTiers[key] ?? "BASIC"] <= TIER_RANK[tier],
    );
  }

  /** Menu entries of the enabled modules that the user's permissions allow. */
  navigationFor(
    enabledModules: ReadonlySet<ModuleKey>,
    permissionKeys: readonly PermissionKey[],
  ): NavigationEntry[] {
    return this.all()
      .filter((manifest) => enabledModules.has(manifest.key))
      .flatMap((manifest) =>
        manifest.navigation
          .filter((item) => !item.permissionKey || permissionKeys.includes(item.permissionKey))
          .map((item) => ({ label: item.label, moduleKey: manifest.key, path: item.path })),
      );
  }

  /**
   * What is wrong with a package version, as sentences for the person
   * building it. An empty list means the content is consistent.
   */
  validatePackage(content: PackageContent): string[] {
    const problems: string[] = [];
    const included = new Map(content.modules.map((item) => [item.moduleKey, item.tier]));

    for (const { moduleKey } of content.modules) {
      for (const dependency of this.manifests.get(moduleKey)?.internalDependencies ?? []) {
        if (!included.has(dependency)) {
          problems.push(`${moduleKey} needs ${dependency}, which the package does not include.`);
        }
      }
    }
    for (const { capabilityKey } of content.capabilities) {
      const owner = this.ownerOf(capabilityKey);
      if (!owner) {
        problems.push(`No module owns the capability ${capabilityKey}.`);
      } else if (!included.has(owner)) {
        problems.push(`${capabilityKey} belongs to ${owner}, which the package does not include.`);
      } else {
        const manifest = this.manifests.get(owner);
        if (manifest && !manifest.capabilities.includes(capabilityKey)) {
          problems.push(`${owner} does not declare the capability ${capabilityKey}.`);
        }
      }
    }
    for (const { dimensionKey } of content.limits) {
      const owner = this.ownerOf(dimensionKey);
      const manifest = owner ? this.manifests.get(owner) : undefined;
      if (!owner) {
        problems.push(`No module owns the limit ${dimensionKey}.`);
      } else if (!included.has(owner)) {
        problems.push(`${dimensionKey} belongs to ${owner}, which the package does not include.`);
      } else if (manifest && !manifest.limitDimensions.includes(dimensionKey)) {
        problems.push(`${owner} does not declare the limit ${dimensionKey}.`);
      }
    }
    return problems;
  }
}
