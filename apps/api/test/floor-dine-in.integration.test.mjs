import "reflect-metadata";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import process from "node:process";
import test from "node:test";

import { PLAN_CODES } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { NestFactory } from "@nestjs/core";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";

const { fetch } = globalThis;

test("guests at a table order twice, the kitchen sees the table, and one payment settles the visit", async () => {
  await withDisposablePostgres(async ({ database, connectionString }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    const { AppModule } = await import("../src/app.module.ts");
    const { workerRuntimeFor } = await import("../src/worker-runtime.ts");
    const { AuthService, hashPassword, SESSION_COOKIE_NAME } =
      await import("../src/core/auth/public.ts");
    const { AccessService } = await import("../src/core/memberships/public.ts");
    const { CatalogService } = await import("../src/kernels/catalog/public.ts");
    const { PlatformMasterService } =
      await import("../src/core/platform/platform-master.service.ts");
    const app = await NestFactory.create(AppModule, { logger: ["error"] });
    app.setGlobalPrefix("api/v1");
    try {
      await app.listen(0, "127.0.0.1");
      const base = `${await app.getUrl()}/api/v1`;
      const worker = workerRuntimeFor(app);
      const drain = async () => {
        for (let taken = await worker.dispatchBatch(); taken > 0;) {
          taken = await worker.dispatchBatch();
        }
      };
      const platform = app.get(PlatformMasterService);
      const access = app.get(AccessService);
      const auth = app.get(AuthService);
      const catalog = app.get(CatalogService);

      const tenant = await platform.createTenant(
        { name: "Uji Makan", slug: "uji-makan" },
        { actorId: undefined },
      );
      await platform.replaceSubscription(
        tenant.id,
        {
          planCode: PLAN_CODES.cafeOperations,
          startsAt: new Date(Date.now() - 60_000).toISOString(),
          status: "ACTIVE",
        },
        { actorId: undefined },
      );
      const brand = await db.brand.create({
        data: { name: "Uji", slug: "uji", tenantId: tenant.id },
      });
      const outlet = await db.outlet.create({
        data: {
          brandId: brand.id,
          chargesIncluded: false,
          code: "PUSAT",
          name: "Pusat",
          serviceChargeRateBp: 500,
          taxRateBp: 1000,
          tenantId: tenant.id,
        },
      });
      const area = await db.floorArea.findFirstOrThrow({ where: { outletId: outlet.id } });
      const t3 = await db.floorServiceTable.create({
        data: {
          areaId: area.id,
          capacity: 4,
          gridH: 3,
          gridW: 3,
          gridX: 0,
          gridY: 0,
          label: "T3",
          outletId: outlet.id,
          shape: "ROUND",
          tenantId: tenant.id,
        },
      });
      const category = await catalog.createCategory(tenant.id, {
        name: "Minuman",
        slug: "minuman",
      });
      const product = async (name, price) => {
        const made = await catalog.createProduct(tenant.id, {
          basePriceMinor: price,
          categoryId: category.id,
          name,
          slug: name.toLowerCase(),
        });
        await catalog.createOutletProduct(tenant.id, { outletId: outlet.id, productId: made.id });
        return made;
      };
      const latte = await product("Latte", "50000");
      const tea = await product("Teh", "30000");

      const cashier = await db.user.create({
        data: {
          displayName: "Kasir",
          email: "kasir@uji.test",
          passwordHash: await hashPassword("rahasia-uji-123"),
        },
      });
      const owner = await db.user.create({
        data: {
          displayName: "Pemilik",
          email: "pemilik@uji.test",
          passwordHash: await hashPassword("rahasia-uji-123"),
        },
      });
      await access.provisionTenantOwner(tenant.id, owner.id);
      const cashierRole = await db.role.findUniqueOrThrow({
        where: { tenantId_code: { code: "CASHIER", tenantId: tenant.id } },
      });
      await access.createMembership(tenant.id, {
        allOutlets: false,
        outletIds: [outlet.id],
        roleIds: [cashierRole.id],
        userId: cashier.id,
      });
      const cookie = `${SESSION_COOKIE_NAME}=${
        (await auth.login({ email: "kasir@uji.test", password: "rahasia-uji-123" })).token
      }`;
      const api = async (method, route, body, key) => {
        const response = await fetch(base + route, {
          ...(body ? { body: JSON.stringify(body) } : {}),
          headers: {
            "content-type": "application/json",
            cookie,
            "x-outlet-id": outlet.id,
            "x-tenant-id": tenant.id,
            ...(key ? { "idempotency-key": key } : {}),
          },
          method,
        });
        const text = await response.text();
        return { body: text ? JSON.parse(text) : null, status: response.status };
      };

      assert.equal((await api("POST", "/pos/shifts", { openingCashMinor: "100000" })).status, 201);
      const visit = (await api("POST", "/floor/sessions", { guestCount: 3, tableId: t3.id })).body;

      // Two rounds of orders for the same visit.
      const firstKey = randomUUID();
      const first = await api(
        "POST",
        `/floor/sessions/${visit.id}/orders`,
        { items: [{ productId: latte.id, quantity: 1 }] },
        firstKey,
      );
      assert.equal(first.status, 201);
      assert.equal(first.body.orderType, "DINE_IN");
      assert.equal(first.body.tableSessionId, visit.id);
      // Sending the same round again changes nothing.
      const repeat = await api(
        "POST",
        `/floor/sessions/${visit.id}/orders`,
        { items: [{ productId: latte.id, quantity: 1 }] },
        firstKey,
      );
      assert.equal(repeat.body.id, first.body.id);
      const second = await api(
        "POST",
        `/floor/sessions/${visit.id}/orders`,
        { items: [{ productId: tea.id, quantity: 1 }], note: "Tanpa gula" },
        randomUUID(),
      );
      assert.equal(second.status, 201);

      // The kitchen gets both rounds, with the table's label.
      await drain();
      const tickets = (
        await database.query(
          `SELECT order_label, table_label FROM kds_tickets WHERE tenant_id = $1 ORDER BY received_at`,
          [tenant.id],
        )
      ).rows;
      assert.deepEqual(
        tickets.map((row) => row.table_label),
        ["T3", "T3"],
      );

      // The visit owes both orders, each with 5% service and 10% tax added.
      const detail = await api("GET", `/floor/sessions/${visit.id}`);
      assert.equal(detail.status, 200);
      assert.deepEqual(
        detail.body.orders.map((order) => [order.totalMinor, order.paid]),
        [
          ["57750", false],
          ["34650", false],
        ],
      );
      assert.equal(detail.body.dueMinor, "92400");
      // Not before it is paid.
      assert.equal(
        (await api("POST", `/floor/sessions/${visit.id}/close`)).body.code,
        "TABLE_SESSION_UNPAID",
      );

      // One cash payment for the whole visit.
      const payKey = randomUUID();
      const paid = await api(
        "POST",
        `/pos/table-sessions/${visit.id}/payments`,
        { expectedTotalMinor: "92400", method: "CASH", tenderedMinor: "100000" },
        payKey,
      );
      assert.equal(paid.status, 200);
      assert.equal(paid.body.payment.amountMinor, "92400");
      assert.equal(paid.body.payment.changeMinor, "7600");
      assert.equal(paid.body.checkouts.length, 2);
      const again = await api(
        "POST",
        `/pos/table-sessions/${visit.id}/payments`,
        { expectedTotalMinor: "92400", method: "CASH", tenderedMinor: "100000" },
        payKey,
      );
      assert.equal(again.body.payment.id, paid.body.payment.id);
      assert.equal(
        (
          await api(
            "POST",
            `/pos/table-sessions/${visit.id}/payments`,
            { method: "EDC" },
            randomUUID(),
          )
        ).body.code,
        "TABLE_SESSION_NOTHING_TO_PAY",
      );
      const bills = (
        await database.query(
          `SELECT table_session_id, status, total_minor::text FROM billing_bills
            WHERE tenant_id = $1 ORDER BY total_minor DESC`,
          [tenant.id],
        )
      ).rows;
      assert.deepEqual(
        bills.map((row) => [row.table_session_id, row.status, row.total_minor]),
        [
          [visit.id, "PAID", "57750"],
          [visit.id, "PAID", "34650"],
        ],
      );
      const allocations = (
        await database.query(
          `SELECT count(*)::int AS count, count(DISTINCT payment_id)::int AS payments
             FROM billing_payment_allocations WHERE tenant_id = $1`,
          [tenant.id],
        )
      ).rows[0];
      assert.deepEqual(allocations, { count: 2, payments: 1 });
      // The shift's expected cash counts the payment once.
      const shift = await api("GET", "/pos/shifts/current");
      assert.equal(shift.body.session.expectedCashMinor, "192400");

      const after = await api("GET", `/floor/sessions/${visit.id}`);
      assert.equal(after.body.dueMinor, "0");
      assert.ok(after.body.orders.every((order) => order.paid));
      assert.equal((await api("POST", `/floor/sessions/${visit.id}/close`)).status, 200);
      // A closed visit takes no more orders.
      assert.equal(
        (
          await api(
            "POST",
            `/floor/sessions/${visit.id}/orders`,
            { items: [{ productId: tea.id, quantity: 1 }] },
            randomUUID(),
          )
        ).body.code,
        "TABLE_SESSION_CLOSED",
      );
    } finally {
      await app.close();
      await db.$disconnect();
      delete globalThis.prisma;
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
