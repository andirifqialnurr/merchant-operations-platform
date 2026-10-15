import "reflect-metadata";

import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";

import { PLAN_CODES } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { NestFactory } from "@nestjs/core";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";

const { fetch } = globalThis;

test("an external system sends tickets with its key, through the same use case as the kitchen's form", async () => {
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
    const { CreateKitchenTicket } = await import("../src/modules/kds/public.ts");
    const { KitchenQueue } = await import("../src/modules/kds/application/kitchen-queue.ts");
    const app = await NestFactory.create(AppModule, { logger: ["error"] });
    app.setGlobalPrefix("api/v1");
    try {
      await app.listen(0, "127.0.0.1");
      const base = `${await app.getUrl()}/api/v1`;
      const platform = app.get(PlatformMasterService);
      const access = app.get(AccessService);
      const auth = app.get(AuthService);

      const tenant = await platform.createTenant(
        { name: "Uji Intake", slug: "uji-intake" },
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
      const pusat = await db.outlet.create({
        data: {
          brandId: brand.id,
          code: "PUSAT",
          name: "Pusat",
          tenantId: tenant.id,
          timezone: "Asia/Jakarta",
        },
      });
      const person = async (email) =>
        db.user.create({
          data: { displayName: email, email, passwordHash: await hashPassword("rahasia-uji-123") },
        });
      const owner = await person("pemilik@uji.test");
      await access.provisionTenantOwner(tenant.id, owner.id);
      const cook = await person("dapur@uji.test");
      const kitchenRole = await db.role.findUniqueOrThrow({
        where: { tenantId_code: { code: "KITCHEN", tenantId: tenant.id } },
      });
      await access.createMembership(tenant.id, {
        allOutlets: false,
        outletIds: [pusat.id],
        roleIds: [kitchenRole.id],
        userId: cook.id,
      });
      const session = async (email) =>
        `${SESSION_COOKIE_NAME}=${(await auth.login({ email, password: "rahasia-uji-123" })).token}`;
      const asPerson = (cookie) => async (method, route, body) => {
        const response = await fetch(base + route, {
          ...(body ? { body: JSON.stringify(body) } : {}),
          headers: { "content-type": "application/json", cookie, "x-tenant-id": tenant.id },
          method,
        });
        return { body: await response.json(), status: response.status };
      };
      const ownerApi = asPerson(await session("pemilik@uji.test"));
      const cookApi = asPerson(await session("dapur@uji.test"));
      const send = async (key, body) => {
        const response = await fetch(`${base}/kds/intake/tickets`, {
          body: JSON.stringify(body),
          headers: {
            ...(key ? { authorization: `Bearer ${key}` } : {}),
            "content-type": "application/json",
          },
          method: "POST",
        });
        return { body: await response.json(), status: response.status };
      };

      // Keys are managed by the owner, not by the kitchen.
      assert.equal((await cookApi("GET", "/kds/intake-sources")).status, 403);
      const made = await ownerApi("POST", "/kds/intake-sources", {
        label: "GrabFood",
        outletId: pusat.id,
      });
      assert.equal(made.status, 201);
      const { key, source } = made.body;
      assert.match(key, /^kds_[a-z2-9]{10}_/);
      const listed = await ownerApi("GET", "/kds/intake-sources");
      assert.equal(listed.status, 200);
      assert.deepEqual(
        listed.body.sources.map((item) => item.label),
        ["GrabFood"],
      );
      // The key is shown once; neither the list nor the database holds it.
      assert.ok(!JSON.stringify(listed.body).includes(key.slice(15)));
      const stored = (await database.query(`SELECT * FROM kds_intake_sources`)).rows[0];
      assert.ok(!JSON.stringify(stored).includes(key.slice(15)));
      const audits = (
        await database.query(
          `SELECT action, metadata::text FROM audit_logs WHERE entity_type = 'kds_intake_source'`,
        )
      ).rows;
      assert.deepEqual(
        audits.map((row) => row.action),
        ["kds.intake_source.create"],
      );
      assert.ok(!audits[0].metadata.includes(key.slice(15)));

      // No key, a made-up key: the same refusal.
      for (const attempt of [undefined, `kds_aaaaaaaaaa_${"A".repeat(43)}`]) {
        const refused = await send(attempt, {
          items: [{ name: "Latte", quantity: 1 }],
          orderLabel: "X",
          reference: "x-1",
        });
        assert.equal(refused.status, 401);
        assert.equal(refused.body.code, "KDS_INTAKE_KEY_INVALID");
      }

      // A ticket in, then the same reference again: one ticket.
      const order = {
        items: [
          { modifiers: ["Besar"], name: "Latte", note: "kurang manis", quantity: 2 },
          { allergyNote: "kacang", name: "Roti bakar", quantity: 1 },
        ],
        orderLabel: "GrabFood 4821",
        reference: "order-4821",
        tableLabel: "Ambil di depan",
      };
      const first = await send(key, order);
      assert.equal(first.status, 201);
      assert.equal(first.body.created, true);
      assert.equal(first.body.ticket.source, "API");
      const again = await send(key, order);
      assert.equal(again.status, 200);
      assert.equal(again.body.created, false);
      assert.equal(again.body.ticket.id, first.body.ticket.id);

      // It is in the outlet's queue, like any other ticket.
      const queue = await app.get(KitchenQueue).list(tenant.id, pusat.id);
      assert.deepEqual(
        queue.tickets.map((ticket) => ticket.id),
        [first.body.ticket.id],
      );

      // M3-QA-01: the API door and the manual door make the same ticket.
      const manual = await app.get(CreateKitchenTicket).execute(tenant.id, pusat.id, {
        items: order.items,
        orderLabel: order.orderLabel,
        source: "MANUAL",
        sourceReference: "manual-key-00000001",
        tableLabel: order.tableLabel,
      });
      const shape = (ticket) => ({
        items: ticket.items,
        orderLabel: ticket.orderLabel,
        status: ticket.status,
        tableLabel: ticket.tableLabel,
      });
      assert.deepEqual(shape(first.body.ticket), shape(manual.ticket));

      // What a source may not send.
      const priced = await send(key, {
        ...order,
        items: [{ name: "Latte", quantity: 1, unitPriceMinor: "25000" }],
        reference: "order-priced",
      });
      assert.equal(priced.status, 400);
      const elsewhere = await send(key, { ...order, outletId: pusat.id, reference: "order-x" });
      assert.equal(elsewhere.status, 400);

      // M3-SC-03: KDS Basic allows 60 requests a minute per source; two were sent.
      const answers = [];
      for (let index = 0; index < 59; index += 1) {
        answers.push((await send(key, { ...order, reference: `burst-${index}` })).status);
      }
      assert.deepEqual(answers.slice(0, 58), Array(58).fill(201));
      assert.equal(answers[58], 429);
      // Revoked: the key stops at once.
      const revoked = await ownerApi("POST", `/kds/intake-sources/${source.id}/revoke`);
      assert.equal(revoked.status, 200);
      assert.equal(revoked.body.status, "REVOKED");
      assert.equal((await send(key, { ...order, reference: "order-after" })).status, 401);
      const lastUsed = (
        await database.query(`SELECT last_used_at FROM kds_intake_sources WHERE id = $1`, [
          source.id,
        ])
      ).rows[0].last_used_at;
      assert.ok(lastUsed);

      // Wrong keys are counted per address: 30 a minute, then 429; three were sent.
      const wrong = [];
      for (let index = 0; index < 28; index += 1) {
        wrong.push((await send(`kds_bbbbbbbbbb_${"B".repeat(43)}`, order)).status);
      }
      assert.deepEqual(wrong.slice(0, 27), Array(27).fill(401));
      assert.equal(wrong[27], 429);
    } finally {
      await app.close();
      await db.$disconnect();
      delete globalThis.prisma;
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
