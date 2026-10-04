import { getPrismaClient } from "@merchant/database";
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { USAGE_GAUGE_REGISTRY, type UsageGaugeRegistry } from "../shared/limits/limit-gate.js";

/** Reports how many products a workspace sells, for the package's product limit. */
@Injectable()
export class CatalogUsageGauges implements OnModuleInit {
  constructor(@Inject(USAGE_GAUGE_REGISTRY) private readonly registry: UsageGaugeRegistry) {}

  onModuleInit() {
    this.registry.register("catalog.products.active", async (tenantId) =>
      BigInt(
        await getPrismaClient().catalogProduct.count({ where: { status: "ACTIVE", tenantId } }),
      ),
    );
  }
}
