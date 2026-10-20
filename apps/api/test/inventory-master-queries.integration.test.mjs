import "reflect-metadata";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import process from "node:process";
import test from "node:test";

import { PERMISSIONS } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";
import { AccessService } from "../src/core/memberships/public.ts";
import { PrismaAccessRepository } from "../src/core/memberships/access.repository.ts";
import { InventoryMasterReadAuthorizer } from "../src/modules/inventory/adapters/inventory-master-read-access.ts";
import { PrismaInventoryMasterReader } from "../src/modules/inventory/adapters/persistence/prisma-inventory-master-reader.ts";
import { ReadInventoryUnits } from "../src/modules/inventory/application/read-inventory-units.ts";
import { ReadInventoryUnitConversions } from "../src/modules/inventory/application/read-inventory-unit-conversions.ts";

const maxFactor = "999999999999999999.999999999999";

async function business(db, slug, count) {
  const tenant = await db.tenant.create({ data: { name: slug, slug } });
  await db.inventoryUnit.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      tenantId: tenant.id,
      code: `u${i}`,
      name: `Unit ${i}`,
      precision: 6,
    })),
  });
  const units = await db.inventoryUnit.findMany({
    where: { tenantId: tenant.id },
    orderBy: { id: "asc" },
  });
  for (const [i, factor] of ["0.000000000001", maxFactor, "2.5000"].entries()) {
    await db.inventoryUnitConversion.create({
      data: { tenantId: tenant.id, fromUnitId: units[0].id, toUnitId: units[i + 1].id, factor },
    });
  }
  return { tenantId: tenant.id, units };
}

async function inventorySnapshot(database) {
  const snapshot = {};
  for (const table of [
    "inventory_units",
    "inventory_unit_conversions",
    "inventory_categories",
    "inventory_items",
    "inventory_suppliers",
    "inventory_stock_locations",
    "audit_logs",
    "outbox_events",
    "idempotency_keys",
  ]) {
    // pg returns NUMERIC as text, retaining every digit in the comparison.
    snapshot[table] = (await database.query(`SELECT * FROM "${table}" ORDER BY id`)).rows;
  }
  return snapshot;
}

async function denied(run, code) {
  await assert.rejects(run, (error) => {
    assert.equal(error.getResponse().code, code);
    return true;
  });
}

