import "reflect-metadata";

import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";

import { MODULES, PLAN_CODES } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { NestFactory } from "@nestjs/core";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";

const code = (error) => error?.getResponse?.()?.code;

test("a smaller package, a suspension, and a full limit take access away and never data", async () => {
  await withDisposablePostgres(async ({ connectionString, database }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    // The whole API without its HTTP server, as the worker runs it.
    const { AppModule } = await import("../src/app.module.ts");
    const { CatalogService } = await import("../src/kernels/catalog/public.ts");
    const { EntitlementService } = await import("../src/core/entitlements/public.ts");
    const { PlatformMasterService } =
      await import("../src/core/platform/platform-master.service.ts");
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error"] });
    try {
      const platform = app.get(PlatformMasterService);
      const catalog = app.get(CatalogService);
      const entitlements = app.get(EntitlementService);
      const context = { actorId: undefined };
      const startsAt = new Date(Date.now() - 60_000).toISOString();
      const subscribe = (tenantId, planCode, status = "ACTIVE") =>
        platform.replaceSubscription(tenantId, { planCode, startsAt, status }, context);
      const entitled = async (tenantId, moduleKey) =>
        (await entitlements.describeAccess(tenantId, moduleKey)).module?.entitled === true;
      const counts = async (tenantId) =>
        (
          await database.query(
            `SELECT (SELECT count(*)::int FROM products WHERE tenant_id = $1) AS products,
                    (SELECT count(*)::int FROM categories WHERE tenant_id = $1) AS categories,
                    (SELECT count(*)::int FROM core_module_installations WHERE tenant_id = $1) AS installations,
                    (SELECT count(*)::int FROM subscriptions WHERE tenant_id = $1) AS subscriptions,
                    (SELECT count(*)::int FROM audit_logs WHERE tenant_id = $1) AS audits`,
            [tenantId],
          )
        ).rows[0];

      const tenant = await platform.createTenant(
        { name: "Kopi Turun", slug: "kopi-turun" },
        context,
      );
      await subscribe(tenant.id, PLAN_CODES.cafeOperations);
      assert.equal(await entitled(tenant.id, MODULES.pos), true);

      const category = await catalog.createCategory(tenant.id, {
        name: "Minuman",
        slug: "minuman",
      });
      for (const slug of ["kopi", "teh"]) {
        await catalog.createProduct(tenant.id, {
          basePriceMinor: "25000",
          categoryId: category.id,
          name: slug,
          slug,
        });
      }
      const before = await counts(tenant.id);
      assert.deepEqual([before.products, before.categories], [2, 1]);
      assert.ok(before.installations > 0, "the package's modules were installed");

      // Downgrade: the cashier module is no longer part of the package.
      await subscribe(tenant.id, PLAN_CODES.profile);
      assert.equal(await entitled(tenant.id, MODULES.pos), false);
      const downgraded = await counts(tenant.id);
      assert.deepEqual(
        [downgraded.products, downgraded.categories, downgraded.installations],
        [before.products, before.categories, before.installations],
        "nothing the business recorded was removed",
      );
      assert.ok(downgraded.subscriptions >= 2, "the earlier subscription is kept as history");
      assert.ok(downgraded.audits >= before.audits, "the audit trail only grows");

      // Back on the larger package, the same data and installations are in use again.
      await subscribe(tenant.id, PLAN_CODES.cafeOperations);
      assert.equal(await entitled(tenant.id, MODULES.pos), true);
      assert.equal((await counts(tenant.id)).installations, before.installations);
      assert.equal((await catalog.getSnapshot(tenant.id)).products.length, 2);

      // Suspension: no access at all, and still nothing is deleted.
      await subscribe(tenant.id, PLAN_CODES.cafeOperations, "SUSPENDED");
      assert.equal((await entitlements.describeAccess(tenant.id)).subscriptionUsable, false);
      const suspended = await counts(tenant.id);
      assert.deepEqual(
        [suspended.products, suspended.installations],
        [before.products, before.installations],
      );
      await subscribe(tenant.id, PLAN_CODES.cafeOperations);

      // A hard limit below what already exists: the next one is refused with
      // the numbers, and everything that exists keeps working.
      await db.coreEntitlementOverride.create({
        data: {
          operation: "REPLACE",
          reason: "integration test: one product allowed",
          startsAt: new Date(Date.now() - 60_000),
          targetKey: "catalog.products.active",
          targetType: "LIMIT",
          tenantId: tenant.id,
          value: 1n,
        },
      });
      await entitlements.rebuildProjection(tenant.id);
      await assert.rejects(
        catalog.createProduct(tenant.id, {
          basePriceMinor: "1000",
          categoryId: category.id,
          name: "susu",
          slug: "susu",
        }),
        (error) => {
          assert.equal(code(error), "LIMIT_REACHED");
          assert.deepEqual(error.getResponse().details, {
            dimensionKey: "catalog.products.active",
            limit: "1",
            usage: "2",
          });
          return true;
        },
      );
      const limited = await catalog.getSnapshot(tenant.id);
      assert.deepEqual(
        limited.products.map((product) => [product.slug, product.status]).sort(),
        [
          ["kopi", "ACTIVE"],
          ["teh", "ACTIVE"],
        ],
        "both products above the limit stay active",
      );
      // What exists can still be changed.
      const kopi = limited.products.find((product) => product.slug === "kopi");
      const renamed = await catalog.updateProduct(tenant.id, kopi.id, { name: "Kopi Susu" });
      assert.equal(renamed.name, "Kopi Susu");
    } finally {
      await app.close();
      await db.$disconnect();
      delete globalThis.prisma;
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
