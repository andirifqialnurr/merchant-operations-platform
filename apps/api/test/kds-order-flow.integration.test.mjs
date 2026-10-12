import "reflect-metadata";

import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";

import { MODULES, PLAN_CODES } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { NestFactory } from "@nestjs/core";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";

test("orders reach the kitchen through the worker: POS + KDS, POS only, KDS only", async () => {
  await withDisposablePostgres(async ({ connectionString, database }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    const { AppModule } = await import("../src/app.module.ts");
    const { workerRuntimeFor } = await import("../src/worker-runtime.ts");
    const { CatalogService } = await import("../src/kernels/catalog/public.ts");
    const { OrderIntakeService } = await import("../src/kernels/order-intake/public.ts");
    const { CreateKitchenTicket } = await import("../src/modules/kds/public.ts");
    const { AdvanceKitchenTicket } =
      await import("../src/modules/kds/application/advance-kitchen-ticket.ts");
    const { EntitlementService } = await import("../src/core/entitlements/public.ts");
    const { PlatformMasterService } =
      await import("../src/core/platform/platform-master.service.ts");
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error"] });
    // The worker's delivery loop as it runs in production: the same handlers,
    // bindings, and inbox. Creating it also checks that every handler a
    // manifest declares is registered, and the other way round.
    const worker = workerRuntimeFor(app);
    try {
      const platform = app.get(PlatformMasterService);
      const catalog = app.get(CatalogService);
      const orders = app.get(OrderIntakeService);
      const entitlements = app.get(EntitlementService);
      const context = { actorId: undefined };
      const startsAt = new Date(Date.now() - 60_000).toISOString();
      const rows = async (sql, values) => (await database.query(sql, values)).rows;
      const drain = async () => {
        let delivered = 0;
        for (let taken = await worker.dispatchBatch(); taken > 0;) {
          delivered += taken;
          taken = await worker.dispatchBatch();
        }
        return delivered;
      };
      assert.ok(worker.handlerNames.includes("kds.create_ticket"));
      assert.ok(worker.handlerNames.includes("kds.cancel_ticket"));

      const cashier = await db.user.create({
        data: { displayName: "Kasir Uji", email: "kasir@uji.test", passwordHash: "not-a-hash" },
      });
      const origin = { actorId: cashier.id, channel: "POS", requestId: "req_test" };

      /** A workspace with one outlet and one product on its menu. */
      const business = async (slug, subscribe) => {
        const tenant = await platform.createTenant({ name: `Uji ${slug}`, slug }, context);
        await subscribe(tenant.id);
        const brand = await db.brand.create({
          data: { name: "Uji", slug: "uji", tenantId: tenant.id },
        });
        const outlet = await db.outlet.create({
          data: { brandId: brand.id, code: "PUSAT", name: "Pusat", tenantId: tenant.id },
        });
        const category = await catalog.createCategory(tenant.id, {
          name: "Minuman",
          slug: "minuman",
        });
        const product = await catalog.createProduct(tenant.id, {
          basePriceMinor: "25000",
          categoryId: category.id,
          name: "Latte",
          slug: "latte",
        });
        await catalog.createOutletProduct(tenant.id, {
          outletId: outlet.id,
          productId: product.id,
        });
        const order = (key, note) =>
          orders.submitPosOrder(
            tenant.id,
            outlet.id,
            {
              items: [
                {
                  modifierOptionIds: [],
                  productId: product.id,
                  quantity: 2,
                  ...(note ? { note } : {}),
                },
              ],
              orderType: "TAKEAWAY",
            },
            key,
            origin,
          );
        return { order, outletId: outlet.id, tenantId: tenant.id };
      };
      const plan = (planCode) => (tenantId) =>
        platform.replaceSubscription(tenantId, { planCode, startsAt, status: "ACTIVE" }, context);
      const tickets = (tenantId) =>
        rows(
          `SELECT t.id, t.source, t.source_reference, t.order_label, t.status,
                  (SELECT json_agg(json_build_object('name', i.name_snapshot, 'quantity', i.quantity,
                                                     'note', i.note) ORDER BY i.position)
                   FROM kds_ticket_items i WHERE i.ticket_id = t.id) AS items
           FROM kds_tickets t WHERE t.tenant_id = $1 ORDER BY t.created_at`,
          [tenantId],
        );
      const inbox = (tenantId, consumer) =>
        rows(`SELECT status FROM core_inbox_events WHERE tenant_id = $1 AND consumer_name = $2`, [
          tenantId,
          consumer,
        ]);

      // --- POS + KDS ------------------------------------------------------
      const both = await business("pos-kds", plan(PLAN_CODES.cafeOperations));
      const bindings = await rows(
        `SELECT event_type, handler_key, status FROM core_integration_bindings
         WHERE tenant_id = $1 AND target_module_key = 'KDS' ORDER BY event_type`,
        [both.tenantId],
      );
      assert.deepEqual(
        bindings.map((row) => `${row.event_type} ${row.handler_key} ${row.status}`),
        [
          "order.canceled.v1 kds.cancel_ticket ACTIVE",
          "order.submitted.v1 kds.create_ticket ACTIVE",
        ],
      );

      const first = await both.order("order-key-000000000001", "kurang manis");
      assert.deepEqual(
        await tickets(both.tenantId),
        [],
        "nothing reaches the kitchen in the request",
      );
      assert.ok((await drain()) > 0);
      const [ticket] = await tickets(both.tenantId);
      assert.deepEqual(
        {
          items: ticket.items,
          label: ticket.order_label,
          reference: ticket.source_reference,
          source: ticket.source,
          status: ticket.status,
        },
        {
          // The note a person typed reached the kitchen without travelling in the event.
          items: [{ name: "Latte", note: "kurang manis", quantity: 2 }],
          label: `#${first.orderNumber}`,
          reference: first.id,
          source: "POS",
          status: "NEW",
        },
      );
      const [submitted] = await rows(
        `SELECT payload FROM outbox_events WHERE tenant_id = $1 AND type = 'order.submitted.v1'`,
        [both.tenantId],
      );
      assert.doesNotMatch(JSON.stringify(submitted.payload), /kurang manis|25000|50000/);

      // The same event delivered again: still one ticket.
      await database.query(
        `UPDATE outbox_events SET processed_at = NULL
         WHERE tenant_id = $1 AND type = 'order.submitted.v1'`,
        [both.tenantId],
      );
      await drain();
      assert.equal((await tickets(both.tenantId)).length, 1);

      // Canceling the order marks the ticket; the ticket stays.
      // Nothing was paid, so nothing stands in the way of canceling.
      await orders.cancelOrder(
        both.tenantId,
        both.outletId,
        first.id,
        "salah pesan",
        async () => undefined,
        origin,
      );
      await drain();
      const afterCancel = await tickets(both.tenantId);
      assert.deepEqual(
        afterCancel.map((row) => row.status),
        ["CANCELED"],
      );
      assert.deepEqual(
        (
          await rows(
            `SELECT from_status, to_status FROM kds_ticket_status_history
             WHERE ticket_id = $1 ORDER BY occurred_at, id`,
            [ticket.id],
          )
        ).map((row) => `${row.from_status ?? "-"}>${row.to_status}`),
        ["->NEW", "NEW>CANCELED"],
      );
      assert.deepEqual(
        (await inbox(both.tenantId, "kds.cancel_ticket")).map((row) => row.status),
        ["PROCESSED"],
      );

      // The order follows its ticket, apart from whether it was paid.
      const second = await both.order("order-key-000000000009");
      await drain();
      const followed = (await tickets(both.tenantId)).find(
        (row) => row.source_reference === second.id,
      );
      const orderStatus = async () =>
        (await rows(`SELECT status FROM order_orders WHERE id = $1`, [second.id]))[0].status;
      const advance = app.get(AdvanceKitchenTicket);
      await advance.execute(both.tenantId, both.outletId, followed.id, "NEW");
      await drain();
      assert.equal(await orderStatus(), "SUBMITTED", "accepting is the kitchen's own business");
      await advance.execute(both.tenantId, both.outletId, followed.id, "ACCEPTED");
      await drain();
      assert.equal(await orderStatus(), "PREPARING");
      await advance.execute(both.tenantId, both.outletId, followed.id, "PREPARING");
      await advance.execute(both.tenantId, both.outletId, followed.id, "READY");
      await drain();
      assert.equal(await orderStatus(), "SERVED");
      assert.deepEqual(
        await rows(`SELECT count(*)::int AS bills FROM billing_bills WHERE order_id = $1`, [
          second.id,
        ]),
        [{ bills: 0 }],
        "served, and still not paid",
      );

      // --- POS only: the same order events, no kitchen --------------------
      const posOnly = await business("pos-saja", plan(PLAN_CODES.posBasic));
      assert.equal(
        (await entitlements.describeAccess(posOnly.tenantId, MODULES.kds)).module?.entitled,
        false,
      );
      await posOnly.order("order-key-000000000002");
      await drain();
      assert.deepEqual(await tickets(posOnly.tenantId), []);
      const pending = await rows(
        `SELECT type, processed_at IS NOT NULL AS done, failed_at IS NOT NULL AS failed
         FROM outbox_events WHERE tenant_id = $1 AND type = 'order.submitted.v1'`,
        [posOnly.tenantId],
      );
      assert.deepEqual(pending, [{ done: true, failed: false, type: "order.submitted.v1" }]);

      // --- KDS only: tickets by hand, no cashier --------------------------
      const kdsOnly = await business("kds-saja", async (tenantId) => {
        await plan(PLAN_CODES.profile)(tenantId);
        await platform.setEntitlement(
          tenantId,
          MODULES.kds,
          { enabled: true, reason: "integration test: kitchen sold on its own" },
          // A context was enough to make this fail before: the write named a column the table lacks.
          { requestId: "req_override" },
        );
      });
      const access = async (moduleKey) => {
        const described = await entitlements.describeAccess(kdsOnly.tenantId, moduleKey);
        return `${described.module?.entitled} ${described.installation ?? "-"}`;
      };
      assert.equal(await access(MODULES.kds), "true ACTIVE");
      assert.equal((await access(MODULES.pos)).startsWith("false"), true);
      const byHand = await app.get(CreateKitchenTicket).execute(
        kdsOnly.tenantId,
        kdsOnly.outletId,
        {
          items: [{ name: "Nasi goreng", note: "pedas", quantity: 1 }],
          orderLabel: "Meja 4",
          source: "MANUAL",
          sourceReference: "manual-key-00000001",
        },
        origin,
      );
      assert.equal(byHand.created, true);
      assert.deepEqual(
        (await tickets(kdsOnly.tenantId)).map((row) => `${row.source} ${row.order_label}`),
        ["MANUAL Meja 4"],
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
