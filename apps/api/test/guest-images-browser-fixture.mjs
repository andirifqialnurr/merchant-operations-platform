import "reflect-metadata";
import process from "node:process";

import { MODULES, PLAN_CODES } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { NestFactory } from "@nestjs/core";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";
import { PRODUCT_PNG, withImageStorage } from "./image-storage-fixture.mjs";

if (!process.send)
  throw new Error("Start guest-image fixture through its dedicated browser runner.");
const stopped = new Promise((resolve) => {
  process.once("disconnect", resolve);
  process.once("SIGTERM", resolve);
  process.once("SIGINT", resolve);
  process.on("message", (message) => {
    if (message?.type === "stop") resolve();
  });
});
try {
  await withImageStorage(async (storage) =>
    withDisposablePostgres(async ({ connectionString }) => {
      process.env.DATABASE_URL = connectionString;
      process.env.RATE_LIMIT_STORE = "memory";
      process.env.WEB_URL = process.env.E2E_BASE_URL ?? "http://localhost:4100";
      const db = getPrismaClient();
      const { AppModule } = await import("../src/app.module.ts");
      const { ApiExceptionFilter } = await import("../src/bootstrap/api-exception.filter.ts");
      const { createCsrfProtectionMiddleware, createSecurityHeadersMiddleware } =
        await import("../src/bootstrap/http-security.ts");
      const { InstallationService } = await import("../src/core/installations/public.ts");
      const { PlatformMasterService } =
        await import("../src/core/platform/platform-master.service.ts");
      const { FileStorageService } = await import("../src/core/files/public.ts");
      const { CatalogService } = await import("../src/kernels/catalog/public.ts");
      const { TableQrCodes } = await import("../src/modules/floor/application/table-qr-codes.ts");
      const app = await NestFactory.create(AppModule, { logger: ["error"] });
      app.use(createCsrfProtectionMiddleware());
      app.use(createSecurityHeadersMiddleware());
      app.setGlobalPrefix("api/v1");
      app.useGlobalFilters(new ApiExceptionFilter());
      try {
        await app.listen(Number(process.env.E2E_GUEST_IMAGES_API_PORT ?? 4101), "127.0.0.1");
        const platform = app.get(PlatformMasterService),
          catalog = app.get(CatalogService);
        const tenant = await platform.createTenant(
          { name: "Menu Foto Browser", slug: "menu-foto-browser" },
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
          data: { tenantId: tenant.id, brandId: brand.id, code: "MAIN", name: "Utama" },
        });
        await app
          .get(InstallationService)
          .install(tenant.id, MODULES.tableSelfOrder, { channel: "WEB" });
        const area = await db.floorArea.findFirstOrThrow({
          where: { tenantId: tenant.id, outletId: outlet.id },
        });
        const table = await db.floorServiceTable.create({
          data: {
            tenantId: tenant.id,
            outletId: outlet.id,
            areaId: area.id,
            label: "T1",
            capacity: 2,
            shape: "SQUARE",
            visualSize: "SMALL",
            gridW: 2,
            gridH: 2,
          },
        });
        const category = await catalog.createCategory(tenant.id, {
          name: "Minuman",
          slug: "minuman",
        });
        const photo = await catalog.createProduct(tenant.id, {
          name: "Kopi foto",
          slug: "kopi-foto",
          categoryId: category.id,
          basePriceMinor: "25000",
        });
        const plain = await catalog.createProduct(tenant.id, {
          name: "Teh tanpa foto",
          slug: "teh-tanpa-foto",
          categoryId: category.id,
          basePriceMinor: "15000",
        });
        await catalog.createOutletProduct(tenant.id, { outletId: outlet.id, productId: photo.id });
        await catalog.createOutletProduct(tenant.id, { outletId: outlet.id, productId: plain.id });
        const upload = app.get(FileStorageService).createUpload(tenant.id, {
          purpose: "CATALOG_PRODUCT_IMAGE",
          contentType: "image/png",
          sizeBytes: PRODUCT_PNG.length,
        });
        storage.put(upload.objectKey);
        await catalog.createProductImage(tenant.id, {
          productId: photo.id,
          objectKey: upload.objectKey,
          contentType: "image/png",
          displayOrder: 0,
          isPrimary: true,
        });
        const qr = await app
          .get(TableQrCodes)
          .generate(tenant.id, outlet.id, table.id, { channel: "WEB" });
        process.send({
          type: "ready",
          data: { token: qr.url.split("/t/")[1], productId: photo.id, plainId: plain.id },
        });
        await stopped;
      } finally {
        await app.close();
        await db.$disconnect();
        delete globalThis.prisma;
      }
    }),
  );
} catch {
  if (process.connected)
    process.send({
      type: "failed",
      message: "Guest-image fixture failed; check PostgreSQL and the dedicated API port.",
    });
  process.exitCode = 1;
} finally {
  if (process.connected) process.disconnect();
}
