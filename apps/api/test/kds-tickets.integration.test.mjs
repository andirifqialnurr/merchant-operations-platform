import "reflect-metadata";

import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";

import { MODULES, PLAN_CODES } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { NestFactory } from "@nestjs/core";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";

test("kitchen tickets on PostgreSQL: one per request, a station per outlet, history kept", async () => {
  await withDisposablePostgres(async ({ connectionString, database }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    const { AppModule } = await import("../src/app.module.ts");
    const { CreateKitchenTicket } = await import("../src/modules/kds/public.ts");
    const { AdvanceKitchenTicket } =
      await import("../src/modules/kds/application/advance-kitchen-ticket.ts");
    const { KitchenQueue } = await import("../src/modules/kds/application/kitchen-queue.ts");
    const { EntitlementService } = await import("../src/core/entitlements/public.ts");
    const { PlatformMasterService } =
      await import("../src/core/platform/platform-master.service.ts");
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error"] });
    try {
      const platform = app.get(PlatformMasterService);
      const create = app.get(CreateKitchenTicket);
      const context = { actorId: undefined };
      const one = async (sql, values) => (await database.query(sql, values)).rows[0];

      const tenant = await platform.createTenant({ name: "Dapur Uji", slug: "dapur-uji" }, context);
      await platform.replaceSubscription(
        tenant.id,
        {
          planCode: PLAN_CODES.cafeOperations,
          startsAt: new Date(Date.now() - 60_000).toISOString(),
          status: "ACTIVE",
        },
        context,
      );
      // The kitchen module has a manifest now, so the package installs it.
      const installation = await one(
        `SELECT status FROM core_module_installations WHERE tenant_id = $1 AND module_key = 'KDS'`,
        [tenant.id],
      );
      assert.equal(installation?.status, "ACTIVE");
      assert.equal(
        (await app.get(EntitlementService).describeAccess(tenant.id, MODULES.kds)).module?.entitled,
        true,
      );

      const brand = await db.brand.create({
        data: { name: "Uji", slug: "uji", tenantId: tenant.id },
      });
      const outlet = (code) =>
        db.outlet.create({
          data: {
            brandId: brand.id,
            code,
            name: `Outlet ${code}`,
            tenantId: tenant.id,
            timezone: "Asia/Jakarta",
          },
        });
      const pusat = await outlet("PUSAT");
      const timur = await outlet("TIMUR");

      const items = [
        { modifiers: ["Besar"], name: "Latte", note: "kurang manis", quantity: 2 },
        { allergyNote: "kacang", name: "Roti bakar", quantity: 1 },
      ];
      const fromPos = { items, orderLabel: "A-1", source: "POS", sourceReference: "order-1" };

      // The same request ten times at once: one ticket, one station.
      const results = await Promise.all(
        Array.from({ length: 10 }, () => create.execute(tenant.id, pusat.id, fromPos)),
      );
      assert.equal(results.filter((result) => result.created).length, 1);
      assert.equal(new Set(results.map((result) => result.ticket.id)).size, 1);
      const counts = await one(
        `SELECT (SELECT count(*)::int FROM kds_tickets WHERE tenant_id = $1) AS tickets,
                (SELECT count(*)::int FROM kds_stations WHERE tenant_id = $1) AS stations,
                (SELECT count(*)::int FROM kds_ticket_items WHERE tenant_id = $1) AS items,
                (SELECT count(*)::int FROM kds_ticket_status_history WHERE tenant_id = $1) AS history`,
        [tenant.id],
      );
      assert.deepEqual(counts, { history: 1, items: 2, stations: 1, tickets: 1 });

      // The manual form and the intake API go through the same use case and
      // store the same thing; only the source differs.
      const manual = await create.execute(tenant.id, pusat.id, {
        ...fromPos,
        source: "MANUAL",
        sourceReference: "manual-key-00000001",
      });
      const api = await create.execute(tenant.id, pusat.id, {
        ...fromPos,
        source: "API",
        sourceReference: "partner-77",
      });
      // Everything but what must differ: the ID, the time, and the source.
      const shape = (ticket) => ({ ...ticket, id: null, receivedAt: null, source: null });
      assert.deepEqual(shape(manual.ticket), shape(results[0].ticket));
      assert.deepEqual(shape(api.ticket), shape(results[0].ticket));
      assert.deepEqual(
        [results[0].ticket.source, manual.ticket.source, api.ticket.source],
        ["POS", "MANUAL", "API"],
      );
      assert.deepEqual(manual.ticket.items, [
        {
          allergyNote: null,
          modifiers: ["Besar"],
          name: "Latte",
          note: "kurang manis",
          quantity: 2,
        },
        { allergyNote: "kacang", modifiers: [], name: "Roti bakar", note: null, quantity: 1 },
      ]);

      // Each outlet gets its own default station.
      await create.execute(tenant.id, timur.id, { ...fromPos, sourceReference: "order-2" });
      const stations = await database.query(
        `SELECT outlet_id, is_default FROM kds_stations WHERE tenant_id = $1 ORDER BY created_at`,
        [tenant.id],
      );
      assert.deepEqual(
        stations.rows.map((row) => [row.outlet_id, row.is_default]),
        [
          [pusat.id, true],
          [timur.id, true],
        ],
      );

      // Counted once per ticket, however often the request came.
      const usage = await one(
        `SELECT count(*)::int AS events FROM core_usage_events
         WHERE tenant_id = $1 AND dimension_key = 'kds.tickets.created.cycle'`,
        [tenant.id],
      );
      assert.equal(usage.events, 4);

      // Ten taps on the same button at once move the ticket one step, write
      // one history row, and never fail.
      const advance = app.get(AdvanceKitchenTicket);
      const queue = app.get(KitchenQueue);
      const ticketId = results[0].ticket.id;
      const taps = await Promise.all(
        Array.from({ length: 10 }, () => advance.execute(tenant.id, pusat.id, ticketId, "NEW")),
      );
      assert.deepEqual([...new Set(taps.map((ticket) => ticket.status))], ["ACCEPTED"]);
      for (const status of ["ACCEPTED", "PREPARING", "READY"]) {
        await advance.execute(tenant.id, pusat.id, ticketId, status);
      }
      const moves = await database.query(
        `SELECT from_status, to_status FROM kds_ticket_status_history
         WHERE ticket_id = $1 ORDER BY occurred_at, id`,
        [ticketId],
      );
      assert.deepEqual(
        moves.rows.map((row) => `${row.from_status ?? "-"}>${row.to_status}`),
        ["->NEW", "NEW>ACCEPTED", "ACCEPTED>PREPARING", "PREPARING>READY", "READY>SERVED"],
      );
      // Announced once each, by the kitchen, naming the order it came from
      // and carrying nothing about money.
      const announced = await database.query(
        `SELECT type, producer, payload FROM outbox_events
         WHERE tenant_id = $1 AND aggregate_type = 'kds_ticket' ORDER BY id`,
        [tenant.id],
      );
      assert.deepEqual(
        announced.rows.map((row) => [row.type, row.producer, row.payload.sourceReference]),
        [
          ["kitchen_ticket.started.v1", "KDS", "order-1"],
          ["kitchen_ticket.ready.v1", "KDS", "order-1"],
          ["kitchen_ticket.served.v1", "KDS", "order-1"],
        ],
      );
      assert.deepEqual(Object.keys(announced.rows[0].payload).sort(), [
        "occurredAt",
        "source",
        "sourceReference",
        "status",
        "ticketId",
      ]);
      // Served: out of the queue, into today's finished list.
      const open = (await queue.list(tenant.id, pusat.id)).tickets.map((ticket) => ticket.id);
      assert.equal(open.includes(ticketId), false);
      assert.equal(open.length, 2);
      assert.deepEqual(
        (await queue.finishedToday(tenant.id, pusat.id)).tickets.map((ticket) => ticket.id),
        [ticketId],
      );
      // Another outlet cannot move this outlet's ticket.
      await assert.rejects(
        advance.execute(tenant.id, timur.id, manual.ticket.id, "NEW"),
        (error) => error.getResponse().code === "KITCHEN_TICKET_NOT_FOUND",
      );

      // What happened to a ticket cannot be rewritten or removed.
      await assert.rejects(
        database.query(`UPDATE kds_ticket_status_history SET to_status = 'SERVED'`),
        /append-only/,
      );
      await assert.rejects(database.query(`DELETE FROM kds_ticket_status_history`), /append-only/);

      // The database itself refuses a second default station and a ticket on
      // another outlet's station.
      await assert.rejects(
        database.query(
          `INSERT INTO kds_stations (tenant_id, outlet_id, name, is_default) VALUES ($1, $2, 'Kedua', TRUE)`,
          [tenant.id, pusat.id],
        ),
        /kds_stations_default_outlet_key/,
      );
      const pusatStation = await one(
        `SELECT id FROM kds_stations WHERE tenant_id = $1 AND outlet_id = $2`,
        [tenant.id, pusat.id],
      );
      await assert.rejects(
        database.query(
          `INSERT INTO kds_tickets (tenant_id, outlet_id, station_id, source, source_reference, order_label)
           VALUES ($1, $2, $3, 'API', 'cross', 'X')`,
          [tenant.id, timur.id, pusatStation.id],
        ),
        /kds_tickets_station_fkey/,
      );

      // No column of the kitchen's tables can hold money.
      const columns = await database.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name LIKE 'kds\\_%'`,
      );
      assert.deepEqual(
        columns.rows
          .map((row) => row.column_name)
          .filter((name) => /price|minor|amount|total|tax|payment|phone|email/.test(name)),
        [],
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
