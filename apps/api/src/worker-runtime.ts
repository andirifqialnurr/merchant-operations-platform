/**
 * The API's use cases without the HTTP server, for the worker process
 * (backend.md 11): same modules, same repositories, no copy of the logic.
 */
import "reflect-metadata";

import type { ModuleKey } from "@merchant/contracts";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { EntitlementService } from "./core/entitlements/public.js";
import {
  DEFAULT_DISPATCHER_OPTIONS,
  EVENT_HANDLER_REGISTRY,
  OutboxDispatcher,
  PrismaInboxStore,
  PrismaOutboxStore,
  type DispatcherOptions,
  type EventHandlerRegistry,
} from "./core/events/public.js";
import { BindingService } from "./core/integrations/public.js";
import { MODULE_MANIFEST_REGISTRY, type ModuleManifestRegistry } from "./core/manifest/public.js";

export type WorkerRuntime = {
  close(): Promise<void>;
  /** Delivers one batch of outbox events; returns how many were taken. */
  dispatchBatch(): Promise<number>;
  /** Names of the registered event handlers, for the start-up log. */
  handlerNames: string[];
};

/**
 * Every handler a manifest declares must be registered in code and the other
 * way round; otherwise an event would silently go nowhere, or code would
 * react to something its module never said it listens to.
 */
function assertHandlersMatchManifests(
  handlers: EventHandlerRegistry,
  manifests: ModuleManifestRegistry,
) {
  const declared = new Set(
    manifests
      .all()
      .flatMap((manifest) =>
        manifest.eventHandlers.map(
          (item) => `${manifest.key} ${item.eventType} ${item.handlerKey}`,
        ),
      ),
  );
  const registered = new Set(
    handlers.all().map((item) => `${item.moduleKey} ${item.eventType} ${item.consumerName}`),
  );
  const missing = [...declared].filter((item) => !registered.has(item));
  const undeclared = [...registered].filter((item) => !declared.has(item));
  if (missing.length > 0 || undeclared.length > 0) {
    throw new Error(
      `Event handlers and manifests disagree. Declared but not registered: ${missing.join(", ") || "none"}. Registered but not declared: ${undeclared.join(", ") || "none"}.`,
    );
  }
}

export async function createWorkerRuntime(
  options: DispatcherOptions = DEFAULT_DISPATCHER_OPTIONS,
): Promise<WorkerRuntime> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
  const handlers = app.get<EventHandlerRegistry>(EVENT_HANDLER_REGISTRY);
  assertHandlersMatchManifests(handlers, app.get<ModuleManifestRegistry>(MODULE_MANIFEST_REGISTRY));

  const entitlements = app.get(EntitlementService);
  const isModuleAvailable = async (workspaceId: string, moduleKey: ModuleKey) => {
    const access = await entitlements.describeAccess(workspaceId, moduleKey);
    return (
      access.subscriptionUsable &&
      access.module?.entitled === true &&
      (access.installation === undefined || access.installation === "ACTIVE")
    );
  };
  const dispatcher = new OutboxDispatcher(
    new PrismaOutboxStore(),
    new PrismaInboxStore(),
    handlers,
    isModuleAvailable,
    options,
    undefined,
    app.get(BindingService),
  );

  return {
    close: () => app.close(),
    dispatchBatch: () => dispatcher.dispatchBatch(),
    handlerNames: handlers.all().map((item) => item.consumerName),
  };
}
