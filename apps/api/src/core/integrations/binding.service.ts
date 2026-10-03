import {
  integrationBindingSchema,
  type IntegrationBinding,
  type IntegrationBindingStatus,
  type ModuleKey,
} from "@merchant/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import type {
  BindingDecision,
  BindingGate,
  EventEnvelope,
  EventHandler,
} from "../events/public.js";
import { MODULE_MANIFEST_REGISTRY, type ModuleManifestRegistry } from "../manifest/public.js";
import {
  BINDING_REPOSITORY,
  type BindingKey,
  type BindingMutationContext,
  type BindingRecord,
  type BindingRepository,
} from "./binding.repository.js";

function toBinding(record: BindingRecord): IntegrationBinding {
  return integrationBindingSchema.parse({
    auditReason: record.auditReason,
    configSchemaVersion: record.configSchemaVersion,
    effectiveFrom: record.effectiveFrom.toISOString(),
    effectiveTo: record.effectiveTo?.toISOString() ?? null,
    eventType: record.eventType,
    handlerKey: record.handlerKey,
    health: record.health,
    id: record.id,
    lastError: record.lastError,
    sourceModuleKey: record.sourceModuleKey,
    status: record.status,
    targetModuleKey: record.targetModuleKey,
    updatedAt: record.updatedAt.toISOString(),
    workspaceId: record.tenantId,
  });
}

/** What a person reads when a binding holds an event back. No payload, no secrets. */
const HELD_REASON: Partial<Record<IntegrationBindingStatus, string>> = {
  ERROR: "The integration is in an error state.",
  PAUSED: "The integration is paused.",
  SETUP_REQUIRED: "The integration is not set up yet.",
};

/**
 * Integration bindings of a workspace (architecture.md 6.2): which module
 * reacts to which event of another module, and whether that is switched on.
 */
@Injectable()
export class BindingService implements BindingGate {
  constructor(
    @Inject(BINDING_REPOSITORY) private readonly repository: BindingRepository,
    @Inject(MODULE_MANIFEST_REGISTRY) private readonly manifests: ModuleManifestRegistry,
  ) {}

  async list(tenantId: string): Promise<IntegrationBinding[]> {
    return (await this.repository.list(tenantId)).map(toBinding);
  }

  /**
   * The module that announces an event type, or undefined when no manifest
   * declares it.
   */
  private sourceOf(eventType: string): ModuleKey | undefined {
    return this.manifests.all().find((item) => item.eventsProduced.includes(eventType))?.key;
  }

  /** The binding a handler needs, or undefined when it reacts to its own module. */
  private keyFor(handler: Pick<EventHandler, "consumerName" | "eventType" | "moduleKey">) {
    const source = this.sourceOf(handler.eventType);
    if (!source || source === handler.moduleKey) return undefined;
    return {
      eventType: handler.eventType,
      handlerKey: handler.consumerName,
      sourceModuleKey: source,
      targetModuleKey: handler.moduleKey,
    } satisfies BindingKey;
  }

  /**
   * Gives a module that was just installed its bindings: one per event of
   * another module it reacts to, active from `now` on, so events from before
   * the installation are not replayed. Bindings that were switched off when
   * the module was removed come back on, again only for new events.
   */
  async ensureForModule(
    tenantId: string,
    moduleKey: ModuleKey,
    context?: BindingMutationContext,
    now = new Date(),
  ) {
    const manifest = this.manifests.get(moduleKey);
    for (const declared of manifest?.eventHandlers ?? []) {
      const key = this.keyFor({
        consumerName: declared.handlerKey,
        eventType: declared.eventType,
        moduleKey,
      });
      if (!key) continue;
      if (await this.repository.createIfMissing(tenantId, key, now)) continue;
      const existing = await this.repository.find(tenantId, key);
      if (existing?.status === "DISABLED") {
        await this.repository.setStatus(
          tenantId,
          existing.id,
          "DISABLED",
          { effectiveFrom: now, health: "HEALTHY", lastError: null, status: "ACTIVE" },
          { action: "integration_binding.enable", ...(context ? { context } : {}) },
        );
      }
    }
    return (await this.repository.listForTarget(tenantId, moduleKey)).map(toBinding);
  }

