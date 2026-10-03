import assert from "node:assert/strict";
import test from "node:test";

import {
  MODULES,
  type EntitlementSnapshot,
  type ModuleInstallationStatus,
  type ModuleKey,
  type ModuleManifest,
} from "@merchant/contracts";
import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";

import { MODULE_MANIFESTS } from "../../module-manifests.js";
import type { EntitlementService } from "../entitlements/entitlement.service.js";
import { ModuleManifestRegistry } from "../manifest/module-manifest.registry.js";
import { canMove, isInstalled } from "./installation-lifecycle.js";
import type {
  InstallationChange,
  InstallationRecord,
  InstallationRepository,
} from "./installation.repository.js";
import { InstallationService } from "./installation.service.js";

const TENANT = "019f738d-e61f-7d46-92de-17b35f974001";
const ACTOR = "019f738d-e61f-7d46-92de-17b35f974002";

class MemoryInstallationRepository implements InstallationRepository {
  readonly rows = new Map<ModuleKey, InstallationRecord>();
  readonly actions: string[] = [];
  readonly events: string[] = [];
  /** Makes the next save lose the race, as if another request got there first. */
  loseNextSave = false;

  async find(_tenantId: string, moduleKey: ModuleKey) {
    return this.rows.get(moduleKey) ?? null;
  }

  async list() {
    return [...this.rows.values()];
  }

  async save(
    tenantId: string,
    moduleKey: ModuleKey,
    expected: ModuleInstallationStatus | null,
    change: InstallationChange,
    options: { action: string; event?: { type: string } },
  ) {
    if (this.loseNextSave) {
      this.loseNextSave = false;
      return null;
    }
    const current = this.rows.get(moduleKey);
    if ((current?.status ?? null) !== expected) return null;
    const next: InstallationRecord = {
      activatedAt: null,
      configSchemaVersion: 1,
      errorMessage: null,
      id: `installation-${moduleKey}`,
      provisionedAt: null,
      setupRequiredReason: null,
      suspendedReason: null,
      ...current,
      ...change,
      moduleKey,
      tenantId,
      updatedAt: new Date(),
    };
    this.rows.set(moduleKey, next);
    this.actions.push(options.action);
    if (options.event) this.events.push(options.event.type);
    return next;
  }
}

function setup({
  enabled = [MODULES.pos],
  manifests = MODULE_MANIFESTS,
}: { enabled?: ModuleKey[]; manifests?: readonly ModuleManifest[] } = {}) {
  const repository = new MemoryInstallationRepository();
  const modules = [
    { key: MODULES.pos, kind: "COMMERCIAL" },
    { key: MODULES.kds, kind: "COMMERCIAL" },
    { key: MODULES.coreCatalog, kind: "CORE" },
  ].map((item) => ({ ...item, enabled: item.kind === "CORE" || enabled.includes(item.key) }));
  const entitlements = {
    getSnapshot: async () => ({ modules, subscription: null }) as unknown as EntitlementSnapshot,
  } as unknown as EntitlementService;
  return {
    repository,
    service: new InstallationService(
      repository,
      entitlements,
      new ModuleManifestRegistry(manifests),
    ),
  };
}

async function codeOf(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    if (
      error instanceof ConflictException ||
      error instanceof ForbiddenException ||
      error instanceof NotFoundException
    ) {
      return (error.getResponse() as { code: string }).code;
    }
    throw error;
  }
  return "OK";
}

