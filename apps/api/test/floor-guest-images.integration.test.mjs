import "reflect-metadata";

import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import process from "node:process";
import test from "node:test";

import { MODULES, PLAN_CODES } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { NestFactory } from "@nestjs/core";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";
import { PRODUCT_PNG, withImageStorage } from "./image-storage-fixture.mjs";

const { fetch } = globalThis;

test("QR product photos proxy bounded raster bytes without leaking workspace, image IDs or storage URLs", async () => {
  await withImageStorage(async (storage) =>
    withDisposablePostgres(async ({ connectionString }) => {
      const previous = process.env.DATABASE_URL;
      process.env.DATABASE_URL = connectionString;
      const db = getPrismaClient();
      const { AppModule } = await import("../src/app.module.ts");
      const { ApiExceptionFilter } = await import("../src/bootstrap/api-exception.filter.ts");
      const { InstallationService } = await import("../src/core/installations/public.ts");
      const { PlatformMasterService } =
        await import("../src/core/platform/platform-master.service.ts");
      const { FileStorageService } = await import("../src/core/files/public.ts");
      const { CatalogService } = await import("../src/kernels/catalog/public.ts");
      const { TableQrCodes } = await import("../src/modules/floor/application/table-qr-codes.ts");
      const app = await NestFactory.create(AppModule, { logger: ["error"] });
      app.setGlobalPrefix("api/v1");
      app.useGlobalFilters(new ApiExceptionFilter());
      try {
        await app.listen(0, "127.0.0.1");
        const base = `${await app.getUrl()}/api/v1`;
        const catalog = app.get(CatalogService),
          platform = app.get(PlatformMasterService);
        const codes = app.get(TableQrCodes),
          files = app.get(FileStorageService);
        const origin = { channel: "WEB" };
        async function workspace(slug) {
          const tenant = await platform.createTenant({ name: slug, slug }, { actorId: undefined });
          await platform.replaceSubscription(
            tenant.id,
            {
              planCode: PLAN_CODES.cafeOperations,
              status: "ACTIVE",
              startsAt: new Date(Date.now() - 60_000).toISOString(),
            },
            { actorId: undefined },
          );
          const brand = await db.brand.create({ data: { tenantId: tenant.id, name: slug, slug } });
          const outlet = await db.outlet.create({
            data: { tenantId: tenant.id, brandId: brand.id, name: "Main", code: "MAIN" },
          });
          const category = await catalog.createCategory(tenant.id, {
            name: "Drinks",
            slug: "drinks",
          });
          const product = await catalog.createProduct(tenant.id, {
            name: "Coffee",
            slug: "coffee",
            categoryId: category.id,
            basePriceMinor: "20000",
          });
          await catalog.createOutletProduct(tenant.id, {
            outletId: outlet.id,
            productId: product.id,
          });
          const upload = files.createUpload(tenant.id, {
            purpose: "CATALOG_PRODUCT_IMAGE",
            contentType: "image/png",
            sizeBytes: PRODUCT_PNG.length,
          });
          storage.put(upload.objectKey);
          const image = await catalog.createProductImage(tenant.id, {
            productId: product.id,
            objectKey: upload.objectKey,
            contentType: "image/png",
            isPrimary: true,
            displayOrder: 0,
          });
          return { tenant, brand, outlet, category, product, image, upload };
        }
        const own = await workspace("guest-image"),
          foreign = await workspace("foreign-image");
        await app.get(InstallationService).install(own.tenant.id, MODULES.tableSelfOrder, origin);
        const area = await db.floorArea.findFirstOrThrow({
          where: { tenantId: own.tenant.id, outletId: own.outlet.id },
        });
        const table = await db.floorServiceTable.create({
          data: {
            tenantId: own.tenant.id,
            outletId: own.outlet.id,
            areaId: area.id,
            label: "T1",
            shape: "SQUARE",
            visualSize: "SMALL",
            capacity: 2,
            gridW: 2,
            gridH: 2,
          },
        });
        const qr = await codes.generate(own.tenant.id, own.outlet.id, table.id, origin);
        let token = qr.url.split("/t/")[1];
        const imagePath = (productId = own.product.id, qrToken = token) =>
          `${base}/public/table-qr/${qrToken}/products/${productId}/image`;
        const menu = async () => (await fetch(`${base}/public/table-qr/${token}/menu`)).json();
        const publicMenu = await menu();
        assert.equal(publicMenu.products[0].hasImage, true);
        const forbidden = [
          own.tenant.id,
          own.outlet.id,
          own.image.id,
          foreign.tenant.id,
          own.upload.objectKey,
          token,
          "X-Amz",
          "fixture-bucket",
          "must-not-reach",
        ];
        const noLeak = (value) => {
          for (const text of forbidden)
            assert.ok(!value.includes(text), `public media leaked internal data`);
        };
        noLeak(JSON.stringify(publicMenu));
        const response = await fetch(imagePath(), { redirect: "manual" });
        assert.equal(response.status, 200);
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), PRODUCT_PNG);
        assert.equal(response.headers.get("content-type"), "image/png");
        assert.equal(response.headers.get("location"), null);
        assert.equal(response.headers.get("x-private-bucket"), null);
        assert.equal(response.headers.get("x-content-type-options"), "nosniff");
        assert.equal(response.headers.get("cache-control"), "private, no-store");
        assert.equal(response.headers.get("referrer-policy"), "no-referrer");
        noLeak(JSON.stringify(Object.fromEntries(response.headers)));
        assert.equal(
          (
            await fetch(
              `${base}/catalog/tenants/${own.tenant.id}/product-images/${own.image.id}/content`,
            )
          ).status,
          401,
        );
        const noRead = async (url) => {
          const before = storage.reads.full;
          const result = await fetch(url);
          assert.equal(result.status, 404);
          noLeak(await result.text());
          assert.equal(storage.reads.full, before);
        };
        await noRead(imagePath(foreign.product.id));
        await noRead(imagePath(randomUUID()));
        const otherOutlet = await db.outlet.create({
          data: { tenantId: own.tenant.id, brandId: own.brand.id, name: "Other", code: "OTHER" },
        });
        const offMenu = await catalog.createProduct(own.tenant.id, {
          name: "Other outlet",
          slug: "other-outlet",
          categoryId: own.category.id,
          basePriceMinor: "10000",
        });
        await catalog.createOutletProduct(own.tenant.id, {
          outletId: otherOutlet.id,
          productId: offMenu.id,
        });
        await noRead(imagePath(offMenu.id));
        await catalog.updateProduct(own.tenant.id, own.product.id, { availability: "SOLD_OUT" });
        await noRead(imagePath());
        await catalog.updateProduct(own.tenant.id, own.product.id, { availability: "AVAILABLE" });
        await catalog.updateCategory(own.tenant.id, own.category.id, { status: "INACTIVE" });
        await noRead(imagePath());
        await catalog.updateCategory(own.tenant.id, own.category.id, { status: "ACTIVE" });
        await catalog.updateProductImage(own.tenant.id, own.image.id, { status: "INACTIVE" });
        assert.equal((await menu()).products[0].hasImage, false);
        await noRead(imagePath());
        await catalog.updateProductImage(own.tenant.id, own.image.id, {
          status: "ACTIVE",
          isPrimary: true,
        });
        for (const [mode, status] of [
          ["html", 404],
          ["oversize", 404],
          ["stream-oversize", 404],
          ["unavailable", 503],
          ["redirect", 503],
        ]) {
          storage.setMode(mode);
          const result = await fetch(imagePath());
          assert.equal(result.status, status, mode);
          noLeak(await result.text());
        }
        assert.equal(storage.reads.redirected, 0);
        storage.setMode("normal");
        storage.remove(own.upload.objectKey);
        assert.equal((await fetch(imagePath())).status, 404);
        storage.put(own.upload.objectKey);
        await db.floorServiceTable.update({ where: { id: table.id }, data: { qrOrdering: false } });
        await noRead(imagePath());
        await db.floorServiceTable.update({ where: { id: table.id }, data: { qrOrdering: true } });
        const rotated = await codes.rotate(own.tenant.id, own.outlet.id, table.id, origin);
        await noRead(imagePath());
        token = rotated.url.split("/t/")[1];
        assert.equal((await fetch(imagePath())).status, 200);
        await codes.revoke(own.tenant.id, own.outlet.id, table.id, origin);
        await noRead(imagePath());
        const statuses = [];
        for (let attempt = 0; attempt < 121; attempt++)
          statuses.push((await fetch(imagePath())).status);
        assert.ok(statuses.includes(404));
        assert.equal(statuses.at(-1), 429);
      } finally {
        await app.close();
        await db.$disconnect();
        delete globalThis.prisma;
        if (previous === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = previous;
      }
    }),
  );
});
