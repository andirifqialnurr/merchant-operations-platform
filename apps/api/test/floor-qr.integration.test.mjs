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

test("a table QR is printed again at will, stops at once when rotated or revoked, and is never stored", async () => {
  await withDisposablePostgres(async ({ database, connectionString }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    const { AppModule } = await import("../src/app.module.ts");
    const { AuthService, hashPassword, SESSION_COOKIE_NAME } =
      await import("../src/core/auth/public.ts");
    const { AccessService } = await import("../src/core/memberships/public.ts");
    const { PlatformMasterService } =
      await import("../src/core/platform/platform-master.service.ts");
    const app = await NestFactory.create(AppModule, { logger: ["error"] });
    app.setGlobalPrefix("api/v1");
    try {
      await app.listen(0, "127.0.0.1");
      const base = `${await app.getUrl()}/api/v1`;
      const platform = app.get(PlatformMasterService);
      const access = app.get(AccessService);
      const auth = app.get(AuthService);

      const tenant = await platform.createTenant(
        { name: "Uji QR", slug: "uji-qr" },
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
        data: { name: "Kopi Uji", slug: "kopi-uji", tenantId: tenant.id },
      });
      const outlet = await db.outlet.create({
        data: { brandId: brand.id, code: "PUSAT", name: "Pusat", tenantId: tenant.id },
      });
      const area = await db.floorArea.findFirstOrThrow({ where: { outletId: outlet.id } });
      const t1 = await db.floorServiceTable.create({
        data: {
          areaId: area.id,
          capacity: 4,
          gridH: 2,
          gridW: 2,
          label: "T1",
          outletId: outlet.id,
          shape: "SQUARE",
          tenantId: tenant.id,
          visualSize: "SMALL",
        },
      });
      const person = async (email) =>
        db.user.create({
          data: { displayName: email, email, passwordHash: await hashPassword("rahasia-uji-123") },
        });
      const owner = await person("pemilik@uji.test");
      await access.provisionTenantOwner(tenant.id, owner.id);
      const cashier = await person("kasir@uji.test");
      const role = await db.role.findUniqueOrThrow({
        where: { tenantId_code: { code: "CASHIER", tenantId: tenant.id } },
      });
      await access.createMembership(tenant.id, {
        allOutlets: false,
        outletIds: [outlet.id],
        roleIds: [role.id],
        userId: cashier.id,
      });
      const as = (cookie) => async (method, route) => {
        const response = await fetch(base + route, {
          headers: {
            "content-type": "application/json",
            cookie,
            "idempotency-key": randomUUID(),
            "x-outlet-id": outlet.id,
            "x-tenant-id": tenant.id,
          },
          method,
        });
        const text = await response.text();
        return { body: text ? JSON.parse(text) : null, status: response.status };
      };
      const login = async (email) =>
        `${SESSION_COOKIE_NAME}=${(await auth.login({ email, password: "rahasia-uji-123" })).token}`;
      const ownerApi = as(await login("pemilik@uji.test"));
      const cashierApi = as(await login("kasir@uji.test"));
      const scan = async (url) => {
        const token = url.split("/t/")[1];
        const response = await fetch(`${base}/public/table-qr/${token}`);
        return { body: await response.json(), status: response.status };
      };
      assert.equal((await ownerApi("POST", "/modules/installations/TABLE_SELF_ORDER")).status, 200);

      // Managing QR is not the cashier's job.
      assert.equal((await cashierApi("POST", `/floor/tables/${t1.id}/qr`)).status, 403);
      assert.deepEqual((await ownerApi("GET", `/floor/tables/${t1.id}/qr`)).body, {
        status: "NOT_GENERATED",
        url: null,
        version: null,
      });
      const made = (await ownerApi("POST", `/floor/tables/${t1.id}/qr`)).body;
      assert.equal(made.status, "ACTIVE");
      assert.equal(made.version, 1);
      assert.match(made.url, /\/t\/[A-Za-z0-9_-]{43}$/);
      // Printing again gives the same QR.
      assert.equal((await ownerApi("POST", `/floor/tables/${t1.id}/qr`)).body.url, made.url);
      assert.equal((await ownerApi("GET", `/floor/tables/${t1.id}/qr`)).body.url, made.url);

      // A guest learns names only.
      const ready = await scan(made.url);
      assert.equal(ready.status, 200);
      assert.deepEqual(ready.body, {
        merchantName: "Kopi Uji",
        message: null,
        outletName: "Pusat",
        status: "READY",
        tableLabel: "T1",
      });
      assert.doesNotMatch(JSON.stringify(ready.body), /[0-9a-f]{8}-[0-9a-f]{4}-/);

      // The token is in no column and no audit entry.
      const token = made.url.split("/t/")[1];
      const stored = JSON.stringify((await database.query(`SELECT * FROM floor_qr_tokens`)).rows);
      assert.ok(!stored.includes(token));
      const audits = JSON.stringify(
        (
          await database.query(
            `SELECT action, metadata FROM audit_logs WHERE action LIKE 'floor.table_qr.%'`,
          )
        ).rows,
      );
      assert.ok(!audits.includes(token));

      // Rotating: the old QR stops at once, the new one works.
      const rotated = (await ownerApi("POST", `/floor/tables/${t1.id}/qr/rotate`)).body;
      assert.equal(rotated.version, 2);
      assert.notEqual(rotated.url, made.url);
      assert.equal((await scan(made.url)).body.status, "INVALID");
      assert.equal((await scan(rotated.url)).body.status, "READY");

      // A table that does not take QR orders says so.
      await database.query(`UPDATE floor_service_tables SET qr_ordering = false WHERE id = $1`, [
        t1.id,
      ]);
      const closed = await scan(rotated.url);
      assert.equal(closed.body.status, "CLOSED");
      await database.query(`UPDATE floor_service_tables SET qr_ordering = true WHERE id = $1`, [
        t1.id,
      ]);

      // Revoking: nothing works until a new QR is made.
      const revoked = (await ownerApi("POST", `/floor/tables/${t1.id}/qr/revoke`)).body;
      assert.deepEqual(revoked, { status: "REVOKED", url: null, version: 2 });
      assert.equal((await scan(rotated.url)).body.status, "INVALID");
      assert.equal(
        (await ownerApi("POST", `/floor/tables/${t1.id}/qr/rotate`)).body.code,
        "TABLE_QR_NOT_ACTIVE",
      );
      const again = (await ownerApi("POST", `/floor/tables/${t1.id}/qr`)).body;
      assert.equal(again.version, 3);
      assert.equal((await scan(again.url)).body.status, "READY");

      // Made-up or malformed tokens are simply invalid.
      for (const bogus of ["x".repeat(43), "short", "-".repeat(43)]) {
        const result = await fetch(`${base}/public/table-qr/${bogus}`);
        assert.equal((await result.json()).status, "INVALID");
      }
      // An overlong one is not even looked up.
      assert.equal((await fetch(`${base}/public/table-qr/${"y".repeat(200)}`)).status, 400);
      const actions = (
        await database.query(
          `SELECT action FROM audit_logs WHERE action LIKE 'floor.table_qr.%' ORDER BY created_at`,
        )
      ).rows.map((row) => row.action);
      assert.deepEqual(actions, [
        "floor.table_qr.generate",
        "floor.table_qr.rotate",
        "floor.table_qr.revoke",
        "floor.table_qr.generate",
      ]);
    } finally {
      await app.close();
      await db.$disconnect();
      delete globalThis.prisma;
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