test("the lifecycle only allows the moves the architecture describes", () => {
  const allowed: Array<[ModuleInstallationStatus, ModuleInstallationStatus]> = [
    ["NOT_INSTALLED", "PROVISIONING"],
    ["PROVISIONING", "SETUP_REQUIRED"],
    ["PROVISIONING", "ACTIVE"],
    ["SETUP_REQUIRED", "ACTIVE"],
    ["ACTIVE", "SUSPENDED"],
    ["SUSPENDED", "ACTIVE"],
    ["SUSPENDED", "ERROR"],
    ["ERROR", "PROVISIONING"],
    ["ACTIVE", "NOT_INSTALLED"],
  ];
  for (const [from, to] of allowed) assert.equal(canMove(from, to), true, `${from} -> ${to}`);

  const refused: Array<[ModuleInstallationStatus, ModuleInstallationStatus]> = [
    ["NOT_INSTALLED", "ACTIVE"],
    ["NOT_INSTALLED", "SUSPENDED"],
    ["ACTIVE", "PROVISIONING"],
    ["SUSPENDED", "PROVISIONING"],
    ["ERROR", "ACTIVE"],
    ["SETUP_REQUIRED", "SUSPENDED"],
  ];
  for (const [from, to] of refused) assert.equal(canMove(from, to), false, `${from} -> ${to}`);
  assert.equal(isInstalled("SETUP_REQUIRED"), true);
  assert.equal(isInstalled("SUSPENDED"), false);
});

test("installing an entitled module provisions it, activates it, and announces it once", async () => {
  const { repository, service } = setup();
  const installed = await service.install(TENANT, MODULES.pos, { actorId: ACTOR });

  assert.equal(installed.status, "ACTIVE");
  assert.ok(installed.provisionedAt && installed.activatedAt);
  assert.deepEqual(repository.actions, [
    "module_installation.provision",
    "module_installation.install",
  ]);
  assert.deepEqual(repository.events, ["module.installed.v1"]);

  // Installing again is a no-op: no new audit entry, no second event.
  const again = await service.install(TENANT, MODULES.pos, { actorId: ACTOR });
  assert.equal(again.status, "ACTIVE");
  assert.equal(repository.actions.length, 2);
  assert.equal(repository.events.length, 1);
});

test("a module with required setup steps waits in SETUP_REQUIRED until setup is completed", async () => {
  const pos = MODULE_MANIFESTS.find((item) => item.key === MODULES.pos)!;
  const withSteps = MODULE_MANIFESTS.map((item) =>
    item.key === MODULES.pos
      ? {
          ...pos,
          installSteps: [
            { key: "pos.setup.register", label: "Name the first register", required: true },
            { key: "pos.setup.receipt", label: "Choose a receipt size", required: false },
          ],
        }
      : item,
  );
  const { service } = setup({ manifests: withSteps });

  const installed = await service.install(TENANT, MODULES.pos);
  assert.equal(installed.status, "SETUP_REQUIRED");
  assert.equal(installed.setupRequiredReason, "Name the first register");
  assert.equal(installed.activatedAt, null);

  const active = await service.completeSetup(TENANT, MODULES.pos);
  assert.equal(active.status, "ACTIVE");
  assert.equal(active.setupRequiredReason, null);
});

test("what cannot be installed is refused with its own reason", async () => {
  const { service } = setup();
  // Not part of the subscription.
  assert.equal(await codeOf(() => service.install(TENANT, MODULES.kds)), "ENTITLEMENT_REQUIRED");
  // Core modules are never installed one by one.
  assert.equal(
    await codeOf(() => service.install(TENANT, MODULES.coreCatalog)),
    "MODULE_ALWAYS_INSTALLED",
  );
  // Unknown to this workspace.
  assert.equal(
    await codeOf(() => service.install(TENANT, MODULES.financeBasic)),
    "MODULE_NOT_FOUND",
  );

  // Entitled, but the module has not been built yet.
  const entitledToKds = setup({ enabled: [MODULES.kds] });
  assert.equal(
    await codeOf(() => entitledToKds.service.install(TENANT, MODULES.kds)),
    "MODULE_NOT_AVAILABLE",
  );
});

test("suspending keeps the installation and resuming reuses it", async () => {
  const { repository, service } = setup();
  await service.install(TENANT, MODULES.pos);
  const id = repository.rows.get(MODULES.pos)?.id;

  const suspended = await service.suspend(TENANT, MODULES.pos, "Unpaid invoice");
  assert.equal(suspended.status, "SUSPENDED");
  assert.equal(suspended.suspendedReason, "Unpaid invoice");
  // A suspended module is not quietly reinstalled.
  assert.equal(
    await codeOf(() => service.install(TENANT, MODULES.pos)),
    "MODULE_INSTALLATION_INVALID_TRANSITION",
  );

  const resumed = await service.resume(TENANT, MODULES.pos);
  assert.equal(resumed.status, "ACTIVE");
  assert.equal(resumed.suspendedReason, null);
  assert.equal(repository.rows.get(MODULES.pos)?.id, id);
});

