import { getPrismaClient } from "@merchant/database";
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { USAGE_GAUGE_REGISTRY, type UsageGaugeRegistry } from "../../shared/limits/limit-gate.js";

/** Reports how many people and custom roles a workspace has, for the package's limits. */
@Injectable()
export class AccessUsageGauges implements OnModuleInit {
  constructor(@Inject(USAGE_GAUGE_REGISTRY) private readonly registry: UsageGaugeRegistry) {}

  onModuleInit() {
    this.registry.register("core.users.active", async (tenantId) =>
      BigInt(
        await getPrismaClient().tenantMembership.count({ where: { status: "ACTIVE", tenantId } }),
      ),
    );
    // Roles the platform ships are not counted; only the ones a workspace made.
    this.registry.register("core.roles.custom", async (tenantId) =>
      BigInt(
        await getPrismaClient().role.count({
          where: { isSystem: false, status: "ACTIVE", tenantId },
        }),
      ),
    );
  }
}
