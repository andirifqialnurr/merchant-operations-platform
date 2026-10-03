import {
  moduleInstallationSchema,
  workspaceNavigationSchema,
  type ModuleInstallation,
  type ModuleInstallationStatus,
  type ModuleKey,
  type PermissionKey,
  type WorkspaceNavigation,
} from "@merchant/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { accessDenied, EntitlementService } from "../entitlements/public.js";
import { BindingService } from "../integrations/public.js";
import { MODULE_MANIFEST_REGISTRY, type ModuleManifestRegistry } from "../manifest/public.js";
import { canMove, isInstalled } from "./installation-lifecycle.js";
import {
  INSTALLATION_REPOSITORY,
  type InstallationChange,
  type InstallationMutationContext,
  type InstallationRecord,
  type InstallationRepository,
} from "./installation.repository.js";

function conflict(code: string, message: string, details?: Record<string, string>) {
  return new ConflictException({ code, message, ...(details ? { details } : {}) });
}

function toInstallation(record: InstallationRecord): ModuleInstallation {
  return moduleInstallationSchema.parse({
    activatedAt: record.activatedAt?.toISOString() ?? null,
    configSchemaVersion: record.configSchemaVersion,
    errorMessage: record.errorMessage,
    moduleKey: record.moduleKey,
    provisionedAt: record.provisionedAt?.toISOString() ?? null,
    setupRequiredReason: record.setupRequiredReason,
    status: record.status,
    suspendedReason: record.suspendedReason,
    updatedAt: record.updatedAt.toISOString(),
    workspaceId: record.tenantId,
  });
}

/** How a module that was never installed is shown. */
function notInstalled(tenantId: string, moduleKey: ModuleKey, now: Date): ModuleInstallation {
  return moduleInstallationSchema.parse({
    activatedAt: null,
    configSchemaVersion: 1,
    errorMessage: null,
    moduleKey,
    provisionedAt: null,
    setupRequiredReason: null,
    status: "NOT_INSTALLED",
    suspendedReason: null,
    updatedAt: now.toISOString(),
    workspaceId: tenantId,
  });
}

/**
 * Installing, suspending, and removing commercial modules for a workspace
 * (architecture.md 6.1). Core modules are part of every workspace and have no
 * installation of their own.
 */
@Injectable()
export class InstallationService {
  constructor(
    @Inject(INSTALLATION_REPOSITORY) private readonly repository: InstallationRepository,
    @Inject(EntitlementService) private readonly entitlements: EntitlementService,
    @Inject(MODULE_MANIFEST_REGISTRY) private readonly manifests: ModuleManifestRegistry,
    @Inject(BindingService) private readonly bindings: BindingService,
  ) {}

  /** Every commercial module the workspace is entitled to or has installed, with its status. */
  async list(tenantId: string, now = new Date()): Promise<ModuleInstallation[]> {
    const [snapshot, records] = await Promise.all([
      this.entitlements.getSnapshot(tenantId, now),
      this.repository.list(tenantId),
    ]);
    const byModule = new Map(records.map((record) => [record.moduleKey, record]));
    return snapshot.modules
      .filter((module) => module.kind === "COMMERCIAL")
      .filter((module) => module.enabled || byModule.has(module.key))
      .map((module) => {
        const record = byModule.get(module.key);
        return record ? toInstallation(record) : notInstalled(tenantId, module.key, now);
      });
  }

  /**
   * The menu for a user: entries of modules that are entitled and, for
   * commercial modules, actively installed, and that the user's permissions
   * allow. The order follows the manifest list.
   */
  async navigation(
    tenantId: string,
    permissionKeys: readonly PermissionKey[],
    now = new Date(),
  ): Promise<WorkspaceNavigation> {
    const [snapshot, records] = await Promise.all([
      this.entitlements.getSnapshot(tenantId, now),
      this.repository.list(tenantId),
    ]);
    const active = new Set(
      records.filter((record) => record.status === "ACTIVE").map((record) => record.moduleKey),
    );
    const usable = new Set(
      snapshot.modules
        .filter((module) => module.enabled && (module.kind === "CORE" || active.has(module.key)))
        .map((module) => module.key),
    );
    return workspaceNavigationSchema.parse({
      entries: this.manifests
        .navigationFor(usable, permissionKeys)
        .map((entry) => ({ moduleKey: entry.moduleKey, path: entry.path })),
    });
  }