  /** Switches off every binding of a module that is taken out of use. Nothing is deleted. */
  async disableForModule(tenantId: string, moduleKey: ModuleKey, context?: BindingMutationContext) {
    for (const binding of await this.repository.listForTarget(tenantId, moduleKey)) {
      if (binding.status === "DISABLED") continue;
      await this.repository.setStatus(
        tenantId,
        binding.id,
        binding.status,
        { status: "DISABLED" },
        { action: "integration_binding.disable", ...(context ? { context } : {}) },
      );
    }
  }

  /** Stops deliveries through a binding until it is resumed; held events can be retried later. */
  pause(tenantId: string, id: string, reason: string, context?: BindingMutationContext) {
    return this.move(tenantId, id, ["ACTIVE"], "integration_binding.pause", context, {
      auditReason: reason,
      status: "PAUSED",
    });
  }

  resume(tenantId: string, id: string, context?: BindingMutationContext) {
    return this.move(tenantId, id, ["PAUSED", "ERROR"], "integration_binding.resume", context, {
      auditReason: null,
      health: "HEALTHY",
      lastError: null,
      status: "ACTIVE",
    });
  }

  private async move(
    tenantId: string,
    id: string,
    from: readonly IntegrationBindingStatus[],
    action: string,
    context: BindingMutationContext | undefined,
    change: Parameters<BindingRepository["setStatus"]>[3],
  ) {
    const current = await this.repository.findById(tenantId, id);
    if (!current) {
      throw new NotFoundException({
        code: "INTEGRATION_BINDING_NOT_FOUND",
        message: "This integration was not found.",
      });
    }
    if (!from.includes(current.status)) {
      throw new ConflictException({
        code: "INTEGRATION_BINDING_INVALID_TRANSITION",
        details: { from: current.status, to: change.status },
        message: `An integration cannot go from ${current.status} to ${change.status}.`,
      });
    }
    const saved = await this.repository.setStatus(tenantId, id, current.status, change, {
      action,
      ...(context ? { context } : {}),
    });
    if (!saved) {
      throw new ConflictException({
        code: "INTEGRATION_BINDING_CHANGED",
        message: "The integration changed in the meantime. Reload and try again.",
      });
    }
    return toBinding(saved);
  }

  // ---- BindingGate, used by the outbox dispatcher

  async decide(handler: EventHandler, event: EventEnvelope): Promise<BindingDecision> {
    const key = this.keyFor(handler);
    // A reaction inside one module is not an integration between modules.
    if (!key) return { action: "run" };

    const binding = await this.repository.find(event.workspaceId, key);
    if (!binding || binding.status === "DISABLED" || binding.status === "DRAFT") {
      return { action: "skip" };
    }
    // Adding a module never processes what happened before it was added.
    if (event.occurredAt < binding.effectiveFrom) return { action: "skip" };
    if (binding.effectiveTo && event.occurredAt >= binding.effectiveTo) return { action: "skip" };

    const held = HELD_REASON[binding.status];
    return held ? { action: "block", reason: held } : { action: "run" };
  }

  async report(
    handler: EventHandler,
    event: EventEnvelope,
    result: { blockedReason?: string; ok: boolean },
  ) {
    const key = this.keyFor(handler);
    if (!key) return;
    const binding = await this.repository.find(event.workspaceId, key);
    if (!binding) return;
    if (result.ok) {
      if (binding.health !== "HEALTHY")
        await this.repository.setHealth(binding.id, "HEALTHY", null);
    } else {
      await this.repository.setHealth(
        binding.id,
        "BLOCKED",
        result.blockedReason ?? "The last delivery was blocked.",
      );
    }
  }
}
