import "reflect-metadata";

import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";

import { PLAN_CODES } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { NestFactory } from "@nestjs/core";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";

const { fetch } = globalThis;

test("guests are seated at one table at a time, and leave only once everything is paid", async () => {
  await withDisposablePostgres(async ({ database, connectionString }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    const { AppModule } = await import("../src/app.module.ts");
    const { AuthService, hashPassword, SESSION_COOKIE_NAME } =
      await import("../src/core/auth/public.ts");
    const { AccessService } = await import("../src/core/memberships/public.ts");
    const { CatalogService } = await import("../src/kernels/catalog/public.ts");
    const { OrderIntakeService } = await import("../src/kernels/order-intake/public.ts");
    const { PlatformMasterService } =
      await import("../src/core/platform/platform-master.service.ts");
    const app = await NestFactory.create(AppModule, { logger: ["error"] });
    app.setGlobalPrefix("api/v1");
    try {
      await app.listen(0, "127.0.0.1");
      const base = `${await app.getUrl()}/api/v1`;
      const platform = app.get(PlatformMasterService);
      const access = app.get(AccessService);
      const auth = app.get(AuthService);

      const tenant = await platform.createTenant(
        { name: "Uji Sesi", slug: "uji-sesi" },
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
        data: { brandId: brand.id, code: "PUSAT", name: "Pusat", tenantId: tenant.id },
      });
      const area = await db.floorArea.findFirstOrThrow({ where: { outletId: outlet.id } });
      const table = (label, gridX) =>
        db.floorServiceTable.create({
          data: {
            areaId: area.id,
            capacity: 4,
            gridH: 2,
            gridW: 2,
            gridX,
            gridY: 0,
            label,
            outletId: outlet.id,
            shape: "SQUARE",
            tenantId: tenant.id,
            visualSize: "SMALL",
          },
        });
      const t1 = await table("T1", 0);
      const t2 = await table("T2", 4);

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
      const statusOf = async (id) =>
        (await cashierApi("GET", "/floor/live")).body.tables.find((item) => item.id === id).status;

      assert.equal(await statusOf(t1.id), "AVAILABLE");

      // Two cashiers seat the same table at once: only one succeeds.
      const [first, second] = await Promise.all([
        cashierApi("POST", "/floor/sessions", { guestCount: 2, tableId: t1.id }),
        ownerApi("POST", "/floor/sessions", { guestCount: 3, tableId: t1.id }),
      ]);
      assert.deepEqual([first.status, second.status].sort(), [201, 409]);
      const seated = first.status === 201 ? first.body : second.body;
      const refused = first.status === 201 ? second.body : first.body;
      assert.equal(refused.code, "TABLE_NOT_AVAILABLE");
      assert.equal(seated.displayNumber, 1);
      assert.deepEqual(seated.tableIds, [t1.id]);
      assert.equal(await statusOf(t1.id), "OCCUPIED");
      const live = (await cashierApi("GET", "/floor/live")).body;
      assert.equal(live.sessions.length, 1);
      assert.equal(live.tables.find((item) => item.id === t1.id).sessionId, seated.id);

      // The table cannot be set aside while guests are at it.
      const layout = await ownerApi("PUT", `/floor/floors/${area.floorId}/layout`, {
        tables: [
          {
            areaId: area.id,
            capacity: 4,
            gridX: 0,
            gridY: 0,
            id: t1.id,
            label: "T1",
            qrOrdering: true,
            rotation: 0,
            shape: "SQUARE",
            status: "INACTIVE",
            visualSize: "SMALL",
          },
        ],
      });
      assert.equal(layout.body.code, "FLOOR_TABLE_IN_USE");

      // An unpaid order keeps the visit open.
      const category = await app
        .get(CatalogService)
        .createCategory(tenant.id, { name: "Minuman", slug: "minuman" });
      const product = await app.get(CatalogService).createProduct(tenant.id, {
        basePriceMinor: "20000",
        categoryId: category.id,
        name: "Teh",
        slug: "teh",
      });
      await app
        .get(CatalogService)
        .createOutletProduct(tenant.id, { outletId: outlet.id, productId: product.id });
      const order = await app.get(OrderIntakeService).submitPosOrder(
        tenant.id,
        outlet.id,
        {
          items: [{ modifierOptionIds: [], productId: product.id, quantity: 1 }],
          orderType: "TAKEAWAY",
        },
        "sesi-uji-0000000001",
        { actorId: cashier.id, channel: "POS" },
      );
      await database.query(
        `UPDATE order_orders SET order_type = 'DINE_IN', table_session_id = $1 WHERE id = $2`,
        [seated.id, order.id],
      );
      const blocked = await cashierApi("POST", `/floor/sessions/${seated.id}/close`);
      assert.equal(blocked.status, 409);
      assert.equal(blocked.body.code, "TABLE_SESSION_UNPAID");
      assert.deepEqual(blocked.body.details.orderNumbers, [order.orderNumber]);
      // A canceled order does not.
      await app
        .get(OrderIntakeService)
        .cancelOrder(tenant.id, outlet.id, order.id, "Tamu batal", async () => undefined, {
          actorId: cashier.id,
          channel: "POS",
        });

      // With the cleaning policy the table waits to be cleaned.
      assert.equal(
        (await cashierApi("PUT", "/floor/policy", { cleaningAfterClose: true })).status,
        403,
      );
      assert.deepEqual(
        (await ownerApi("PUT", "/floor/policy", { cleaningAfterClose: true })).body,
        {
          cleaningAfterClose: true,
        },
      );
      const closed = await cashierApi("POST", `/floor/sessions/${seated.id}/close`);
      assert.equal(closed.status, 200);
      assert.equal(closed.body.status, "CLOSED");
      assert.equal(await statusOf(t1.id), "CLEANING");
      assert.equal(
        (await cashierApi("POST", `/floor/sessions/${seated.id}/close`)).body.code,
        "TABLE_SESSION_CLOSED",
      );
      assert.equal(
        (await cashierApi("POST", "/floor/sessions", { guestCount: 2, tableId: t1.id })).body.code,
        "TABLE_NOT_AVAILABLE",
      );
      assert.equal((await cashierApi("POST", `/floor/tables/${t1.id}/clean`)).status, 204);
      assert.equal(await statusOf(t1.id), "AVAILABLE");
      assert.equal(
        (await cashierApi("POST", `/floor/tables/${t1.id}/clean`)).body.code,
        "TABLE_NOT_CLEANING",
      );

      // Without cleaning a closed table is free at once; history keeps counting.
      await ownerApi("PUT", "/floor/policy", { cleaningAfterClose: false });
      const again = await cashierApi("POST", "/floor/sessions", { guestCount: 4, tableId: t1.id });
      assert.equal(again.body.displayNumber, 2);
      await cashierApi("POST", `/floor/sessions/${again.body.id}/close`);
      assert.equal(await statusOf(t1.id), "AVAILABLE");
      assert.equal(await statusOf(t2.id), "AVAILABLE");

      // A table set aside cannot take guests.
      await database.query(`UPDATE floor_service_tables SET status = 'INACTIVE' WHERE id = $1`, [
        t2.id,
      ]);
      assert.equal(await statusOf(t2.id), "INACTIVE");
      assert.equal(
        (await cashierApi("POST", "/floor/sessions", { guestCount: 2, tableId: t2.id })).body.code,
        "TABLE_NOT_AVAILABLE",
      );

      // The database itself refuses a second visit on a held table.
      const third = await cashierApi("POST", "/floor/sessions", { guestCount: 1, tableId: t1.id });
      await assert.rejects(
        database.query(
          `INSERT INTO floor_session_tables (tenant_id, outlet_id, session_id, table_id)
           VALUES ($1, $2, $3, $4)`,
          [tenant.id, outlet.id, again.body.id, t1.id],
        ),
        /floor_session_tables_active_table_key/,
      );
      assert.equal(third.status, 201);

      const events = (
        await database.query(
          `SELECT type, payload FROM outbox_events WHERE aggregate_type = 'floor_table_session'
            ORDER BY recorded_at, id`,
        )
      ).rows;
      assert.deepEqual(
        events.map((row) => row.type),
        [
          "table_session.opened.v1",
          "table_session.closed.v1",
          "table_session.opened.v1",
          "table_session.closed.v1",
          "table_session.opened.v1",
        ],
      );
      assert.deepEqual(events[0].payload.tableIds, [t1.id]);
    } finally {
      await app.close();
      await db.$disconnect();
      delete globalThis.prisma;
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
