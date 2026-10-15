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

test("guests move to another table with their visit, orders, and bill intact (M4-QA-01)", async () => {
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
        { name: "Uji Pindah", slug: "uji-pindah" },
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
      const [t1, t2, t3, t4] = [
        await table("T1", 0),
        await table("T2", 3),
        await table("T3", 6),
        await table("T4", 9),
      ];
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
      const role = await db.role.findUniqueOrThrow({
        where: { tenantId_code: { code: "CASHIER", tenantId: tenant.id } },
      });
      await access.createMembership(tenant.id, {
        allOutlets: false,
        outletIds: [outlet.id],
        roleIds: [role.id],
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
      const statusOf = async (id) =>
        (await api("GET", "/floor/live")).body.tables.find((item) => item.id === id);

      await api("POST", "/pos/shifts", { openingCashMinor: "0" });
      const visit = (await api("POST", "/floor/sessions", { guestCount: 2, tableId: t1.id })).body;
      const order = (
        await api(
          "POST",
          `/floor/sessions/${visit.id}/orders`,
          { items: [{ productId: latte.id, quantity: 2 }] },
          randomUUID(),
        )
      ).body;
      // The kitchen hears of the order while the guests still sit at T1.
      await drain();
      const before = (await api("GET", `/floor/sessions/${visit.id}`)).body;

      // The move.
      const moved = await api("POST", `/floor/sessions/${visit.id}/move`, { tableId: t2.id });
      assert.equal(moved.status, 200);
      assert.equal(moved.body.id, visit.id);
      assert.equal(moved.body.displayNumber, visit.displayNumber);
      assert.deepEqual(moved.body.tableIds, [t2.id]);
      assert.equal((await statusOf(t1.id)).status, "AVAILABLE");
      assert.deepEqual(
        [(await statusOf(t2.id)).status, (await statusOf(t2.id)).sessionId],
        ["OCCUPIED", visit.id],
      );
      // Orders and what is owed travel with the visit.
      const after = (await api("GET", `/floor/sessions/${visit.id}`)).body;
      assert.deepEqual(after.orders, before.orders);
      assert.equal(after.dueMinor, before.dueMinor);
      assert.equal(after.tableLabel, "T2");

      // A table held by other guests is not a destination.
      const other = (await api("POST", "/floor/sessions", { guestCount: 1, tableId: t3.id })).body;
      assert.equal(
        (await api("POST", `/floor/sessions/${visit.id}/move`, { tableId: t3.id })).body.code,
        "TABLE_NOT_AVAILABLE",
      );
      // Two visits moving to the same free table at once: one gets it.
      const race = await Promise.all([
        api("POST", `/floor/sessions/${visit.id}/move`, { tableId: t4.id }),
        api("POST", `/floor/sessions/${other.id}/move`, { tableId: t4.id }),
      ]);
      assert.deepEqual(race.map((result) => result.status).sort(), [200, 409]);
      const winner = race[0].status === 200 ? visit.id : other.id;
      assert.equal((await statusOf(t4.id)).sessionId, winner);
      const ours = (await api("GET", `/floor/sessions/${visit.id}`)).body.session.tableIds[0];

      // A new round after the move reaches the kitchen with the new table.
      await api(
        "POST",
        `/floor/sessions/${visit.id}/orders`,
        { items: [{ productId: latte.id, quantity: 1 }] },
        randomUUID(),
      );
      await drain();
      const labels = (
        await database.query(
          `SELECT table_label FROM kds_tickets WHERE tenant_id = $1 ORDER BY received_at`,
          [tenant.id],
        )
      ).rows.map((row) => row.table_label);
      const ourLabel = [t1, t2, t3, t4].find((item) => item.id === ours).label;
      assert.deepEqual(labels, ["T1", ourLabel]);

      // Paid and closed on the table it ended at; the bill belongs to the visit.
      const due = (await api("GET", `/floor/sessions/${visit.id}`)).body.dueMinor;
      const paid = await api(
        "POST",
        `/pos/table-sessions/${visit.id}/payments`,
        { expectedTotalMinor: due, method: "EDC" },
        randomUUID(),
      );
      assert.equal(paid.status, 200);
      assert.ok(paid.body.checkouts.some(({ bill }) => bill.orderId === order.id));
      assert.equal((await api("POST", `/floor/sessions/${visit.id}/close`)).status, 200);
      assert.equal((await statusOf(ours)).status, "AVAILABLE");
      assert.equal(
        (await api("POST", `/floor/sessions/${visit.id}/move`, { tableId: t1.id })).body.code,
        "TABLE_SESSION_CLOSED",
      );

      // The history shows where the visit sat, and the moves were announced.
      const seats = (
        await database.query(
          `SELECT t.label, s.detached_at IS NOT NULL AS left
             FROM floor_session_tables s JOIN floor_service_tables t ON t.id = s.table_id
            WHERE s.session_id = $1 ORDER BY s.attached_at`,
          [visit.id],
        )
      ).rows;
      assert.equal(seats[0].label, "T1");
      assert.equal(seats[1].label, "T2");
      assert.ok(seats.every((seat) => seat.left));
      const moves = (
        await database.query(
          `SELECT payload FROM outbox_events
            WHERE type = 'table_session.moved.v1' AND aggregate_id = $1 ORDER BY recorded_at`,
          [visit.id],
        )
      ).rows;
      assert.deepEqual(moves[0].payload.fromTableId, t1.id);
      assert.deepEqual(moves[0].payload.toTableId, t2.id);
    } finally {
      await app.close();
      await db.$disconnect();
      delete globalThis.prisma;
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
