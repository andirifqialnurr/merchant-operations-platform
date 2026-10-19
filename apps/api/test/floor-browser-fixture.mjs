import "reflect-metadata";

import { randomUUID } from "node:crypto";
import process from "node:process";
import { setInterval, clearInterval } from "node:timers";

import { MODULES, PERMISSIONS, PLAN_CODES } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { NestFactory } from "@nestjs/core";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";

if (!process.send) throw new Error("Start the Floor browser fixture through its dedicated runner.");
const stopped = new Promise((resolve) => {
  process.once("disconnect", resolve);
  process.once("SIGTERM", resolve);
  process.once("SIGINT", resolve);
  process.on("message", (message) => {
    if (message?.type === "stop") resolve();
  });
});

try {
  await withDisposablePostgres(async ({ connectionString }) => {
    process.env.DATABASE_URL = connectionString;
    process.env.RATE_LIMIT_STORE = "memory";
    process.env.WEB_URL = process.env.E2E_BASE_URL ?? "http://localhost:4100";
    const db = getPrismaClient();
    const { AppModule } = await import("../src/app.module.ts");
    const { ApiExceptionFilter } = await import("../src/bootstrap/api-exception.filter.ts");
    const { createCsrfProtectionMiddleware, createSecurityHeadersMiddleware } =
      await import("../src/bootstrap/http-security.ts");
    const { AuthService, hashPassword, SESSION_COOKIE_NAME } =
      await import("../src/core/auth/public.ts");
    const { AccessService } = await import("../src/core/memberships/public.ts");
    const { InstallationService } = await import("../src/core/installations/public.ts");
    const { PlatformMasterService } =
      await import("../src/core/platform/platform-master.service.ts");
    const { CatalogService } = await import("../src/kernels/catalog/public.ts");
    const { OrderIntakeService } = await import("../src/kernels/order-intake/public.ts");
    const { TableQrCodes } = await import("../src/modules/floor/application/table-qr-codes.ts");
    const { TableSessions } = await import("../src/modules/floor/public.ts");
    const { GuestOrdering } = await import("../src/modules/floor/application/guest-ordering.ts");
    const { workerRuntimeFor } = await import("../src/worker-runtime.ts");
    const app = await NestFactory.create(AppModule, { logger: ["error"] });
    app.use(createSecurityHeadersMiddleware());
    app.use(createCsrfProtectionMiddleware());
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new ApiExceptionFilter());
    let timer;
    let draining;
    try {
      await app.listen(Number(process.env.E2E_FLOOR_API_PORT ?? 4101), "127.0.0.1");
      const platform = app.get(PlatformMasterService),
        access = app.get(AccessService),
        auth = app.get(AuthService);
      const tenant = await platform.createTenant(
        { name: "Meja Browser", slug: "meja-browser" },
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
        data: { tenantId: tenant.id, name: "Kopi Browser", slug: "kopi-browser" },
      });
      const outlet = await db.outlet.create({
        data: { tenantId: tenant.id, brandId: brand.id, name: "Utama", code: "MAIN" },
      });
      const password = randomUUID(),
        passwordHash = await hashPassword(password);
      const owner = await db.user.create({
        data: { email: "owner@floor-browser.test", displayName: "Pemilik Uji", passwordHash },
      });
      await access.provisionTenantOwner(tenant.id, owner.id);
      const origin = { actorId: owner.id, channel: "WEB" };
      await app.get(InstallationService).install(tenant.id, MODULES.tableSelfOrder, origin);
      const cookies = {};
      const login = async (person) => [
        {
          name: SESSION_COOKIE_NAME,
          value: (await auth.login({ email: person.email, password })).token,
        },
      ];
      cookies.owner = await login(owner);
      for (const [name, code] of [
        ["cashier", "CASHIER"],
        ["waiter", "WAITER"],
        ["reader", "FLOOR_READER"],
      ]) {
        const person = await db.user.create({
          data: { email: `${name}@floor-browser.test`, displayName: `${name} Uji`, passwordHash },
        });
        const role =
          code === "FLOOR_READER"
            ? await access.createRole(tenant.id, {
                code,
                name: "Floor reader",
                permissionKeys: [PERMISSIONS.tableView],
              })
            : await db.role.findUniqueOrThrow({
                where: { tenantId_code: { tenantId: tenant.id, code } },
              });
        await access.createMembership(tenant.id, {
          userId: person.id,
          allOutlets: true,
          outletIds: [],
          roleIds: [role.id],
        });
        cookies[name] = await login(person);
      }
      const area = await db.floorArea.findFirstOrThrow({
        where: { tenantId: tenant.id, outletId: outlet.id },
      });
      const table = await db.floorServiceTable.create({
        data: {
          tenantId: tenant.id,
          outletId: outlet.id,
          areaId: area.id,
          label: "T1",
          capacity: 4,
          shape: "SQUARE",
          visualSize: "SMALL",
          gridX: 1,
          gridY: 1,
          gridW: 2,
          gridH: 2,
        },
      });
      const tables = app.get(TableSessions),
        codes = app.get(TableQrCodes),
        orders = app.get(OrderIntakeService);
      await tables.setPolicy(tenant.id, outlet.id, { cleaningAfterClose: false }, origin);
      await codes.generate(tenant.id, outlet.id, table.id, origin);
      const catalog = app.get(CatalogService);
      const category = await catalog.createCategory(tenant.id, {
        name: "Minuman",
        slug: "minuman",
      });
      const tea = await catalog.createProduct(tenant.id, {
        name: "Teh",
        slug: "teh",
        categoryId: category.id,
        basePriceMinor: "20000",
      });
      const latte = await catalog.createProduct(tenant.id, {
        name: "Latte",
        slug: "latte",
        categoryId: category.id,
        basePriceMinor: "25000",
      });
      await catalog.createOutletProduct(tenant.id, { outletId: outlet.id, productId: tea.id });
      await catalog.createOutletProduct(tenant.id, { outletId: outlet.id, productId: latte.id });
      const variant = await catalog.createProductVariant(tenant.id, {
        productId: latte.id,
        name: "Besar",
        priceDeltaMinor: "5000",
      });
      const group = await catalog.createModifierGroup(tenant.id, {
        name: "Susu",
        minSelections: 0,
        maxSelections: 1,
        selectionType: "SINGLE",
      });
      const option = await catalog.createModifierOption(tenant.id, {
        groupId: group.id,
        name: "Susu oat",
        priceDeltaMinor: "3000",
      });
      await catalog.createProductModifierGroup(tenant.id, {
        modifierGroupId: group.id,
        productId: latte.id,
      });
      const worker = workerRuntimeFor(app);
      const drain = () => {
        if (!draining)
          draining = (async () => {
            for (let count = await worker.dispatchBatch(); count > 0;)
              count = await worker.dispatchBatch();
          })().finally(() => {
            draining = undefined;
          });
        return draining;
      };
      timer = setInterval(() => void drain().catch(() => {}), 100);
      let token;
      process.on("message", async (message) => {
        if (!message?.id || !["reset", "snapshot"].includes(message.type)) return;
        try {
          if (message.type === "reset") {
            const held = await db.floorSessionTable.findFirst({
              where: { tenantId: tenant.id, tableId: table.id, detachedAt: null },
            });
            if (held) {
              for (const order of await orders.listBySession(
                tenant.id,
                outlet.id,
                held.sessionId,
              )) {
                if (order.status !== "CANCELED")
                  await orders.cancelOrder(
                    tenant.id,
                    outlet.id,
                    order.id,
                    "Fixture reset",
                    async () => {},
                    origin,
                  );
              }
              await tables.close(tenant.id, outlet.id, held.sessionId, origin);
            }
            const qr = await codes.rotate(tenant.id, outlet.id, table.id, origin);
            token = qr.url.split("/t/")[1];
            const count = message.seed ?? 0;
            for (let index = 0; index < count; index += 1) {
              await app.get(GuestOrdering).placeOrder(
                token,
                {
                  items:
                    index === 0
                      ? [
                          {
                            productId: latte.id,
                            variantId: variant.id,
                            modifierOptionIds: [option.id],
                            quantity: 2,
                            note: "Sajikan tanpa es; pisahkan pemanis dari minuman.",
                          },
                        ]
                      : [{ productId: tea.id, modifierOptionIds: [], quantity: 1 }],
                  ...(index === 0
                    ? {
                        note: "Pesanan rombongan: bawa minuman lebih dahulu, lalu panggil pelayan bila semua sudah siap.",
                      }
                    : {}),
                },
                randomUUID(),
                "browser-fixture",
              );
            }
            process.send({ type: "result", id: message.id, data: { token } });
          } else {
            await drain();
            const held = await db.floorSessionTable.findFirst({
              where: { tenantId: tenant.id, tableId: table.id, detachedAt: null },
            });
            const visitOrders = held
              ? await orders.listBySession(tenant.id, outlet.id, held.sessionId)
              : [];
            const ids = visitOrders.map((order) => order.id);
            process.send({
              type: "result",
              id: message.id,
              data: {
                sessionId: held?.sessionId ?? null,
                orders: visitOrders.map((order) => ({
                  id: order.id,
                  orderNumber: order.orderNumber,
                  moderationStatus: order.moderationStatus,
                  status: order.status,
                  cancelReason: order.cancelReason,
                })),
                tickets: await db.kdsTicket.count({
                  where: { tenantId: tenant.id, sourceReference: { in: ids } },
                }),
                bills: await db.bill.count({
                  where: { tenantId: tenant.id, orderId: { in: ids } },
                }),
                submittedEvents: await db.outboxEvent.count({
                  where: {
                    tenantId: tenant.id,
                    aggregateId: { in: ids },
                    type: "order.submitted.v1",
                  },
                }),
              },
            });
          }
        } catch {
          process.send({ type: "failed", id: message.id, message: "Floor scenario failed." });
        }
      });
      process.send({
        type: "ready",
        data: { tenantId: tenant.id, outletId: outlet.id, tableId: table.id, cookies },
      });
      await stopped;
    } finally {
      clearInterval(timer);
      await draining?.catch(() => {});
      await app.close();
      await db.$disconnect();
      delete globalThis.prisma;
    }
  });
} catch {
  if (process.connected)
    process.send({
      type: "failed",
      message: "Floor fixture setup failed; check PostgreSQL and the dedicated API port.",
    });
  process.exitCode = 1;
} finally {
  if (process.connected) process.disconnect();
}
