import "reflect-metadata";

import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";

import { PLAN_CODES } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { NestFactory } from "@nestjs/core";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";

const { fetch } = globalThis;

test("a new outlet has a Main Floor and Main Area; floors and areas are managed per outlet", async () => {
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
        { name: "Uji Meja", slug: "uji-meja" },
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
        db.outlet.create({ data: { brandId: brand.id, code, name: code, tenantId: tenant.id } });
      const pusat = await outlet("PUSAT");
      const cabang = await outlet("CABANG");

      // The database gives every new outlet its first floor and area.
      const defaults = (
        await database.query(
          `SELECT f.outlet_id, f.name AS floor, a.name AS area
             FROM floor_floors f JOIN floor_areas a ON a.floor_id = f.id
            WHERE f.tenant_id = $1 ORDER BY f.outlet_id`,
          [tenant.id],
        )
      ).rows;
      assert.deepEqual(
        defaults.map((row) => [row.floor, row.area]),
        [
          ["Main Floor", "Main Area"],
          ["Main Floor", "Main Area"],
        ],
      );

      const person = async (email) =>
        db.user.create({
          data: { displayName: email, email, passwordHash: await hashPassword("rahasia-uji-123") },
        });
      const owner = await person("pemilik@uji.test");
      await access.provisionTenantOwner(tenant.id, owner.id);
      const cashier = await person("kasir@uji.test");
      const cashierRole = await db.role.findUniqueOrThrow({
        where: { tenantId_code: { code: "CASHIER", tenantId: tenant.id } },
      });
      await access.createMembership(tenant.id, {
        allOutlets: false,
        outletIds: [pusat.id],
        roleIds: [cashierRole.id],
        userId: cashier.id,
      });
      const session = async (email) =>
        `${SESSION_COOKIE_NAME}=${(await auth.login({ email, password: "rahasia-uji-123" })).token}`;
      const asPerson = (cookie) => async (method, route, outletId, body) => {
        const response = await fetch(base + route, {
          ...(body ? { body: JSON.stringify(body) } : {}),
          headers: {
            "content-type": "application/json",
            cookie,
            "x-outlet-id": outletId,
            "x-tenant-id": tenant.id,
          },
          method,
        });
        return { body: await response.json(), status: response.status };
      };
      const ownerApi = asPerson(await session("pemilik@uji.test"));
      const cashierApi = asPerson(await session("kasir@uji.test"));

      // Laying out the floor is not the cashier's job.
      assert.equal((await cashierApi("GET", "/floor/floors", pusat.id)).status, 403);

      const listed = await ownerApi("GET", "/floor/floors", pusat.id);
      assert.equal(listed.status, 200);
      assert.equal(listed.body.floors.length, 1);
      const main = listed.body.floors[0];
      assert.equal(main.outletId, pusat.id);

      const upstairs = await ownerApi("POST", "/floor/floors", pusat.id, { name: "Lantai 2" });
      assert.equal(upstairs.status, 201);
      assert.deepEqual(
        upstairs.body.areas.map((area) => area.name),
        ["Main Area"],
      );
      assert.equal(
        (await ownerApi("POST", "/floor/floors", pusat.id, { name: "Lantai 2" })).body.code,
        "FLOOR_NAME_TAKEN",
      );
      // The same name is fine on another outlet, whose floors stay apart.
      assert.equal(
        (await ownerApi("POST", "/floor/floors", cabang.id, { name: "Lantai 2" })).status,
        201,
      );
      assert.equal((await ownerApi("GET", "/floor/floors", cabang.id)).body.floors.length, 2);
      assert.equal(
        (await ownerApi("PATCH", `/floor/floors/${upstairs.body.id}`, cabang.id, { name: "X" }))
          .status,
        404,
      );

      const terrace = await ownerApi("POST", `/floor/floors/${main.id}/areas`, pusat.id, {
        name: "Teras",
      });
      assert.equal(terrace.status, 201);
      const renamed = await ownerApi("PATCH", `/floor/areas/${terrace.body.id}`, pusat.id, {
        name: "Teras luar",
      });
      assert.equal(renamed.body.name, "Teras luar");

      const reordered = await ownerApi("POST", "/floor/floors/order", pusat.id, {
        ids: [upstairs.body.id, main.id],
      });
      assert.equal(reordered.status, 200);
      assert.deepEqual(
        reordered.body.floors.map((floor) => floor.name),
        ["Lantai 2", "Main Floor"],
      );
      const areasReordered = await ownerApi(
        "POST",
        `/floor/floors/${main.id}/areas/order`,
        pusat.id,
        { ids: [terrace.body.id, main.areas[0].id] },
      );
      assert.deepEqual(
        areasReordered.body.floors[1].areas.map((area) => area.name),
        ["Teras luar", "Main Area"],
      );

      // A table on the area keeps it in use.
      await db.floorServiceTable.create({
        data: {
          areaId: terrace.body.id,
          capacity: 4,
          gridH: 3,
          gridW: 3,
          label: "T1",
          outletId: pusat.id,
          shape: "SQUARE",
          tenantId: tenant.id,
        },
      });
      assert.equal(
        (
          await ownerApi("PATCH", `/floor/areas/${terrace.body.id}`, pusat.id, {
            status: "INACTIVE",
          })
        ).body.code,
        "FLOOR_AREA_HAS_TABLES",
      );
      assert.equal(
        (await ownerApi("PATCH", `/floor/floors/${main.id}`, pusat.id, { status: "INACTIVE" })).body
          .code,
        "FLOOR_HAS_TABLES",
      );
      const setAside = await ownerApi("PATCH", `/floor/floors/${upstairs.body.id}`, pusat.id, {
        status: "INACTIVE",
      });
      assert.equal(setAside.body.status, "INACTIVE");

      // A table label is unique per outlet, at the database.
      await assert.rejects(
        db.floorServiceTable.create({
          data: {
            areaId: main.areas[0].id,
            capacity: 2,
            gridH: 2,
            gridW: 2,
            label: "T1",
            outletId: pusat.id,
            shape: "ROUND",
            tenantId: tenant.id,
          },
        }),
      );
      // Half a position is not a position.
      await assert.rejects(
        database.query(
          `INSERT INTO floor_service_tables
             (tenant_id, outlet_id, area_id, label, capacity, shape, grid_x, grid_w, grid_h)
           VALUES ($1, $2, $3, 'T9', 2, 'ROUND', 4, 2, 2)`,
          [tenant.id, pusat.id, main.areas[0].id],
        ),
        /floor_service_tables_position_check/,
      );

      const audits = (
        await database.query(
          `SELECT action FROM audit_logs WHERE entity_type IN ('floor_floor', 'floor_area')
            ORDER BY created_at`,
        )
      ).rows.map((row) => row.action);
      assert.ok(audits.includes("floor.floor.create"));
      assert.ok(audits.includes("floor.area.update"));
      assert.ok(audits.includes("floor.floor.reorder"));
    } finally {
      await app.close();
      await db.$disconnect();
      delete globalThis.prisma;
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
