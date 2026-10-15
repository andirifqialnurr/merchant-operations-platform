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

test("cashiers find, add, and link customers; paid visits fill the history; phones stay with allowed roles (M4-BE-09, SC-03)", async () => {
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
        { name: "Uji Pelanggan", slug: "uji-pelanggan" },
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
        data: { name: "Kopi Pelanggan", slug: "kopi-pelanggan", tenantId: tenant.id },
      });
      const outlet = await db.outlet.create({
        data: { brandId: brand.id, code: "PUSAT", name: "Pusat", tenantId: tenant.id },
      });
      const category = await catalog.createCategory(tenant.id, {
        name: "Minuman",
        slug: "minuman",
      });
      const latte = await catalog.createProduct(tenant.id, {
        basePriceMinor: "25000",
        categoryId: category.id,
        name: "Latte",
        slug: "latte",
      });
      await catalog.createOutletProduct(tenant.id, { outletId: outlet.id, productId: latte.id });

      const person = async (email) =>
        db.user.create({
          data: { displayName: email, email, passwordHash: await hashPassword("rahasia-uji-123") },
        });
      const owner = await person("pemilik@uji.test");
      await access.provisionTenantOwner(tenant.id, owner.id);
      const cashier = await person("kasir@uji.test");
      const cashierRole = await db.role.findUniqueOrThrow({
        where: { tenantId_code: { code: "CASHIER", tenantId: tenant.id } },
      });
      await access.createMembership(tenant.id, {
        allOutlets: false,
        outletIds: [outlet.id],
        roleIds: [cashierRole.id],
        userId: cashier.id,
      });
      const session = async (email) =>
        `${SESSION_COOKIE_NAME}=${(await auth.login({ email, password: "rahasia-uji-123" })).token}`;
      const asPerson = (cookie) => async (method, route, body) => {
        const response = await fetch(base + route, {
          ...(body ? { body: JSON.stringify(body) } : {}),
          headers: {
            "content-type": "application/json",
            cookie,
            "idempotency-key": randomUUID(),
            "x-outlet-id": outlet.id,
            "x-tenant-id": tenant.id,
          },
          method,
        });
        const text = await response.text();
        return { body: text ? JSON.parse(text) : null, status: response.status };
      };
      const ownerApi = asPerson(await session("pemilik@uji.test"));
      const cashierApi = asPerson(await session("kasir@uji.test"));

      // The owner adds a customer; the number is kept as digits.
      const ayu = await ownerApi("POST", "/customers", {
        name: "Ayu",
        note: "Oat milk",
        phone: "0812-3456-7890",
      });
      assert.equal(ayu.status, 201);
      assert.equal(ayu.body.phone, "081234567890");
      assert.equal(ayu.body.phoneEnding, "7890");
      assert.equal(
        (await ownerApi("POST", "/customers", { name: "Ayu lagi", phone: "081234567890" })).body
          .code,
        "CUSTOMER_PHONE_TAKEN",
      );
      assert.equal((await ownerApi("POST", "/customers", { note: "?" })).status, 400);

      // The cashier finds her by the last digits, but sees no phone number (M4-SC-03).
      const found = (await cashierApi("GET", "/customers?q=7890")).body.customers;
      assert.deepEqual(
        found.map((item) => [item.name, item.phone, item.phoneEnding]),
        [["Ayu", null, "7890"]],
      );
      assert.equal((await cashierApi("GET", "/customers?q=ay")).body.customers.length, 1);
      assert.equal(
        (await cashierApi("PATCH", `/customers/${ayu.body.id}`, { phone: "0811111111" })).body.code,
        "CUSTOMER_CONTACT_HIDDEN",
      );
      const budi = await cashierApi("POST", "/customers", { name: "Budi" });
      assert.equal(budi.status, 201);
      assert.equal(
        (await cashierApi("PATCH", `/customers/${budi.body.id}`, { name: null })).body.code,
        "CUSTOMER_IDENTITY_REQUIRED",
      );

      // An unpaid order is linked; it becomes a visit once paid (sale.completed.v1).
      assert.equal(
        (await cashierApi("POST", "/pos/shifts", { openingCashMinor: "0" })).status,
        201,
      );
      const order = await cashierApi("POST", "/pos/orders", {
        items: [{ modifierOptionIds: [], productId: latte.id, quantity: 2 }],
        orderType: "TAKEAWAY",
      });
      assert.equal(order.status, 201);
      const linked = await cashierApi("POST", `/customers/${ayu.body.id}/orders`, {
        orderId: order.body.id,
      });
      assert.equal(linked.status, 200);
      assert.deepEqual(
        linked.body.visits.map((visit) => [visit.orderNumber, visit.saleNumber]),
        [[order.body.orderNumber, null]],
      );
      assert.equal(linked.body.customer.visitCount, 0);
      // Linking again to her is fine; to someone else is not.
      assert.equal(
        (await cashierApi("POST", `/customers/${ayu.body.id}/orders`, { orderId: order.body.id }))
          .status,
        200,
      );
      assert.equal(
        (await cashierApi("POST", `/customers/${budi.body.id}/orders`, { orderId: order.body.id }))
          .body.code,
        "CUSTOMER_ORDER_LINKED",
      );
      const pay = await cashierApi("POST", `/pos/orders/${order.body.id}/payments`, {
        method: "CASH",
        tenderedMinor: "50000",
      });
      assert.equal(pay.status, 200);
      await drain();
      const history = (await ownerApi("GET", `/customers/${ayu.body.id}`)).body;
      assert.equal(history.customer.visitCount, 1);
      assert.equal(history.customer.spendMinor, "50000");
      assert.equal(history.visits[0].saleNumber, pay.body.sale.saleNumber);
      assert.equal(history.visits[0].totalMinor, "50000");

      // An order paid before it is linked brings its sale along.
      const second = await cashierApi("POST", "/pos/orders", {
        items: [{ modifierOptionIds: [], productId: latte.id, quantity: 1 }],
        orderType: "TAKEAWAY",
      });
      await cashierApi("POST", `/pos/orders/${second.body.id}/payments`, {
        method: "CASH",
        tenderedMinor: "25000",
      });
      const late = await cashierApi("POST", `/customers/${ayu.body.id}/orders`, {
        orderId: second.body.id,
      });
      assert.equal(late.body.customer.visitCount, 2);
      assert.equal(late.body.customer.spendMinor, "75000");
      assert.equal(
        (await cashierApi("GET", `/customers/orders/${second.body.id}`)).body.customer.name,
        "Ayu",
      );
      assert.equal(
        (await cashierApi("GET", `/customers/orders/${randomUUID()}`)).body.customer,
        null,
      );

      // Nothing about the customer reaches the kitchen (M4-SC-03).
      await drain();
      const kitchen = JSON.stringify(
        (
          await database.query(
            `SELECT t.*, (SELECT json_agg(i) FROM kds_ticket_items i WHERE i.ticket_id = t.id) AS items
             FROM kds_tickets t WHERE t.tenant_id = $1`,
            [tenant.id],
          )
        ).rows,
      );
      assert.ok(kitchen.length > 10, "the kitchen has tickets");
      for (const secret of ["Ayu", "7890", "Oat milk", ayu.body.id]) {
        assert.ok(!kitchen.includes(secret), `kitchen saw ${secret}`);
      }
      // Nor does the phone number reach the audit trail.
      const audits = JSON.stringify(
        (
          await database.query(
            `SELECT metadata FROM audit_logs WHERE entity_type = 'customer_customer'`,
          )
        ).rows,
      );
      assert.ok(!audits.includes("081234567890"));
    } finally {
      await app.close();
      await db.$disconnect();
      delete globalThis.prisma;
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
