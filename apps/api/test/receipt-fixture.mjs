import "reflect-metadata";

import { randomUUID } from "node:crypto";
import process from "node:process";
import { MODULES, PERMISSIONS, PLAN_CODES } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { NestFactory } from "@nestjs/core";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";

const { fetch } = globalThis;

/** Owned PostgreSQL only: real order/payment/refund commands, no development accounts or bucket IO. */
export async function withReceiptFixture(run, options = {}) {
  return withDisposablePostgres(async ({ connectionString }) => {
    const previous = {
      DATABASE_URL: process.env.DATABASE_URL,
      RATE_LIMIT_STORE: process.env.RATE_LIMIT_STORE,
      WEB_URL: process.env.WEB_URL,
    };
    process.env.DATABASE_URL = connectionString;
    process.env.RATE_LIMIT_STORE = "memory";
    if (options.webURL) process.env.WEB_URL = options.webURL;
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
    const { TableSessions } = await import("../src/modules/floor/public.ts");
    const { ShiftService } = await import("../src/modules/pos-sales/application/shift.service.ts");
    const { CheckoutService } =
      await import("../src/modules/pos-sales/application/checkout.service.ts");
    const app = await NestFactory.create(AppModule, { logger: ["error"] });
    app.use(createCsrfProtectionMiddleware());
    app.use(createSecurityHeadersMiddleware());
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new ApiExceptionFilter());
    try {
      await app.listen(options.port ?? 0, "127.0.0.1");
      const base = `${await app.getUrl()}/api/v1`;
      const access = app.get(AccessService),
        auth = app.get(AuthService),
        platform = app.get(PlatformMasterService);
      const catalog = app.get(CatalogService),
        orders = app.get(OrderIntakeService),
        tables = app.get(TableSessions);
      const checkout = app.get(CheckoutService),
        shifts = app.get(ShiftService);
      const password = randomUUID(),
        passwordHash = await hashPassword(password);
      const people = {};
      for (const name of ["owner", "cashier", "reader"])
        people[name] = await db.user.create({
          data: {
            displayName: name === "owner" ? "Kasir Struk" : `${name} Struk`,
            email: `${name}@receipt-fixture.test`,
            passwordHash,
          },
        });
      const origin = { actorId: people.owner.id, channel: "POS" };
      const workspaces = {};
      for (const [code, currency, prices] of [
        ["idr", "IDR", ["50000", "25000"]],
        ["usd", "USD", ["1025", "2050"]],
      ]) {
        const tenant = await platform.createTenant(
          { name: `Receipt ${currency}`, slug: `receipt-${code}` },
          { actorId: undefined },
        );
        // Seed the currency before any catalog amount exists; do not change a workspace with money.
        await db.tenant.update({ where: { id: tenant.id }, data: { currency } });
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
          data: { tenantId: tenant.id, name: "Receipt fixture", slug: "receipt-fixture" },
        });
        const outlet = await db.outlet.create({
          data: {
            tenantId: tenant.id,
            brandId: brand.id,
            name: `Outlet ${currency}`,
            code: "MAIN",
            chargesIncluded: true,
            taxRateBp: 0,
            serviceChargeRateBp: 0,
          },
        });
        await access.provisionTenantOwner(tenant.id, people.owner.id);
        const cashierRole = await db.role.findUniqueOrThrow({
          where: { tenantId_code: { tenantId: tenant.id, code: "CASHIER" } },
        });
        const readerRole = await access.createRole(tenant.id, {
          code: "RECEIPT_READER",
          name: "Table reader",
          permissionKeys: [PERMISSIONS.tableView],
        });
        for (const [role, person] of [
          [cashierRole, people.cashier],
          [readerRole, people.reader],
        ])
          await access.createMembership(tenant.id, {
            userId: person.id,
            roleIds: [role.id],
            allOutlets: true,
            outletIds: [],
          });
        await app.get(InstallationService).install(tenant.id, MODULES.tableSelfOrder, origin);
        const area = await db.floorArea.findFirstOrThrow({
          where: { tenantId: tenant.id, outletId: outlet.id },
        });
        const category = await catalog.createCategory(tenant.id, {
          name: "Minuman",
          slug: "minuman",
        });
        const products = [];
        for (const [index, price] of prices.entries()) {
          const product = await catalog.createProduct(tenant.id, {
            name: index === 0 ? "Kopi" : "Teh",
            slug: index === 0 ? "kopi" : "teh",
            categoryId: category.id,
            basePriceMinor: price,
          });
          await catalog.createOutletProduct(tenant.id, {
            outletId: outlet.id,
            productId: product.id,
          });
          products.push(product);
        }
        const shift = await shifts.open(
          tenant.id,
          outlet.id,
          { openingCashMinor: "1000000" },
          origin,
        );
        async function shared(label, method) {
          const table = await db.floorServiceTable.create({
            data: {
              tenantId: tenant.id,
              outletId: outlet.id,
              areaId: area.id,
              label,
              capacity: 2,
              shape: "SQUARE",
              visualSize: "SMALL",
              gridW: 2,
              gridH: 2,
            },
          });
          const visit = await tables.open(
            tenant.id,
            outlet.id,
            { tableId: table.id, guestCount: 2 },
            origin,
          );
          const taken = [];
          for (const product of products)
            taken.push(
              await orders.submitTableOrder(
                tenant.id,
                outlet.id,
                visit.id,
                { items: [{ productId: product.id, modifierOptionIds: [], quantity: 1 }] },
                randomUUID(),
                origin,
              ),
            );
          const pay =
            method === "CASH"
              ? { method, tenderedMinor: currency === "IDR" ? "100000" : "4000" }
              : { method, reference: "BANK-RECEIPT-001" };
          const paid = await checkout.payTableSession(
            tenant.id,
            outlet.id,
            visit.id,
            pay,
            randomUUID(),
            origin,
          );
          return {
            sessionId: visit.id,
            orderIds: taken.map((order) => order.id),
            orderNumbers: taken.map((order) => order.orderNumber),
            paymentId: paid.payment.id,
          };
        }
        const cashShared = await shared("T1", "CASH");
        const transferShared = await shared("T2", "TRANSFER");
        const single = await orders.submitPosOrder(
          tenant.id,
          outlet.id,
          {
            orderType: "TAKEAWAY",
            items: [{ productId: products[1].id, modifierOptionIds: [], quantity: 1 }],
          },
          randomUUID(),
          origin,
        );
        await checkout.payOrder(
          tenant.id,
          outlet.id,
          single.id,
          { method: "CASH", tenderedMinor: currency === "IDR" ? "50000" : "3000" },
          randomUUID(),
          origin,
        );
        workspaces[code] = {
          tenantId: tenant.id,
          outletId: outlet.id,
          shiftId: shift.id,
          currency,
          cashShared,
          transferShared,
          singleCash: { orderId: single.id, orderNumber: single.orderNumber },
        };
      }
      const cookies = {};
      for (const [name, person] of Object.entries(people))
        cookies[name] = [
          {
            name: SESSION_COOKIE_NAME,
            value: (await auth.login({ email: person.email, password })).token,
          },
        ];
      const data = { workspaces, cookies };
      const request = async (
        method,
        route,
        body,
        { workspace = "idr", role = "owner", headers = {} } = {},
      ) => {
        const scope = workspaces[workspace];
        const response = await fetch(base + route, {
          method,
          ...(body ? { body: JSON.stringify(body) } : {}),
          headers: {
            "content-type": "application/json",
            cookie: cookies[role].map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
            "x-tenant-id": scope.tenantId,
            "x-outlet-id": scope.outletId,
            "x-csrf-token": "receipt-fixture-test-csrf",
            "idempotency-key": randomUUID(),
            ...headers,
          },
        });
        return { status: response.status, body: await response.json() };
      };
      return await run({ app, db, base, data, request, ownerId: people.owner.id });
    } finally {
      await app.close();
      await db.$disconnect();
      delete globalThis.prisma;
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
}
