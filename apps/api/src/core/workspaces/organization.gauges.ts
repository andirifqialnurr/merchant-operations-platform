import { getPrismaClient } from "@merchant/database";
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { USAGE_GAUGE_REGISTRY, type UsageGaugeRegistry } from "../../shared/limits/limit-gate.js";

/** Reports how many brands and outlets a workspace runs, for the package's limits. */
@Injectable()
export class OrganizationUsageGauges implements OnModuleInit {
  constructor(@Inject(USAGE_GAUGE_REGISTRY) private readonly registry: UsageGaugeRegistry) {}

  onModuleInit() {
    this.registry.register("core.business_units.active", async (tenantId) =>
      BigInt(await getPrismaClient().brand.count({ where: { status: "ACTIVE", tenantId } })),
    );
    this.registry.register("core.locations.active", async (tenantId) =>
      BigInt(await getPrismaClient().outlet.count({ where: { status: "ACTIVE", tenantId } })),
    );
  }
}
