import "reflect-metadata";

import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";

import { MODULES, PLAN_CODES } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { NestFactory } from "@nestjs/core";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";

const dimension = "kds.intake_sources.active";
const code = (error) => error?.getResponse?.()?.code;

test("KDS intake limits follow immutable packages and overrides without revoking existing sources", async () => {
  await withDisposablePostgres(async ({ connectionString, database }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    const { AppModule } = await import("../src/app.module.ts");
    const { EntitlementService } = await import("../src/core/entitlements/public.ts");
    const { PlatformMasterService } =
      await import("../src/core/platform/platform-master.service.ts");
    const { IntakeSources } = await import("../src/modules/kds/application/intake-sources.ts");
    const { IntakeKitchenTicket } =
      await import("../src/modules/kds/application/intake-kitchen-ticket.ts");
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error"] });
    try {
      const platform = app.get(PlatformMasterService);
      const entitlements = app.get(EntitlementService);
      const manage = app.get(IntakeSources);
      const intake = app.get(IntakeKitchenTicket);
      const actor = await db.user.create({
        data: {
          displayName: "Operator test",
          email: "operator@limits.test",
          passwordHash: "not-a-login",
        },
      });
      const origin = { actorId: actor.id, channel: "API" };
      const startsAt = new Date(Date.now() - 60_000).toISOString();
      const subscribe = (tenantId, planCode) =>
        platform.replaceSubscription(tenantId, { planCode, startsAt, status: "ACTIVE" }, origin);
      const business = async (slug) => {
        const tenant = await platform.createTenant({ name: slug, slug }, origin);
        await subscribe(tenant.id, PLAN_CODES.kdsOnly);
        const brand = await db.brand.create({ data: { tenantId: tenant.id, name: slug, slug } });
        const outlet = await db.outlet.create({
          data: {
            tenantId: tenant.id,
            brandId: brand.id,
            code: "MAIN",
            name: "Main",
            timezone: "Asia/Jakarta",
          },
        });
        return { tenantId: tenant.id, outletId: outlet.id };
      };
      const one = await business("kitchen-one");
      const two = await business("kitchen-two");
      const make = (at, label) =>
        manage.create(at.tenantId, { label, outletId: at.outletId }, origin);
      const limit = async (tenantId) =>
        (await entitlements.limitsInForce(tenantId)).limits.find(
          (item) => item.dimensionKey === dimension,
        );

      // The old snapshots are still present. Successors copy the entire old
      // composition, changing only this one dimension, and stay immutable.
      for (const key of [
        PLAN_CODES.profile,
        PLAN_CODES.posBasic,
        PLAN_CODES.cafeDigital,
        PLAN_CODES.cafeOperations,
      ]) {
        const pkg = await db.corePackage.findUniqueOrThrow({ where: { key } });
        const versions = await db.corePackageVersion.findMany({
          where: { packageId: pkg.id },
          orderBy: { version: "asc" },
        });
        assert.equal(versions.length, 2);
        const [old, current] = versions;
        for (const [table, columns] of [
          ["core_package_modules", "module_key, tier"],
          ["core_package_capabilities", "capability_key, included"],
          ["core_package_limits", "dimension_key, value, unlimited"],
        ]) {
          const read = async (id) =>
            (
              await database.query(
                `SELECT ${columns} FROM ${table} WHERE package_version_id = $1 ${table.endsWith("limits") ? "AND dimension_key <> 'kds.intake_sources.active'" : ""} ORDER BY 1`,
                [id],
              )
            ).rows;
          assert.deepEqual(await read(current.id), await read(old.id));
        }
        assert.equal(
          await db.corePackageLimit.count({
            where: { packageVersionId: old.id, dimensionKey: dimension },
          }),
          0,
        );
        const currentLimit = await db.corePackageLimit.findUniqueOrThrow({
          where: {
            packageVersionId_dimensionKey: {
              packageVersionId: current.id,
              dimensionKey: dimension,
            },
          },
        });
        assert.equal(currentLimit.value, 0n);
        await assert.rejects(
          database.query(
            "UPDATE core_package_limits SET value = 99 WHERE package_version_id = $1 AND dimension_key = $2",
            [current.id, dimension],
          ),
          /cannot be changed/,
        );
      }

      const access = await entitlements.getSnapshot(one.tenantId);
      assert.equal(access.subscription.planCode, PLAN_CODES.kdsOnly);
      assert.equal(access.modules.find((item) => item.key === MODULES.kds).enabled, true);
      assert.equal(access.modules.find((item) => item.key === MODULES.pos).enabled, false);
      assert.equal((await limit(one.tenantId)).value, 1n);
      // Two owners racing for the one place cannot exceed the real limit.
      const racing = await Promise.allSettled([make(one, "First"), make(one, "Racing")]);
      const accepted = racing.filter((result) => result.status === "fulfilled");
      const refused = racing.filter((result) => result.status === "rejected");
      assert.equal(accepted.length, 1);
      assert.equal(refused.length, 1);
      assert.equal(code(refused[0].reason), "LIMIT_REACHED");
      const first = accepted[0].value;
      assert.equal(
        await db.auditLog.count({
          where: { tenantId: one.tenantId, action: "kds.intake_source.create" },
        }),
        1,
      );
      await assert.rejects(make(one, "Second"), (error) => code(error) === "LIMIT_REACHED");
      await make(two, "Other workspace");
      await assert.rejects(
        manage.create(one.tenantId, { label: "Other outlet", outletId: two.outletId }, origin),
        (error) => code(error) === "OUTLET_NOT_FOUND",
      );
      await assert.rejects(
        manage.revoke(two.tenantId, first.source.id, origin),
        (error) => code(error) === "KDS_INTAKE_SOURCE_NOT_FOUND",
      );

      // Explicit capacity overrides are tenant-scoped. A later downgrade
      // to a bundle with zero external sources refuses only new sources.
      const override = await db.coreEntitlementOverride.create({
        data: {
          tenantId: one.tenantId,
          targetType: "LIMIT",
          targetKey: dimension,
          operation: "REPLACE",
          value: 2n,
          reason: "Test two allowed sources",
          startsAt: new Date(Date.now() - 60_000),
        },
      });
      const second = await make(one, "Second");
      assert.equal((await limit(two.tenantId)).value, 1n);
      await db.coreEntitlementOverride.update({
        where: { id: override.id },
        data: { endsAt: new Date() },
      });
      await subscribe(one.tenantId, PLAN_CODES.cafeDigital);
      assert.equal((await limit(one.tenantId)).value, 0n);
      assert.equal(
        (await manage.list(one.tenantId)).filter((item) => item.status === "ACTIVE").length,
        2,
      );
      await assert.rejects(make(one, "Third"), (error) => {
        assert.equal(code(error), "LIMIT_REACHED");
        assert.deepEqual(error.getResponse().details, {
          dimensionKey: dimension,
          limit: "0",
          usage: "2",
        });
        return true;
      });
      const caller = await intake.authenticate(`Bearer ${second.key}`);
      assert.equal(
        (
          await intake.execute(caller, {
            reference: "after-downgrade",
            orderLabel: "Still works",
            items: [{ name: "Latte", quantity: 1 }],
          })
        ).created,
        true,
      );

      // Return to KDS-only: the same sources and ticket history remain.
      await subscribe(one.tenantId, PLAN_CODES.kdsOnly);
      await manage.revoke(one.tenantId, first.source.id, origin);
      await assert.rejects(make(one, "Full"), (error) => code(error) === "LIMIT_REACHED");
      await manage.revoke(one.tenantId, second.source.id, origin);
      await make(one, "Replacement");
      assert.equal(await db.kdsTicket.count({ where: { tenantId: one.tenantId } }), 1);
      assert.equal((await manage.list(one.tenantId)).length, 3);
    } finally {
      await app.close();
      await db.$disconnect();
      delete globalThis.prisma;
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
