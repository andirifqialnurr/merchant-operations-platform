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

test("guests order from the table QR into the same kitchen as the cashier, seeing no internal ids (M4-BE-05, SC-01, SC-02, QA-02)", async () => {
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
    const { OrderIntakeService } = await import("../src/kernels/order-intake/public.ts");
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
        { name: "Uji Tamu", slug: "uji-tamu" },
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
        data: { name: "Kopi Tamu", slug: "kopi-tamu", tenantId: tenant.id },
      });
      const outlet = await db.outlet.create({
        data: { brandId: brand.id, code: "PUSAT", name: "Pusat", tenantId: tenant.id },
      });
      const area = await db.floorArea.findFirstOrThrow({ where: { outletId: outlet.id } });
      const t1 = await db.floorServiceTable.create({
        data: {
          areaId: area.id,
          capacity: 4,
          gridH: 2,
          gridW: 2,
          gridX: 3,
          gridY: 3,
          label: "T1",
          outletId: outlet.id,
          shape: "SQUARE",
          tenantId: tenant.id,
          visualSize: "SMALL",
        },
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

      const owner = await db.user.create({
        data: {
          displayName: "Pemilik",
          email: "pemilik@uji.test",
          passwordHash: await hashPassword("rahasia-uji-123"),
        },
      });
      await access.provisionTenantOwner(tenant.id, owner.id);
      const cookie = `${SESSION_COOKIE_NAME}=${
        (await auth.login({ email: "pemilik@uji.test", password: "rahasia-uji-123" })).token
      }`;
      const staff = async (method, route, body) => {
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
      await staff("POST", "/modules/installations/TABLE_SELF_ORDER");
      const qr = (await staff("POST", `/floor/tables/${t1.id}/qr`)).body;
      const token = qr.url.split("/t/")[1];
      const seen = [];
      const guest = async (method, path, body, key = randomUUID()) => {
        const response = await fetch(`${base}/public/table-qr/${token}${path}`, {
          ...(body ? { body: JSON.stringify(body) } : {}),
          headers: {
            "content-type": "application/json",
            ...(key ? { "idempotency-key": key } : {}),
            "x-forwarded-for": "198.51.100.7",
          },
          method,
        });
        const text = await response.text();
        seen.push(text);
        return { body: text ? JSON.parse(text) : null, status: response.status };
      };

      const menu = await guest("GET", "/menu");
      assert.equal(menu.status, 200);
      assert.deepEqual(
        menu.body.products.map((product) => [product.name, product.priceMinor]),
        [["Latte", "25000"]],
      );

      // No key, no order.
      assert.equal(
        (await guest("POST", "/orders", { items: [{ productId: latte.id, quantity: 1 }] }, null))
          .status,
        400,
      );
      const key = randomUUID();
      const first = await guest(
        "POST",
        "/orders",
        { guestCount: 2, items: [{ productId: latte.id, quantity: 2 }], note: "Pakai es" },
        key,
      );
      assert.equal(first.status, 201);
      assert.equal(first.body.status, "RECEIVED");
      assert.equal(first.body.totalMinor, "50000");
      assert.deepEqual(first.body.lines, [
        { modifiers: [], name: "Latte", productId: latte.id, quantity: 2 },
      ]);
      // The same key again is the same order.
      const repeat = await guest(
        "POST",
        "/orders",
        { items: [{ productId: latte.id, quantity: 2 }] },
        key,
      );
      assert.equal(repeat.body.orderNumber, first.body.orderNumber);

      // The guests now hold the table, as a visit staff see.
      const live = (await staff("GET", "/floor/live")).body;
      const table = live.tables.find((item) => item.id === t1.id);
      assert.equal(table.status, "OCCUPIED");
      const visitSession = live.sessions.find((session) => session.id === table.sessionId);
      assert.equal(visitSession.guestCount, 2);
      const opener = (
        await database.query(`SELECT opened_by FROM floor_table_sessions WHERE id = $1`, [
          table.sessionId,
        ])
      ).rows[0];
      assert.equal(opener.opened_by, null);

      // A second round joins the same visit.
      await guest("POST", "/orders", { items: [{ productId: latte.id, quantity: 1 }] });
      const visit = await guest("GET", "/visit");
      assert.equal(visit.body.orders.length, 2);
      assert.equal(visit.body.dueMinor, "75000");

      // Cashier and guests feed one kitchen (M4-QA-02).
      await app.get(OrderIntakeService).submitPosOrder(
        tenant.id,
        outlet.id,
        {
          items: [{ modifierOptionIds: [], productId: latte.id, quantity: 1 }],
          orderType: "TAKEAWAY",
        },
        "kasir-uji-0000000001",
        { actorId: owner.id, channel: "POS" },
      );
      await drain();
      const tickets = (
        await database.query(
          `SELECT source, table_label, station_id FROM kds_tickets WHERE tenant_id = $1 ORDER BY received_at`,
          [tenant.id],
        )
      ).rows;
      assert.deepEqual(
        tickets.map((row) => [row.source, row.table_label]),
        [
          ["SELF_ORDER", "T1"],
          ["SELF_ORDER", "T1"],
          ["POS", null],
        ],
      );
      assert.equal(new Set(tickets.map((row) => row.station_id)).size, 1);

      // The kitchen moves an order on; the guest sees it.
      const kitchen = (await staff("GET", "/kds/tickets")).body.tickets[0];
      await staff("POST", `/kds/tickets/${kitchen.id}/advance`, { expectedStatus: "NEW" });
      await staff("POST", `/kds/tickets/${kitchen.id}/advance`, { expectedStatus: "ACCEPTED" });
      await drain();
      assert.equal((await guest("GET", "/visit")).body.orders[0].status, "PREPARING");

      // Data guard (M4-SC-01): nothing a guest received names an internal id,
      // a position on the floor, or the token.
      const secret = [tenant.id, outlet.id, t1.id, table.sessionId, area.id, brand.id, token];
      for (const text of seen) {
        for (const value of secret) assert.ok(!text.includes(value), `leaked ${value}`);
        assert.doesNotMatch(text, /grid[XYWH]|"gridX"|tableId|sessionId|outletId|tenantId/);
      }

      // A table that stops taking QR orders says so.
      await database.query(`UPDATE floor_service_tables SET qr_ordering = false WHERE id = $1`, [
        t1.id,
      ]);
      assert.equal((await guest("GET", "/menu")).body.code, "SELF_ORDER_CLOSED");
      await database.query(`UPDATE floor_service_tables SET qr_ordering = true WHERE id = $1`, [
        t1.id,
      ]);
      // A made-up QR leads nowhere.
      const bogus = await fetch(`${base}/public/table-qr/${"z".repeat(43)}/menu`);
      assert.equal((await bogus.json()).code, "TABLE_QR_INVALID");

      // Rate limit (M4-SC-02): 20 orders per table QR in ten minutes; the
      // ones above were 3 (the one without a key never reached the count), so 17 more fit.
      const wrong = { items: [{ productId: randomUUID(), quantity: 1 }] };
      const codes = [];
      for (let attempt = 0; attempt < 18; attempt += 1) {
        codes.push((await guest("POST", "/orders", wrong)).status);
      }
      assert.deepEqual(codes.slice(0, 17), Array(17).fill(409));
      assert.equal(codes[17], 429);
    } finally {
      await app.close();
      await db.$disconnect();
      delete globalThis.prisma;
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
