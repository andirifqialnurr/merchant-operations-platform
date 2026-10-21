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
import { PrismaInventoryCategoryReader } from "../src/modules/inventory/adapters/persistence/prisma-inventory-category-reader.ts";
import { ReadInventoryCategories } from "../src/modules/inventory/application/read-inventory-categories.ts";

async function business(db, slug, count, mixed = true) {
  const tenant = await db.tenant.create({ data: { name: slug, slug } });
  if (count)
    await db.inventoryCategory.createMany({
      data: Array.from({ length: count }, (_, i) => ({
        tenantId: tenant.id,
        name: `${i === 0 ? "Bahan" : "Category"} ${i}`,
        status: mixed && i % 3 === 0 ? "INACTIVE" : "ACTIVE",
      })),
    });
  return {
    tenantId: tenant.id,
    categories: await db.inventoryCategory.findMany({
      where: { tenantId: tenant.id },
      orderBy: { id: "asc" },
    }),
  };
}
async function denied(promise, code, status = 403) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.getResponse().code, code);
    assert.equal(error.getStatus(), status);
    return true;
  });
}
async function snapshot(database) {
  const result = {};
  for (const table of [
    "inventory_categories",
    "inventory_units",
    "inventory_unit_conversions",
    "inventory_items",
    "inventory_suppliers",
    "inventory_stock_locations",
    "audit_logs",
    "outbox_events",
    "idempotency_keys",
    "core_module_installations",
  ])
    result[table] = (await database.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
  return result;
}

test("Inventory category query keeps scoped statuses/pages, fresh read rights and no-write semantics", async (t) => {
  await withDisposablePostgres(async ({ connectionString, database }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    try {
      const a = await business(db, "category-query-a", 107);
      const b = await business(db, "category-query-b", 4, false);
      const empty = await business(db, "category-query-empty", 0);
      const user = await db.user.create({
        data: {
          displayName: "Inventory",
          email: "category-query@example.test",
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
        data: { tenantId: a.tenantId, name: "Inventory reader", code: "CATEGORY_QUERY_FIXTURE" },
      });
      const setPermission = async (key) => {
        await db.rolePermission.deleteMany({ where: { tenantId: a.tenantId, roleId: role.id } });
        if (key)
          await db.rolePermission.create({
            data: { tenantId: a.tenantId, roleId: role.id, permissionKey: key },
          });
      };
      await setPermission(PERMISSIONS.inventoryReceive);
      await db.userRole.create({
        data: { tenantId: a.tenantId, membershipId: membership.id, roleId: role.id },
      });
      const memberships = new AccessService(new PrismaAccessRepository());
      // Facade facts owned by this fixture, not a production installation/capability grant.
      const facts = {
        subscriptionUsable: true,
        module: { entitled: true, tier: "BASIC" },
        installation: "ACTIVE",
        capabilities: new Set(["inventory.item.manage"]),
        snapshot: { modules: [], subscription: null },
      };
      let authorizations = 0;
      const authorizer = new InventoryMasterReadAuthorizer(memberships, {
        describeAccess: async () => {
          authorizations += 1;
          return facts;
        },
      });
      const adapter = new PrismaInventoryCategoryReader();
      let reads = 0;
      const query = new ReadInventoryCategories(authorizer, {
        listCategories: (...args) => {
          reads += 1;
          return adapter.listCategories(...args);
        },
      });
      const identity = { tenantId: a.tenantId, userId: user.id, membershipId: membership.id };
      const initial = await snapshot(database);

      await t.test(
        "default all-status pages are bounded/complete and narrow with no duplicates or skipped stable rows",
        async () => {
          const first = await query.execute({ limit: "100" }, identity);
          assert.equal(first.items.length, 100);
          assert.equal(first.pageInfo.hasNextPage, true);
          const last = await query.execute(
            { limit: 100, cursor: first.pageInfo.nextCursor },
            identity,
          );
          assert.equal(last.items.length, 7);
          assert.deepEqual(last.pageInfo, { hasNextPage: false, nextCursor: null });
          assert.deepEqual(
            [...first.items, ...last.items].map((row) => row.id),
            a.categories.map((row) => row.id),
          );
          assert.deepEqual(Object.keys(first.items[0]).sort(), ["id", "name", "status"]);
          assert.ok([...first.items, ...last.items].some((row) => row.status === "INACTIVE"));
          const ids = [];
          let cursor;
          do {
            const page = await query.execute(
              { limit: 37, ...(cursor ? { cursor } : {}) },
              identity,
            );
            ids.push(...page.items.map((row) => row.id));
            cursor = page.pageInfo.nextCursor;
          } while (cursor);
          assert.equal(new Set(ids).size, 107);
          assert.deepEqual(
            ids,
            a.categories.map((row) => row.id),
          );
          const raw = await adapter.listCategories({ tenantId: a.tenantId }, { limit: 100 });
          assert.equal(raw.length, 101);
          assert.deepEqual(Object.keys(raw[100]).sort(), ["id", "name", "status"]);
        },
      );

      await t.test(
        "ACTIVE/INACTIVE filters remain exact across keysets; absent/inapplicable results stay empty",
        async () => {
          for (const status of ["ACTIVE", "INACTIVE"]) {
            const expected = a.categories
              .filter((row) => row.status === status)
              .map((row) => row.id);
            const ids = [];
            let cursor;
            do {
              const page = await query.execute(
                { status, limit: 17, ...(cursor ? { cursor } : {}) },
                identity,
              );
              assert.ok(page.items.every((row) => row.status === status));
              ids.push(...page.items.map((row) => row.id));
              cursor = page.pageInfo.nextCursor;
            } while (cursor);
            assert.deepEqual(ids, expected);
            assert.equal(new Set(ids).size, expected.length);
          }
          assert.deepEqual(
            await adapter.listCategories(
              { tenantId: b.tenantId },
              { status: "INACTIVE", limit: 25 },
            ),
            [],
          );
          assert.deepEqual(
            await adapter.listCategories({ tenantId: empty.tenantId }, { limit: 25 }),
            [],
          );
          assert.deepEqual(
            await new ReadInventoryCategories(
              { authorize: async () => ({ tenantId: empty.tenantId }) },
              adapter,
            ).execute({}, identity),
            { items: [], pageInfo: { hasNextPage: false, nextCursor: null } },
          );
        },
      );

      await t.test(
        "foreign/arbitrary cursors are positions only and never expose a foreign category",
        async () => {
          for (const cursor of [b.categories[0].id.toUpperCase(), randomUUID()]) {
            const page = await query.execute({ cursor, limit: 100, status: "ACTIVE" }, identity);
            const expected = a.categories
              .filter((row) => row.id > cursor.toLowerCase() && row.status === "ACTIVE")
              .slice(0, 100);
            assert.deepEqual(
              page.items.map((row) => row.id),
              expected.map((row) => row.id),
            );
            assert.ok(page.items.every((row) => a.categories.some((local) => local.id === row.id)));
          }
        },
      );

      await t.test(
        "scoped-outlet staff can read shared categories through each existing read permission, never a new grant",
        async () => {
          const context = await memberships.describeAccess(user.id, a.tenantId);
          assert.equal(context.context.allOutlets, false);
          const beforeAuthorizations = authorizations;
          for (const key of [
            PERMISSIONS.inventoryReceive,
            PERMISSIONS.inventoryAdjust,
            PERMISSIONS.inventoryStocktake,
            PERMISSIONS.inventoryMasterManage,
          ]) {
            await setPermission(key);
            assert.equal((await query.execute({ limit: 1 }, identity)).items.length, 1);
          }
          assert.equal(authorizations - beforeAuthorizations, 4);
          await setPermission(PERMISSIONS.inventoryReceive);
        },
      );

      await t.test(
        "permission/membership/user/subscription/module/install/capability revocation blocks the next page before master IO",
        async () => {
          const cursor = (await query.execute({ limit: 1 }, identity)).pageInfo.nextCursor;
          const beforeReads = reads;
          const next = () => query.execute({ cursor, limit: 1 }, identity);
          await setPermission(undefined);
          await denied(next(), "PERMISSION_DENIED");
          await setPermission(PERMISSIONS.inventoryReceive);
          await db.tenantMembership.update({
            where: { id: membership.id },
            data: { status: "INACTIVE" },
          });
          await denied(next(), "WORKSPACE_ACCESS_DENIED");
          await db.tenantMembership.update({
            where: { id: membership.id },
            data: { status: "ACTIVE" },
          });
          await db.user.update({ where: { id: user.id }, data: { status: "DISABLED" } });
          await denied(next(), "WORKSPACE_ACCESS_DENIED");
          await db.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } });
          facts.subscriptionUsable = false;
          await denied(next(), "SUBSCRIPTION_SUSPENDED");
          facts.subscriptionUsable = true;
          facts.module.entitled = false;
          await denied(next(), "ENTITLEMENT_REQUIRED");
          facts.module.entitled = true;
          facts.capabilities.clear();
          await denied(next(), "ENTITLEMENT_REQUIRED");
          facts.capabilities.add("inventory.item.manage");
          for (const installation of [undefined, "SETUP_REQUIRED", "SUSPENDED"]) {
            facts.installation = installation;
            await denied(next(), "INSTALLATION_SETUP_REQUIRED", 409);
          }
          facts.installation = "ACTIVE";
          assert.equal(reads, beforeReads);
          assert.equal((await next()).items.length, 1);
        },
      );

      await t.test(
        "device and cross-workspace/membership identities cannot read categories or mask denied access with invalid input",
        async () => {
          const beforeReads = reads;
          await denied(
            query.execute({}, { ...identity, tenantId: b.tenantId }),
            "WORKSPACE_ACCESS_DENIED",
          );
          await denied(
            query.execute({ limit: 0 }, { ...identity, membershipId: randomUUID() }),
            "WORKSPACE_ACCESS_DENIED",
          );
          await denied(
            query.execute({}, { ...identity, deviceId: randomUUID() }),
            "LOCATION_SCOPE_DENIED",
          );
          assert.equal(reads, beforeReads);
        },
      );

      await t.test(
        "internal missing scope and invalid query/status cannot become an unscoped or unfiltered fallback",
        async () => {
          for (const tenantId of [undefined, "", "not-a-uuid"])
            await assert.rejects(adapter.listCategories({ tenantId }, { limit: 25 }));
          for (const input of [
            { status: "ALL" },
            { status: "INVALID" },
            { status: ["ACTIVE"] },
            { limit: 101 },
            { cursor: "g" },
            { name: "Edit" },
            { tenantId: b.tenantId },
          ])
            await assert.rejects(adapter.listCategories({ tenantId: a.tenantId }, input));
          const beforeReads = reads;
          await assert.rejects(query.execute({ status: "INVALID" }, identity));
          assert.equal(reads, beforeReads);
        },
      );

      await t.test(
        "all reads leave master/latch/timestamp/audit/outbox/idempotency/installation data unchanged and stay independent of Catalog",
        async () => {
          assert.deepEqual(await snapshot(database), initial);
          const before = await snapshot(database);
          await query.execute({}, identity);
          await query.execute({ status: "INACTIVE", limit: 1 }, identity);
          assert.deepEqual(await snapshot(database), before);
          for (const delegate of [
            db.coreModuleInstallation,
            db.catalogCategory,
            db.catalogProduct,
            db.order,
            db.kdsTicket,
          ])
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
