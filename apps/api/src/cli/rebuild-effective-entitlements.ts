/**
 * Rebuilds `core_effective_entitlements` for every tenant from subscriptions,
 * package versions, and overrides. Safe to run at any time.
 *
 * Usage: pnpm --filter @merchant/api entitlements:rebuild
 */
import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "../app.module.js";
import { EntitlementService } from "../core/entitlements/public.js";

async function rebuildEffectiveEntitlements() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const tenants = await app.get(EntitlementService).rebuildAllProjections();
    process.stdout.write(`Effective entitlements rebuilt for ${tenants} tenant(s).\n`);
  } finally {
    await app.close();
  }
}

void rebuildEffectiveEntitlements();