  /**
   * Installs a module the workspace is entitled to. Calling it again for a
   * module that is installed, or being installed, changes nothing.
   */
  async install(tenantId: string, moduleKey: ModuleKey, context?: InstallationMutationContext) {
    const snapshot = await this.entitlements.getSnapshot(tenantId);
    const module = snapshot.modules.find((item) => item.key === moduleKey);
    if (!module) {
      throw new NotFoundException({ code: "MODULE_NOT_FOUND", message: "Module was not found." });
    }
    if (module.kind === "CORE") {
      throw conflict("MODULE_ALWAYS_INSTALLED", "Core modules are part of every workspace.");
    }
    if (!module.enabled) throw accessDenied("ENTITLEMENT_REQUIRED", { moduleKey });
    const manifest = this.manifests.get(moduleKey);
    if (!manifest) {
      throw conflict("MODULE_NOT_AVAILABLE", "This module is not available to install yet.", {
        moduleKey,
      });
    }

    const current = await this.repository.find(tenantId, moduleKey);
    if (current && isInstalled(current.status)) return toInstallation(current);
    if (current && !canMove(current.status, "PROVISIONING")) {
      throw this.invalidMove(current.status, "PROVISIONING", moduleKey);
    }

    const now = new Date();
    const provisioning = await this.repository.save(
      tenantId,
      moduleKey,
      current?.status ?? null,
      {
        configSchemaVersion: manifest.configSchemaVersion,
        errorMessage: null,
        provisionedAt: now,
        setupRequiredReason: null,
        status: "PROVISIONING",
        suspendedReason: null,
      },
      { action: "module_installation.provision", ...(context ? { context } : {}) },
    );
    // Someone else started the same installation a moment earlier: theirs stands.
    if (!provisioning) return this.current(tenantId, moduleKey);

    const requiredSteps = manifest.installSteps.filter((step) => step.required);
    const finished: InstallationChange =
      requiredSteps.length > 0
        ? {
            setupRequiredReason: requiredSteps.map((step) => step.label).join("; "),
            status: "SETUP_REQUIRED",
          }
        : { activatedAt: now, status: "ACTIVE" };
    const done = await this.repository.save(tenantId, moduleKey, "PROVISIONING", finished, {
      action: "module_installation.install",
      ...(context ? { context } : {}),
      event: { type: "module.installed.v1" },
    });
    if (!done) return this.current(tenantId, moduleKey);
    // The module starts reacting to other modules' events from now on.
    await this.bindings.ensureForModule(tenantId, moduleKey, context);
    return toInstallation(done);
  }

  /** Installs every entitled module that can be installed; safe to repeat. */
  async provisionEntitled(tenantId: string, context?: InstallationMutationContext) {
    const snapshot = await this.entitlements.getSnapshot(tenantId);
    const installable = snapshot.modules.filter(
      (module) => module.kind === "COMMERCIAL" && module.enabled && this.manifests.get(module.key),
    );
    const installed: ModuleInstallation[] = [];
    for (const module of installable) {
      const current = await this.repository.find(tenantId, module.key);
      // A module someone suspended or that failed is left for a person to decide on.
      if (current && !isInstalled(current.status) && !canMove(current.status, "PROVISIONING")) {
        continue;
      }
      installed.push(await this.install(tenantId, module.key, context));
    }
    return installed;
  }

  completeSetup(tenantId: string, moduleKey: ModuleKey, context?: InstallationMutationContext) {
    return this.move(tenantId, moduleKey, "module_installation.activate", context, () => ({
      activatedAt: new Date(),
      setupRequiredReason: null,
      status: "ACTIVE",
    }));
  }

  suspend(
    tenantId: string,
    moduleKey: ModuleKey,
    reason: string,
    context?: InstallationMutationContext,
  ) {
    return this.move(tenantId, moduleKey, "module_installation.suspend", context, () => ({
      status: "SUSPENDED",
      suspendedReason: reason,
    }));
  }

  resume(tenantId: string, moduleKey: ModuleKey, context?: InstallationMutationContext) {
    return this.move(tenantId, moduleKey, "module_installation.resume", context, (current) => {
      if (current.status !== "SUSPENDED")
        throw this.invalidMove(current.status, "ACTIVE", moduleKey);
      return { activatedAt: new Date(), status: "ACTIVE", suspendedReason: null };
    });
  }

  fail(
    tenantId: string,
    moduleKey: ModuleKey,
    message: string,
    context?: InstallationMutationContext,
  ) {
    return this.move(tenantId, moduleKey, "module_installation.fail", context, () => ({
      errorMessage: message,
      status: "ERROR",
    }));
  }

  /** Takes the module out of use. Its data and its installation row stay. */
  async uninstall(tenantId: string, moduleKey: ModuleKey, context?: InstallationMutationContext) {
    const removed = await this.move(
      tenantId,
      moduleKey,
      "module_installation.uninstall",
      context,
      () => ({
        errorMessage: null,
        setupRequiredReason: null,
        status: "NOT_INSTALLED",
        suspendedReason: null,
      }),
    );
    // A module that is not in use reacts to nothing.
    await this.bindings.disableForModule(tenantId, moduleKey, context);
    return removed;
  }

  private async move(
    tenantId: string,
    moduleKey: ModuleKey,
    action: string,
    context: InstallationMutationContext | undefined,
    decide: (current: InstallationRecord) => InstallationChange,
  ) {
    const current = await this.repository.find(tenantId, moduleKey);
    if (!current) {
      throw new NotFoundException({
        code: "MODULE_INSTALLATION_NOT_FOUND",
        message: "This module is not installed.",
      });
    }
    const change = decide(current);
    if (!canMove(current.status, change.status)) {
      throw this.invalidMove(current.status, change.status, moduleKey);
    }
    const saved = await this.repository.save(tenantId, moduleKey, current.status, change, {
      action,
      ...(context ? { context } : {}),
    });
    if (!saved) {
      throw conflict(
        "MODULE_INSTALLATION_CHANGED",
        "The installation changed in the meantime. Reload and try again.",
      );
    }
    return toInstallation(saved);
  }

  private async current(tenantId: string, moduleKey: ModuleKey) {
    const record = await this.repository.find(tenantId, moduleKey);
    return record ? toInstallation(record) : notInstalled(tenantId, moduleKey, new Date());
  }

  private invalidMove(
    from: ModuleInstallationStatus,
    to: ModuleInstallationStatus,
    moduleKey: ModuleKey,
  ) {
    return conflict(
      "MODULE_INSTALLATION_INVALID_TRANSITION",
      `An installation cannot go from ${from} to ${to}.`,
      { from, moduleKey, to },
    );
  }
}
