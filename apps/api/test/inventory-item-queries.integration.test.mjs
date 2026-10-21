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
import { PrismaInventoryItemReader } from "../src/modules/inventory/adapters/persistence/prisma-inventory-item-reader.ts";
import { ReadInventoryItems } from "../src/modules/inventory/application/read-inventory-items.ts";
import { fixture, denied } from "./inventory-category-create-fixture.mjs";

async function seed(db, identity, count) {
  const tenantId = identity.tenantId;
  const categories = await Promise.all(
    ["ACTIVE", "INACTIVE"].map((status) =>
      db.inventoryCategory.create({ data: { tenantId, name: status, status } }),
    ),
  );
  const units = await Promise.all([
    db.inventoryUnit.create({
      data: { tenantId, code: "KG", name: "Known", precision: 6, dimension: "MASS" },
    }),
    db.inventoryUnit.create({
      data: { tenantId, code: "EA", name: "Each", precision: 0, dimension: "COUNT" },
    }),
  ]);
  const thresholds = [null, "0", "0.000001", "999999999999999999999999.999999"];
  await db.inventoryItem.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      tenantId,
      name: `Item ${i}`,
      sku: i % 3 ? `SKU-${i}` : null,
      categoryId: i % 3 ? categories[i % 2].id : null,
      baseUnitId: units[i % 2].id,
      minStock: i % 2 ? (i % 3 ? "0" : null) : thresholds[(i / 2) % 4],
      status: i % 3 ? "ACTIVE" : "INACTIVE",
    })),
  });
  const items = await db.inventoryItem.findMany({ where: { tenantId }, orderBy: { id: "asc" } });
  return {
    categories,
    units,
    items: items.map(({ id, sku, name, categoryId, baseUnitId, minStock, status }) => ({
      id,
      sku,
      name,
      categoryId,
      baseUnitId,
      minStock: minStock?.toFixed() ?? null,
      status,
    })),
  };
}
async function snapshot(database) {
  const result = {};
  for (const table of [
    "inventory_items",
    "inventory_categories",
    "inventory_units",
    "inventory_unit_conversions",
    "inventory_suppliers",
    "inventory_stock_locations",
    "audit_logs",
    "outbox_events",
    "idempotency_keys",
    "core_module_installations",
    "core_usage_counters",
    "core_usage_events",
  ])
    result[table] = (
      await database.query(
        `SELECT * FROM ${table} ORDER BY ${table === "core_usage_counters" ? "tenant_id, dimension_key, period_start" : "id"}`,
      )
    ).rows;
  return result;
}