test("Inventory read queries keep real membership and PostgreSQL scope/decimal/page boundaries", async (t) => {
  await withDisposablePostgres(async ({ connectionString, database }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    try {
      const a = await business(db, "inventory-read-a", 107);
      const b = await business(db, "inventory-read-b", 4);
      const user = await db.user.create({
        data: {
          displayName: "Inventory",
          email: "inventory@example.test",
          passwordHash: "fixture-only",
        },
      });
      const brand = await db.brand.create({
        data: { tenantId: a.tenantId, name: "Brand", slug: "brand" },
      });
      const outlet = await db.outlet.create({
        data: { tenantId: a.tenantId, brandId: brand.id, name: "Outlet", code: "MAIN" },
      });
      const membership = await db.tenantMembership.create({
        data: { tenantId: a.tenantId, userId: user.id },
      });
      await db.outletAssignment.create({
        data: { tenantId: a.tenantId, membershipId: membership.id, outletId: outlet.id },
      });
      const role = await db.role.create({
        data: { tenantId: a.tenantId, name: "Inventory", code: "INVENTORY_READ_FIXTURE" },
      });
      await db.rolePermission.create({
        data: {
          tenantId: a.tenantId,
          roleId: role.id,
          permissionKey: PERMISSIONS.inventoryReceive,
        },
      });
      await db.userRole.create({
        data: { tenantId: a.tenantId, membershipId: membership.id, roleId: role.id },
      });
      const memberships = new AccessService(new PrismaAccessRepository());
      // Test-only entitlement facade facts, NOT a production manifest/installation grant.
      const facts = {
        subscriptionUsable: true,
        module: { entitled: true, tier: "BASIC" },
        installation: "ACTIVE",
        capabilities: new Set(["inventory.item.manage"]),
        snapshot: { modules: [], subscription: null },
      };
      const authorizer = new InventoryMasterReadAuthorizer(memberships, {
        describeAccess: async () => facts,
      });
      const adapter = new PrismaInventoryMasterReader();
      let reads = 0;
      const reader = {
        listUnits: (...args) => {
          reads += 1;
          return adapter.listUnits(...args);
        },
        listConversions: (...args) => {
          reads += 1;
          return adapter.listConversions(...args);
        },
      };
      const units = new ReadInventoryUnits(authorizer, reader);
      const conversions = new ReadInventoryUnitConversions(authorizer, reader);
      const identity = { tenantId: a.tenantId, userId: user.id, membershipId: membership.id };
      const before = await inventorySnapshot(database);

      await t.test(
        "keyset pages are bounded, complete and unique within the authorized workspace",
        async () => {
          const first = await units.execute({ limit: "100" }, identity);
          assert.equal(first.items.length, 100);
          assert.equal(first.pageInfo.hasNextPage, true);
          const last = await units.execute(
            { limit: 100, cursor: first.pageInfo.nextCursor },
            identity,
          );
          assert.equal(last.items.length, 7);
          assert.deepEqual(last.pageInfo, { hasNextPage: false, nextCursor: null });
          assert.deepEqual(
            [...first.items, ...last.items].map((item) => item.id),
            a.units.map((unit) => unit.id),
          );
          const all = [];
          let cursor;
          do {
            const page = await units.execute(
              { limit: 37, ...(cursor ? { cursor } : {}) },
              identity,
            );
            all.push(...page.items.map((item) => item.id));
            cursor = page.pageInfo.nextCursor;
          } while (cursor);
          assert.equal(new Set(all).size, 107);
          assert.deepEqual(
            all,
            a.units.map((unit) => unit.id),
          );
          assert.deepEqual(Object.keys(first.items[0]).sort(), ["code", "id", "name", "precision"]);
          const foreignPosition = await units.execute(
            { limit: 100, cursor: b.units[0].id },
            identity,
          );
          assert.ok(
            foreignPosition.items.every((item) => a.units.some((unit) => unit.id === item.id)),
          );
        },
      );

      await t.test(
        "direct conversion filters and canonical full-precision strings never infer a result/path",
        async () => {
          const page = await conversions.execute({}, identity);
          assert.deepEqual(
            page.items.map((item) => item.factor).sort(),
            ["0.000000000001", maxFactor, "2.5"].sort(),
          );
          assert.deepEqual(Object.keys(page.items[0]).sort(), [
            "factor",
            "fromUnitId",
            "id",
            "toUnitId",
          ]);
          const filtered = await conversions.execute(
            { fromUnitId: a.units[0].id.toUpperCase(), toUnitId: a.units[2].id },
            identity,
          );
          assert.equal(filtered.items.length, 1);
          assert.equal(filtered.items[0].factor, maxFactor);
          for (const query of [
            { fromUnitId: b.units[0].id },
            { toUnitId: b.units[1].id },
            { fromUnitId: a.units[1].id, toUnitId: a.units[0].id },
          ]) {
            assert.deepEqual(await conversions.execute(query, identity), {
              items: [],
              pageInfo: { hasNextPage: false, nextCursor: null },
            });
          }
          const ids = [];
          let cursor;
          do {
            const result = await conversions.execute(
              { limit: 1, ...(cursor ? { cursor } : {}) },
              identity,
            );
            ids.push(...result.items.map((item) => item.id));
            cursor = result.pageInfo.nextCursor;
          } while (cursor);
          assert.deepEqual(
            ids,
            page.items.map((item) => item.id),
          );
        },
      );

      await t.test(
        "foreign workspace identity and device sessions read no master rows",
        async () => {
          const beforeReads = reads;
          await denied(
            units.execute({}, { ...identity, tenantId: b.tenantId }),
            "WORKSPACE_ACCESS_DENIED",
          );
          await denied(
            conversions.execute({}, { ...identity, membershipId: randomUUID() }),
            "WORKSPACE_ACCESS_DENIED",
          );
          await denied(
            units.execute({}, { ...identity, deviceId: randomUUID() }),
            "LOCATION_SCOPE_DENIED",
          );
          assert.equal(reads, beforeReads);
        },
      );

      await t.test(
        "revoked real role/membership and changed entitlement refuse the next page",
        async () => {
          const beforeReads = reads;
          await db.rolePermission.deleteMany({ where: { tenantId: a.tenantId, roleId: role.id } });
          await denied(units.execute({}, identity), "PERMISSION_DENIED");
          await db.rolePermission.create({
            data: {
              tenantId: a.tenantId,
              roleId: role.id,
              permissionKey: PERMISSIONS.inventoryReceive,
            },
          });
          facts.capabilities.clear();
          await denied(conversions.execute({}, identity), "ENTITLEMENT_REQUIRED");
          facts.capabilities.add("inventory.item.manage");
          await db.tenantMembership.update({
            where: { id: membership.id },
            data: { status: "INACTIVE" },
          });
          await denied(units.execute({}, identity), "WORKSPACE_ACCESS_DENIED");
          await db.tenantMembership.update({
            where: { id: membership.id },
            data: { status: "ACTIVE" },
          });
          assert.equal(reads, beforeReads);
        },
      );

      await t.test(
        "missing internal tenant or invalid query never becomes an unscoped/full-table fallback",
        async () => {
          for (const tenantId of [undefined, null, "", "invalid"]) {
            await assert.rejects(adapter.listUnits({ tenantId }, { limit: 1 }), {
              name: "ZodError",
            });
            await assert.rejects(adapter.listConversions({ tenantId }, { limit: 1 }), {
              name: "ZodError",
            });
          }
          await assert.rejects(adapter.listUnits({ tenantId: a.tenantId }, { limit: 101 }), {
            name: "ZodError",
          });
          const beforeReads = reads;
          await assert.rejects(units.execute({ tenantId: b.tenantId }, identity), {
            name: "ZodError",
          });
          await assert.rejects(conversions.execute({ factor: "1" }, identity), {
            name: "ZodError",
          });
          assert.equal(reads, beforeReads);
        },
      );

      await t.test(
        "reading changes no master/latch/timestamp or audit/outbox/idempotency state",
        async () => {
          assert.deepEqual(await inventorySnapshot(database), before);
          assert.equal(
            await db.coreModuleInstallation.count({ where: { tenantId: a.tenantId } }),
            0,
          );
          for (const delegate of [db.catalogProduct, db.order, db.kdsTicket])
            assert.equal(await delegate.count({ where: { tenantId: a.tenantId } }), 0);
        },
      );
    } finally {
      await db.$disconnect();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
