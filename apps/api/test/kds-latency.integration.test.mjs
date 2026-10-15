import "reflect-metadata";

import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

import { PLAN_CODES } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { NestFactory } from "@nestjs/core";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";

/** As apps/worker: straight on while there is work, a second's rest when the outbox is empty. */
const OUTBOX_IDLE_MS = 1_000;
const ORDERS = 200;
const WAVE = 10;
const WAVE_GAP_MS = 300;

/** The value below which `share` of the sorted samples fall. */
const percentile = (sorted, share) =>
  sorted[Math.min(sorted.length - 1, Math.ceil(share * sorted.length) - 1)];

test("an order from the cashier is a kitchen ticket within 5 seconds at p99 (M3 criterion)", async () => {
  await withDisposablePostgres(async ({ connectionString, database }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    const { AppModule } = await import("../src/app.module.ts");
    const { workerRuntimeFor } = await import("../src/worker-runtime.ts");
    const { CatalogService } = await import("../src/kernels/catalog/public.ts");
    const { OrderIntakeService } = await import("../src/kernels/order-intake/public.ts");
    const { PlatformMasterService } =
      await import("../src/core/platform/platform-master.service.ts");
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error"] });
    const worker = workerRuntimeFor(app);
    let stopping = false;
    let loop;
    try {
      const platform = app.get(PlatformMasterService);
      const catalog = app.get(CatalogService);
      const orders = app.get(OrderIntakeService);
      const tenant = await platform.createTenant(
        { name: "Uji Latensi", slug: "uji-latensi" },
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
      await catalog.createOutletProduct(tenant.id, { outletId: outlet.id, productId: product.id });
      const cashier = await db.user.create({
        data: { displayName: "Kasir", email: "kasir@uji.test", passwordHash: "not-a-hash" },
      });

      // The worker, running as it does in production.
      loop = (async () => {
        while (!stopping) {
          const taken = await worker.dispatchBatch();
          if (taken === 0 && !stopping) await sleep(OUTBOX_IDLE_MS);
        }
      })();

      const submittedAt = new Map();
      const seenAt = new Map();
      // Watches for tickets every 50 ms, so it adds at most that to a reading.
      const watcher = (async () => {
        while (seenAt.size < ORDERS) {
          const rows = await database.query(
            `SELECT source_reference FROM kds_tickets WHERE tenant_id = $1`,
            [tenant.id],
          );
          const now = Date.now();
          for (const row of rows.rows) {
            if (!seenAt.has(row.source_reference)) seenAt.set(row.source_reference, now);
          }
          await sleep(50);
        }
      })();

      for (let wave = 0; wave < ORDERS / WAVE; wave += 1) {
        await Promise.all(
          Array.from({ length: WAVE }, async (_, index) => {
            const order = await orders.submitPosOrder(
              tenant.id,
              outlet.id,
              {
                items: [{ modifierOptionIds: [], productId: product.id, quantity: 1 }],
                orderType: "TAKEAWAY",
              },
              `latency-${wave}-${index}-0000000`,
              { actorId: cashier.id, channel: "POS", requestId: "req_latency" },
            );
            submittedAt.set(order.id, Date.now());
          }),
        );
        await sleep(WAVE_GAP_MS);
      }
      await Promise.race([
        watcher,
        sleep(60_000).then(() => {
          throw new Error(`only ${seenAt.size} of ${ORDERS} tickets after a minute`);
        }),
      ]);

      const samples = [...submittedAt]
        .map(([orderId, at]) => seenAt.get(orderId) - at)
        .sort((left, right) => left - right);
      const summary = {
        max: samples.at(-1),
        p50: percentile(samples, 0.5),
        p95: percentile(samples, 0.95),
        p99: percentile(samples, 0.99),
      };
      process.stdout.write(
        `kitchen ticket latency over ${ORDERS} orders (ms): ${JSON.stringify(summary)}\n`,
      );
      assert.equal(samples.length, ORDERS);
      // One ticket per order: nothing doubled.
      const tickets = await database.query(
        `SELECT count(*)::int AS count FROM kds_tickets WHERE tenant_id = $1`,
        [tenant.id],
      );
      assert.equal(tickets.rows[0].count, ORDERS);
      assert.ok(summary.p99 <= 5_000, `p99 ${summary.p99} ms is over 5 s`);
    } finally {
      stopping = true;
      await loop;
      await app.close();
      await db.$disconnect();
      delete globalThis.prisma;
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
