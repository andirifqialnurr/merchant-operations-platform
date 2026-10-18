import "reflect-metadata";

import { randomUUID } from "node:crypto";
import process from "node:process";

import { activateDeviceSchema, PLAN_CODES } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { NestFactory } from "@nestjs/core";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";

// Only the dedicated Playwright KDS runner forks this process. Credentials
// travel over IPC, never stdout or a checked-in file. No development rows
// are touched; disconnecting the parent closes the API and drops its DB.
if (!process.send) throw new Error("Start the KDS browser fixture through its Playwright runner.");
const stopped = new Promise((resolve) => {
  process.once("disconnect", resolve);
  process.on("message", (message) => {
    if (message?.type === "stop") resolve();
  });
  process.once("SIGTERM", resolve);
  process.once("SIGINT", resolve);
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
    const { DeviceService, DEVICE_COOKIE_NAME } = await import("../src/core/devices/public.ts");
    const { PlatformMasterService } =
      await import("../src/core/platform/platform-master.service.ts");
    const { CreateKitchenTicket } = await import("../src/modules/kds/public.ts");
    const { AdvanceKitchenTicket } =
      await import("../src/modules/kds/application/advance-kitchen-ticket.ts");
    const app = await NestFactory.create(AppModule, { logger: ["error"] });
    app.use(createSecurityHeadersMiddleware());
    app.use(createCsrfProtectionMiddleware());
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new ApiExceptionFilter());
    try {
      // The dedicated web's rewrite points here, never at the developer API.
      const port = Number(process.env.E2E_KDS_API_PORT ?? 4101);
      await app.listen(port, "127.0.0.1");
      const platform = app.get(PlatformMasterService);
      const access = app.get(AccessService);
      const auth = app.get(AuthService);
      const devices = app.get(DeviceService);
      const create = app.get(CreateKitchenTicket);
      const advance = app.get(AdvanceKitchenTicket);
      const tenant = await platform.createTenant(
        { name: "Dapur Browser", slug: "dapur-browser" },
        { actorId: undefined },
      );
      await platform.replaceSubscription(
        tenant.id,
        {
          planCode: PLAN_CODES.kdsOnly,
          startsAt: new Date(Date.now() - 60_000).toISOString(),
          status: "ACTIVE",
        },
        { actorId: undefined },
      );
      const brand = await db.brand.create({
        data: { tenantId: tenant.id, name: "Dapur", slug: "dapur" },
      });
      const outlet = await db.outlet.create({
        data: {
          tenantId: tenant.id,
          brandId: brand.id,
          code: "MAIN",
          name: "Dapur Utama",
          timezone: "Asia/Jakarta",
        },
      });
      const password = randomUUID();
      const passwordHash = await hashPassword(password);
      const owner = await db.user.create({
        data: { email: "owner@kds-browser.test", displayName: "Pemilik Uji", passwordHash },
      });
      await access.provisionTenantOwner(tenant.id, owner.id);
      const cook = await db.user.create({
        data: { email: "cook@kds-browser.test", displayName: "Dapur Uji", passwordHash },
      });
      const role = await db.role.findUniqueOrThrow({
        where: { tenantId_code: { tenantId: tenant.id, code: "KITCHEN" } },
      });
      await access.createMembership(tenant.id, {
        allOutlets: false,
        outletIds: [outlet.id],
        roleIds: [role.id],
        userId: cook.id,
      });
      const registered = await devices.register(
        tenant.id,
        { label: "Monitor browser", mode: "KDS", outletId: outlet.id },
        { actorId: owner.id },
      );
      const { credential } = await devices.activate(
        activateDeviceSchema.parse({ code: registered.activationCode }).code,
        {},
      );
      const ownerSession = await auth.login({ email: owner.email, password });
      const cookSession = await auth.login(
        { email: cook.email, password },
        { deviceCredential: credential },
      );
      const origin = { actorId: cook.id, channel: "KDS" };
      const states = ["NEW", "ACCEPTED", "PREPARING", "READY"];
      for (const [index, state] of states.entries()) {
        let { ticket } = await create.execute(
          tenant.id,
          outlet.id,
          {
            source: "MANUAL",
            sourceReference: `visual-${state}`,
            orderLabel: `Visual ${state}`,
            items: [
              {
                name: "Nasi goreng",
                quantity: 2,
                modifiers: ["Tanpa telur"],
                note: "Tidak pedas",
                allergyNote: "Kacang",
              },
            ],
          },
          origin,
        );
        for (let step = 0; step < index; step += 1) {
          ticket = await advance.execute(tenant.id, outlet.id, ticket.id, ticket.status, origin);
        }
        await db.kdsTicket.update({
          where: { id: ticket.id },
          data: {
            receivedAt: new Date(Date.now() - (index === 1 ? 11 : index === 2 ? 16 : 1) * 60_000),
          },
        });
      }
      // Visual stress scenarios use only this owned disposable database.
      // Finish previous tickets through the same lifecycle instead of deleting history.
      process.on("message", async (message) => {
        if (message?.type !== "scenario") return;
        try {
          const pending = await db.kdsTicket.findMany({
            where: { tenantId: tenant.id, status: { notIn: ["SERVED", "CANCELED"] } },
          });
          for (let ticket of pending) {
            while (ticket.status !== "SERVED") {
              ticket = await advance.execute(
                tenant.id,
                outlet.id,
                ticket.id,
                ticket.status,
                origin,
              );
            }
          }
          const statuses =
            message.value === "single"
              ? Array(9).fill("NEW")
              : message.value === "empty"
                ? []
                : [...Array(7).fill("NEW"), ...Array(3).fill("PREPARING")];
          for (const [index, status] of statuses.entries()) {
            let { ticket } = await create.execute(
              tenant.id,
              outlet.id,
              {
                source: "MANUAL",
                sourceReference: `${message.id}-${index}`,
                orderLabel:
                  index === 6
                    ? "Pesanan rombongan lantai atas dengan label panjang"
                    : `Padat ${index + 1}`,
                ...(index % 2 === 0 ? { tableLabel: "Teras 2" } : {}),
                items: Array.from({ length: index === 1 ? 6 : (index % 3) + 1 }, (_, item) => ({
                  name:
                    item === 0
                      ? "Kopi susu gula aren ukuran besar dengan susu oat"
                      : `Menu pendamping ${item}`,
                  quantity: item + 1,
                  modifiers: item === 0 ? ["Panas", "Susu oat", "Gula dipisah"] : [],
                  ...(item === 0
                    ? {
                        note: "Sajikan minuman lebih dahulu. Jangan gunakan sendok yang dipakai untuk makanan mengandung kacang.",
                        allergyNote: "Kacang dan produk susu",
                      }
                    : {}),
                })),
              },
              origin,
            );
            while (ticket.status !== status) {
              ticket = await advance.execute(
                tenant.id,
                outlet.id,
                ticket.id,
                ticket.status,
                origin,
              );
            }
          }
          process.send({ type: "scenario-ready", id: message.id, count: statuses.length });
        } catch (error) {
          process.send({
            type: "scenario-failed",
            id: message.id,
            message: error instanceof Error ? error.message : "Scenario setup failed.",
          });
        }
      });
      process.send({
        type: "ready",
        data: {
          apiOrigin: `http://127.0.0.1:${port}`,
          tenantId: tenant.id,
          outletId: outlet.id,
          ownerCookies: [{ name: SESSION_COOKIE_NAME, value: ownerSession.token }],
          kitchenCookies: [
            { name: SESSION_COOKIE_NAME, value: cookSession.token },
            { name: DEVICE_COOKIE_NAME, value: credential },
          ],
        },
      });
      await stopped;
    } finally {
      await app.close();
      await db.$disconnect();
      delete globalThis.prisma;
    }
  });
} catch (error) {
  // Do not serialize the error object: it could contain connection options.
  if (process.connected)
    process.send({
      type: "failed",
      message: error instanceof Error ? error.message : "KDS browser fixture failed.",
    });
  process.exitCode = 1;
} finally {
  if (process.connected) process.disconnect();
}