test("uninstalling keeps the row, and installing again goes through provisioning", async () => {
  const { repository, service } = setup();
  await service.install(TENANT, MODULES.pos);

  const removed = await service.uninstall(TENANT, MODULES.pos);
  assert.equal(removed.status, "NOT_INSTALLED");
  assert.equal(repository.rows.size, 1);

  const back = await service.install(TENANT, MODULES.pos);
  assert.equal(back.status, "ACTIVE");
  assert.deepEqual(repository.events, ["module.installed.v1", "module.installed.v1"]);
});

test("a failed installation can be retried, and moves that make no sense are refused", async () => {
  const { service } = setup();
  assert.equal(
    await codeOf(() => service.suspend(TENANT, MODULES.pos, "x")),
    "MODULE_INSTALLATION_NOT_FOUND",
  );

  await service.install(TENANT, MODULES.pos);
  const failed = await service.fail(TENANT, MODULES.pos, "Provisioning the register failed");
  assert.equal(failed.status, "ERROR");
  assert.equal(failed.errorMessage, "Provisioning the register failed");
  assert.equal(
    await codeOf(() => service.resume(TENANT, MODULES.pos)),
    "MODULE_INSTALLATION_INVALID_TRANSITION",
  );

  const retried = await service.install(TENANT, MODULES.pos);
  assert.equal(retried.status, "ACTIVE");
  assert.equal(retried.errorMessage, null);
});

test("two requests installing the same module end with one installation", async () => {
  const { repository, service } = setup();
  repository.loseNextSave = true;
  // The other request has not written anything visible yet: report what is there.
  const lost = await service.install(TENANT, MODULES.pos);
  assert.equal(lost.status, "NOT_INSTALLED");
  assert.deepEqual(repository.actions, []);

  const won = await service.install(TENANT, MODULES.pos);
  assert.equal(won.status, "ACTIVE");
  assert.equal(repository.rows.size, 1);
});

test("a move decided on stale information is refused instead of overwriting", async () => {
  const { repository, service } = setup();
  await service.install(TENANT, MODULES.pos);
  repository.loseNextSave = true;
  assert.equal(
    await codeOf(() => service.suspend(TENANT, MODULES.pos, "Unpaid")),
    "MODULE_INSTALLATION_CHANGED",
  );
  assert.equal(repository.rows.get(MODULES.pos)?.status, "ACTIVE");
});

test("provisioning a workspace installs what it is entitled to and can be repeated", async () => {
  const { repository, service } = setup({ enabled: [MODULES.pos, MODULES.kds] });

  // KDS is entitled but has no code yet, so only POS is installed.
  const first = await service.provisionEntitled(TENANT);
  assert.deepEqual(
    first.map((item) => `${item.moduleKey}:${item.status}`),
    ["POS:ACTIVE"],
  );
  const second = await service.provisionEntitled(TENANT);
  assert.deepEqual(
    second.map((item) => item.status),
    ["ACTIVE"],
  );
  assert.equal(repository.events.length, 1);

  // A module someone suspended is left alone.
  await service.suspend(TENANT, MODULES.pos, "Unpaid invoice");
  assert.deepEqual(await service.provisionEntitled(TENANT), []);
  assert.equal(repository.rows.get(MODULES.pos)?.status, "SUSPENDED");
});

test("the list shows entitled modules that are not installed yet", async () => {
  const { service } = setup({ enabled: [MODULES.pos, MODULES.kds] });
  await service.install(TENANT, MODULES.pos);

  const list = await service.list(TENANT);
  assert.deepEqual(
    list.map((item) => `${item.moduleKey}:${item.status}`),
    ["POS:ACTIVE", "KDS:NOT_INSTALLED"],
  );
});
