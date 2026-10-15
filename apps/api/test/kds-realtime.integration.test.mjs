import "reflect-metadata";

import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

import { activateDeviceSchema, KDS_REALTIME, PLAN_CODES, REALTIME_PATH } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { NestFactory } from "@nestjs/core";
import { io } from "socket.io-client";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";

const WEB_URL = "http://localhost:4000";

test("only a kitchen screen of the outlet follows its queue, and hears nothing but the outlet", async () => {
  await withDisposablePostgres(async ({ connectionString }) => {
    const previous = { databaseUrl: process.env.DATABASE_URL, webUrl: process.env.WEB_URL };
    process.env.DATABASE_URL = connectionString;
    process.env.WEB_URL = WEB_URL;
    const db = getPrismaClient();
    const { AppModule } = await import("../src/app.module.ts");
    const { AuthService, hashPassword, SESSION_COOKIE_NAME } =
      await import("../src/core/auth/public.ts");
    const { DEVICE_COOKIE_NAME, DeviceService } = await import("../src/core/devices/public.ts");
    const { AccessService } = await import("../src/core/memberships/public.ts");
    const { PlatformMasterService } =
      await import("../src/core/platform/platform-master.service.ts");
    const { CreateKitchenTicket } = await import("../src/modules/kds/public.ts");
    const { AdvanceKitchenTicket } =
      await import("../src/modules/kds/application/advance-kitchen-ticket.ts");
    const app = await NestFactory.create(AppModule, { logger: ["error"] });
    const sockets = [];
    try {
      await app.listen(0, "127.0.0.1");
      const url = await app.getUrl();
      const platform = app.get(PlatformMasterService);
      const access = app.get(AccessService);
      const auth = app.get(AuthService);
      const devices = app.get(DeviceService);
      const createTicket = app.get(CreateKitchenTicket);
      const advanceTicket = app.get(AdvanceKitchenTicket);

      const tenant = await platform.createTenant(
        { name: "Uji Realtime", slug: "uji-realtime" },
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
      const outlet = (code) =>
        db.outlet.create({
          data: {
            brandId: brand.id,
            code,
            name: code,
            tenantId: tenant.id,
            timezone: "Asia/Jakarta",
          },
        });
      const pusat = await outlet("PUSAT");
      const cabang = await outlet("CABANG");

      // Signing up gives the workspace its owner and the standard roles.
      const owner = await db.user.create({
        data: { displayName: "Pemilik", email: "pemilik@uji.test", passwordHash: "not-a-hash" },
      });
      await access.provisionTenantOwner(tenant.id, owner.id);

      const member = async (email, roleCode, outletIds) => {
        const role = await db.role.findUniqueOrThrow({
          where: { tenantId_code: { code: roleCode, tenantId: tenant.id } },
        });
        const user = await db.user.create({
          data: { displayName: email, email, passwordHash: await hashPassword("rahasia-uji-123") },
        });
        await access.createMembership(tenant.id, {
          allOutlets: outletIds === "all",
          outletIds: outletIds === "all" ? [] : outletIds,
          roleIds: [role.id],
          userId: user.id,
        });
        return user;
      };
      const cook = await member("dapur@uji.test", "KITCHEN", [pusat.id, cabang.id]);
      await member("kasir@uji.test", "CASHIER", [pusat.id]);

      const device = async (mode, outletId) => {
        const registered = await devices.register(
          tenant.id,
          { label: `${mode} ${outletId.slice(0, 4)}`, mode, outletId },
          { actorId: owner.id },
        );
        // The code as a person types it in; the schema drops the dash.
        const code = activateDeviceSchema.parse({ code: registered.activationCode }).code;
        return (await devices.activate(code, {})).credential;
      };
      const kitchenScreen = await device("KDS", pusat.id);
      const cashierScreen = await device("POS", pusat.id);

      /** The cookies a browser would send after signing in, on a device or not. */
      const signIn = async (email, deviceCredential) => {
        const { token } = await auth.login(
          { email, password: "rahasia-uji-123" },
          deviceCredential ? { deviceCredential } : {},
        );
        return [
          `${SESSION_COOKIE_NAME}=${token}`,
          ...(deviceCredential ? [`${DEVICE_COOKIE_NAME}=${deviceCredential}`] : []),
        ].join("; ");
      };

      /** Connects like the kitchen screen does; resolves once in, or with the refusal. */
      const connect = (cookie, scope, origin = WEB_URL) =>
        new Promise((resolve) => {
          const socket = io(`${url}${KDS_REALTIME.namespace}`, {
            addTrailingSlash: false,
            auth: scope,
            extraHeaders: { cookie, origin },
            path: REALTIME_PATH,
            reconnection: false,
            transports: ["websocket"],
          });
          sockets.push(socket);
          const messages = [];
          socket.on(KDS_REALTIME.queueChanged, (message) => messages.push(message));
          socket.on("connect", () => resolve({ messages, socket }));
          socket.on("connect_error", (error) =>
            resolve({ refused: error.data?.reason ?? error.message }),
          );
        });
      const settle = () => sleep(600);
      const here = { outletId: pusat.id, tenantId: tenant.id };
      const manual = (outletId, label) =>
        createTicket.execute(
          tenant.id,
          outletId,
          {
            items: [{ modifiers: [], name: "Nasi goreng", quantity: 1 }],
            orderLabel: label,
            source: "MANUAL",
            sourceReference: label,
          },
          { actorId: cook.id, channel: "KDS", requestId: "req_test" },
        );

      // The kitchen screen of the outlet, signed in by the cook: in.
      const screen = await connect(await signIn("dapur@uji.test", kitchenScreen), here);
      assert.equal(screen.refused, undefined);

      // A new ticket and a step: two messages, each naming the outlet only.
      const ticket = await manual(pusat.id, "M-1");
      await settle();
      await advanceTicket.execute(tenant.id, pusat.id, ticket.ticket.id, "NEW", {
        actorId: cook.id,
        channel: "KDS",
        requestId: "req_test",
      });
      await settle();
      assert.deepEqual(screen.messages, [{ outletId: pusat.id }, { outletId: pusat.id }]);

      // Another outlet's ticket is not this screen's business.
      await manual(cabang.id, "M-2");
      await settle();
      assert.equal(screen.messages.length, 2);

      // The same screen cannot follow another outlet's queue.
      const elsewhere = await connect(await signIn("dapur@uji.test", kitchenScreen), {
        ...here,
        outletId: cabang.id,
      });
      assert.equal(elsewhere.refused, "REALTIME_ACCESS_DENIED");

      // The cook in an ordinary browser, and on the cashier's device: no.
      const browser = await connect(await signIn("dapur@uji.test"), here);
      assert.equal(browser.refused, "KDS_DEVICE_REQUIRED");
      const register = await connect(await signIn("dapur@uji.test", cashierScreen), here);
      assert.equal(register.refused, "KDS_DEVICE_REQUIRED");

      // On the kitchen screen, but without the right to see the queue: no.
      const cashier = await connect(await signIn("kasir@uji.test", kitchenScreen), here);
      assert.equal(cashier.refused, "REALTIME_ACCESS_DENIED");

      // Without a session, without a scope, or from another site: no.
      assert.equal((await connect("", here)).refused, "REALTIME_ACCESS_DENIED");
      const cookie = await signIn("dapur@uji.test", kitchenScreen);
      assert.equal((await connect(cookie, {})).refused, "REALTIME_ACCESS_DENIED");
      assert.equal(
        (await connect(cookie, here, "https://elsewhere.test")).refused,
        "ORIGIN_NOT_ALLOWED",
      );

      // A revoked screen gets no new connection.
      const kitchenDevice = await db.coreDevice.findFirstOrThrow({
        where: { mode: "KDS", tenantId: tenant.id },
      });
      await devices.revoke(tenant.id, kitchenDevice.id, { actorId: owner.id });
      assert.equal((await connect(cookie, here)).refused, "REALTIME_ACCESS_DENIED");
    } finally {
      for (const socket of sockets) socket.disconnect();
      await app.close();
      await db.$disconnect();
      delete globalThis.prisma;
      for (const [name, value] of [
        ["DATABASE_URL", previous.databaseUrl],
        ["WEB_URL", previous.webUrl],
      ]) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });
});
