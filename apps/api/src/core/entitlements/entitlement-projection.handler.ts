import { MODULES } from "@merchant/contracts";
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { EVENT_HANDLER_REGISTRY, type EventHandlerRegistry } from "../events/public.js";
import { EntitlementService } from "./entitlement.service.js";

export const ENTITLEMENT_PROJECTION_CONSUMER = "core.entitlement_projection";

/**
 * Keeps `core_effective_entitlements` in step with installations: when a
 * module finishes installing, the workspace's projection is rebuilt.
 * Rebuilding is idempotent, so a repeated delivery is harmless.
 */
@Injectable()
export class EntitlementProjectionHandler implements OnModuleInit {
  constructor(
    @Inject(EVENT_HANDLER_REGISTRY) private readonly registry: EventHandlerRegistry,
    @Inject(EntitlementService) private readonly entitlements: EntitlementService,
  ) {}

  onModuleInit() {
    this.registry.register({
      consumerName: ENTITLEMENT_PROJECTION_CONSUMER,
      eventType: "module.installed.v1",
      handle: async (event) => {
        const rows = await this.entitlements.rebuildProjection(event.workspaceId);
        return `modules:${rows.length}`;
      },
      moduleKey: MODULES.coreSubscription,
    });
  }
}