test("Inventory item reads are exact, private, scoped, freshly authorized and read-only", async (t) => {
  let legacyTenantId;
  await withDisposablePostgres(
    async ({ connectionString, database }) => {
      const previous = process.env.DATABASE_URL;
      process.env.DATABASE_URL = connectionString;
      const db = getPrismaClient();
      try {
        const { a, b, facts } = await fixture(db);
        const local = await seed(db, a, 107);
        const foreign = await seed(db, b, 4);
        const empty = await db.tenant.create({ data: { name: "Empty", slug: "item-query-empty" } });
        const memberships = new AccessService(new PrismaAccessRepository());
        await db.tenantMembership.update({
          where: { id: a.membershipId },
          data: { allOutlets: false },
        });
        const brand = await db.brand.create({
          data: { tenantId: a.tenantId, name: "Brand", slug: "brand" },
        });
        const outlet = await db.outlet.create({
          data: { tenantId: a.tenantId, brandId: brand.id, name: "Outlet", code: "MAIN" },
        });
        await db.outletAssignment.create({
          data: { tenantId: a.tenantId, membershipId: a.membershipId, outletId: outlet.id },
        });
        const role = await db.role.create({
          data: { tenantId: a.tenantId, name: "Reader", code: "ITEM_QUERY_FIXTURE" },
        });
        await db.userRole.deleteMany({
          where: { tenantId: a.tenantId, membershipId: a.membershipId },
        });
        await db.userRole.create({
          data: { tenantId: a.tenantId, membershipId: a.membershipId, roleId: role.id },
        });
        const setPermission = async (key) => {
          await db.rolePermission.deleteMany({ where: { tenantId: a.tenantId, roleId: role.id } });
          if (key)
            await db.rolePermission.create({
              data: { tenantId: a.tenantId, roleId: role.id, permissionKey: key },
            });
        };
        await setPermission(PERMISSIONS.inventoryReceive);
        const adapter = new PrismaInventoryItemReader();
        let reads = 0;
        let authorizations = 0;
        const authorizer = new InventoryMasterReadAuthorizer(memberships, {
          describeAccess: async () => {
            authorizations++;
            return facts;
          },
        });
        const query = new ReadInventoryItems(authorizer, {
          listItems: (...args) => {
            reads++;
            return adapter.listItems(...args);
          },
        });
        const initial = await snapshot(database);
        const collect = async (filters, limit = 17) => {
          const items = [];
          let cursor;
          do {
            const page = await query.execute(
              { ...filters, limit, ...(cursor ? { cursor } : {}) },
              a,
            );
            items.push(...page.items);
            cursor = page.pageInfo.nextCursor;
          } while (cursor);
          return items;
        };

        await t.test(
          "107 stable rows traverse max and small pages without duplicates, skip or leaked fields",
          async () => {
            const first = await query.execute({ limit: "100" }, a);
            assert.equal(first.items.length, 100);
            assert.equal(first.pageInfo.hasNextPage, true);
            const last = await query.execute({ cursor: first.pageInfo.nextCursor, limit: 100 }, a);
            assert.equal(last.items.length, 7);
            assert.deepEqual(last.pageInfo, { hasNextPage: false, nextCursor: null });
            assert.deepEqual([...first.items, ...last.items], local.items);
            assert.deepEqual(await collect({}, 19), local.items);
            const peek = await adapter.listItems(
              { tenantId: a.tenantId.toUpperCase() },
              { limit: 100 },
            );
            assert.equal(peek.length, 101);
            assert.deepEqual(Object.keys(peek[100]).sort(), [
              "baseUnitId",
              "categoryId",
              "id",
              "minStock",
              "name",
              "sku",
              "status",
            ]);
          },
        );

        await t.test(
          "nullable and exact threshold extremes remain distinct from zero balance; inactive category and unknown-dimension unit references remain visible",
          async () => {
            const items = await collect({});
            for (const amount of [null, "0", "0.000001", "999999999999999999999999.999999"])
              assert.ok(items.some((row) => row.minStock === amount));
            assert.ok(items.some((row) => row.sku === null && row.categoryId === null));
            assert.ok(
              items.some(
                (row) => row.categoryId === local.categories[1].id && row.status === "ACTIVE",
              ),
            );
            assert.ok(items.some((row) => row.baseUnitId === local.units[1].id));
            const legacy = await adapter.listItems({ tenantId: legacyTenantId }, { limit: 25 });
            assert.equal(legacy.length, 1);
            assert.equal(legacy[0].minStock, "0");
            assert.equal(
              (await db.inventoryUnit.findUniqueOrThrow({ where: { id: legacy[0].baseUnitId } }))
                .dimension,
              null,
            );
            assert.ok(
              items.every(
                (row) =>
                  !Object.hasOwn(row, "balance") &&
                  !Object.hasOwn(row, "cost") &&
                  !Object.hasOwn(row, "hpp"),
              ),
            );
          },
        );

        await t.test(
          "status/category/base-unit exact AND filters work across pages, including empty combinations",
          async () => {
            for (const status of [undefined, "ACTIVE", "INACTIVE"])
              for (const category of local.categories)
                for (const unit of local.units) {
                  const filters = {
                    categoryId: category.id.toUpperCase(),
                    baseUnitId: unit.id.toUpperCase(),
                    ...(status ? { status } : {}),
                  };
                  assert.deepEqual(
                    await collect(filters, 5),
                    local.items.filter(
                      (row) =>
                        row.categoryId === category.id &&
                        row.baseUnitId === unit.id &&
                        (!status || row.status === status),
                    ),
                  );
                }
            for (const status of ["ACTIVE", "INACTIVE"])
              assert.deepEqual(
                await collect({ status }),
                local.items.filter((row) => row.status === status),
              );
            assert.deepEqual(
              await new ReadInventoryItems(
                { authorize: async () => ({ tenantId: empty.id }) },
                adapter,
              ).execute({}, a),
              { items: [], pageInfo: { hasNextPage: false, nextCursor: null } },
            );
            const exact = await new ReadInventoryItems(
              { authorize: async () => ({ tenantId: b.tenantId }) },
              adapter,
            ).execute({ limit: 4 }, b);
            assert.deepEqual(exact, {
              items: foreign.items,
              pageInfo: { hasNextPage: false, nextCursor: null },
            });
          },
        );

        await t.test(
          "foreign or missing parents cannot expose items and arbitrary/foreign cursors are scoped positions only",
          async () => {
            for (const filters of [
              { categoryId: foreign.categories[0].id },
              { baseUnitId: foreign.units[0].id },
              { categoryId: randomUUID() },
              { baseUnitId: randomUUID() },
            ])
              assert.deepEqual(await query.execute(filters, a), {
                items: [],
                pageInfo: { hasNextPage: false, nextCursor: null },
              });
            for (const cursor of [foreign.items[0].id.toUpperCase(), randomUUID()])
              assert.deepEqual(
                (await query.execute({ cursor, status: "ACTIVE", limit: 100 }, a)).items,
                local.items
                  .filter((row) => row.id > cursor.toLowerCase() && row.status === "ACTIVE")
                  .slice(0, 100),
              );
          },
        );

        await t.test(
          "outlet-scoped staff can use each existing operational/master permission with fresh authorization per page",
          async () => {
            assert.equal(
              (await memberships.describeAccess(a.userId, a.tenantId)).context.allOutlets,
              false,
            );
            const before = authorizations;
            for (const key of [
              PERMISSIONS.inventoryReceive,
              PERMISSIONS.inventoryAdjust,
              PERMISSIONS.inventoryStocktake,
              PERMISSIONS.inventoryMasterManage,
            ]) {
              await setPermission(key);
              assert.equal((await query.execute({ limit: 1 }, a)).items.length, 1);
            }
            assert.equal(authorizations - before, 4);
            await setPermission(PERMISSIONS.inventoryReceive);
          },
        );

        await t.test(
          "revocations of permission/membership/user/subscription/entitlement/capability/install block next page before item IO",
          async () => {
            const cursor = (await query.execute({ limit: 1 }, a)).pageInfo.nextCursor;
            const next = () => query.execute({ cursor, limit: 1 }, a);
            const before = reads;
            await setPermission(undefined);
            await denied(next(), "PERMISSION_DENIED", 403);
            await setPermission(PERMISSIONS.inventoryReceive);
            await db.tenantMembership.update({
              where: { id: a.membershipId },
              data: { status: "INACTIVE" },
            });
            await denied(next(), "WORKSPACE_ACCESS_DENIED", 403);
            await db.tenantMembership.update({
              where: { id: a.membershipId },
              data: { status: "ACTIVE" },
            });
            await db.user.update({ where: { id: a.userId }, data: { status: "DISABLED" } });
            await denied(next(), "WORKSPACE_ACCESS_DENIED", 403);
            await db.user.update({ where: { id: a.userId }, data: { status: "ACTIVE" } });
            facts.subscriptionUsable = false;
            await denied(next(), "SUBSCRIPTION_SUSPENDED", 403);
            facts.subscriptionUsable = true;
            facts.module.entitled = false;
            await denied(next(), "ENTITLEMENT_REQUIRED", 403);
            facts.module.entitled = true;
            facts.capabilities.clear();
            await denied(next(), "ENTITLEMENT_REQUIRED", 403);
            facts.capabilities.add("inventory.item.manage");
            for (const installation of [undefined, "SETUP_REQUIRED", "SUSPENDED"]) {
              facts.installation = installation;
              await denied(next(), "INSTALLATION_SETUP_REQUIRED", 409);
            }
            facts.installation = "ACTIVE";
            assert.equal(reads, before);
            assert.equal((await next()).items.length, 1);
          },
        );

        await t.test(
          "device and mismatched workspace/membership identity refusals precede invalid input and item IO",
          async () => {
            const before = reads;
            await denied(
              query.execute({}, { ...a, tenantId: b.tenantId }),
              "WORKSPACE_ACCESS_DENIED",
              403,
            );
            await denied(
              query.execute({ limit: 0 }, { ...a, membershipId: randomUUID() }),
              "WORKSPACE_ACCESS_DENIED",
              403,
            );
            await denied(
              query.execute({}, { ...a, deviceId: randomUUID() }),
              "LOCATION_SCOPE_DENIED",
              403,
            );
            assert.equal(reads, before);
          },
        );

        await t.test(
          "missing internal scope or invalid query never falls back to unscoped item reads",
          async () => {
            for (const tenantId of [undefined, "", "bad"])
              await assert.rejects(adapter.listItems({ tenantId }, { limit: 25 }));
            for (const input of [
              { categoryId: null },
              { baseUnitId: "bad" },
              { status: "ALL" },
              { limit: 101 },
              { cursor: "bad" },
              { tenantId: b.tenantId },
              { cost: "0" },
              { minStock: "0" },
            ]) {
              await assert.rejects(adapter.listItems({ tenantId: a.tenantId }, input));
              const before = reads;
              await assert.rejects(query.execute(input, a));
              assert.equal(reads, before);
            }
          },
        );

        await t.test(
          "all reads leave master/latch/timestamp/audit/key/outbox/usage/install snapshots unchanged without Catalog/POS/KDS",
          async () => {
            assert.deepEqual(await snapshot(database), initial);
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
    },
    {
      beforeMigration: async ({ directory, database }) => {
        if (directory !== "20261021020000_inventory_unit_dimension") return;
        legacyTenantId = (
          await database.query(
            "INSERT INTO tenants (name,slug,updated_at) VALUES ('Legacy item','item-query-legacy',now()) RETURNING id",
          )
        ).rows[0].id;
        const unitId = (
          await database.query(
            "INSERT INTO inventory_units (tenant_id,code,name,precision) VALUES ($1,'OLD','Legacy',0) RETURNING id",
            [legacyTenantId],
          )
        ).rows[0].id;
        await database.query(
          "INSERT INTO inventory_items (tenant_id,name,base_unit_id,min_stock) VALUES ($1,'Historical item',$2,0)",
          [legacyTenantId, unitId],
        );
      },
    },
  );
});
