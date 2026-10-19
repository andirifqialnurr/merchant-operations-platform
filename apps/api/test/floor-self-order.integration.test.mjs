import "reflect-metadata";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import process from "node:process";
import test from "node:test";

import { PERMISSIONS, PLAN_CODES } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { NestFactory } from "@nestjs/core";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";

const { fetch } = globalThis;

test("guests order from the table QR into the same kitchen as the cashier, seeing no internal ids (M4-BE-05, SC-01, SC-02, QA-02)", async () => {
  await withDisposablePostgres(async ({ database, connectionString }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    const { AppModule } = await import("../src/app.module.ts");
    const { workerRuntimeFor } = await import("../src/worker-runtime.ts");
    const { AuthService, hashPassword, SESSION_COOKIE_NAME } =
      await import("../src/core/auth/public.ts");
    const { AccessService } = await import("../src/core/memberships/public.ts");
    const { CatalogService } = await import("../src/kernels/catalog/public.ts");
    const { OrderIntakeService } = await import("../src/kernels/order-intake/public.ts");
    const { PlatformMasterService } =
      await import("../src/core/platform/platform-master.service.ts");
    const app = await NestFactory.create(AppModule, { logger: ["error"] });
    app.setGlobalPrefix("api/v1");
    try {
      await app.listen(0, "127.0.0.1");
      const base = `${await app.getUrl()}/api/v1`;
      const worker = workerRuntimeFor(app);
      const drain = async () => {
        for (let taken = await worker.dispatchBatch(); taken > 0;) {
          taken = await worker.dispatchBatch();
        }
      };
      const platform = app.get(PlatformMasterService);
      const access = app.get(AccessService);
      const auth = app.get(AuthService);
      const catalog = app.get(CatalogService);

      const tenant = await platform.createTenant(
        { name: "Uji Tamu", slug: "uji-tamu" },
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
        data: { name: "Kopi Tamu", slug: "kopi-tamu", tenantId: tenant.id },
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
          gridX: 3,
          gridY: 3,
          label: "T1",
          outletId: outlet.id,
          shape: "SQUARE",
          tenantId: tenant.id,
          visualSize: "SMALL",
        },
      });
      const category = await catalog.createCategory(tenant.id, {
        name: "Minuman",
        slug: "minuman",
      });
      const latte = await catalog.createProduct(tenant.id, {
        basePriceMinor: "25000",
        categoryId: category.id,
        name: "Latte",
        slug: "latte",
      });
      await catalog.createOutletProduct(tenant.id, { outletId: outlet.id, productId: latte.id });

      const owner = await db.user.create({
        data: {
          displayName: "Pemilik",
          email: "pemilik@uji.test",
          passwordHash: await hashPassword("rahasia-uji-123"),
        },
      });
      await access.provisionTenantOwner(tenant.id, owner.id);
      const cookie = `${SESSION_COOKIE_NAME}=${
        (await auth.login({ email: "pemilik@uji.test", password: "rahasia-uji-123" })).token
      }`;
      const staff = async (method, route, body, scope = {}) => {
        const response = await fetch(base + route, {
          ...(body ? { body: JSON.stringify(body) } : {}),
          headers: {
            "content-type": "application/json",
            cookie,
            "idempotency-key": randomUUID(),
            "x-outlet-id": outlet.id,
            "x-tenant-id": tenant.id,
            ...scope,
          },
          method,
        });
        const text = await response.text();
        return { body: text ? JSON.parse(text) : null, status: response.status };
      };
      await staff("POST", "/modules/installations/TABLE_SELF_ORDER");
      const qr = (await staff("POST", `/floor/tables/${t1.id}/qr`)).body;
      const token = qr.url.split("/t/")[1];
      const seen = [];
      const guest = async (method, path, body, key = randomUUID()) => {
        const response = await fetch(`${base}/public/table-qr/${token}${path}`, {
          ...(body ? { body: JSON.stringify(body) } : {}),
          headers: {
            "content-type": "application/json",
            ...(key ? { "idempotency-key": key } : {}),
            "x-forwarded-for": "198.51.100.7",
          },
          method,
        });
        const text = await response.text();
        seen.push(text);
        return { body: text ? JSON.parse(text) : null, status: response.status };
      };

      const menu = await guest("GET", "/menu");
      assert.equal(menu.status, 200);
      assert.deepEqual(
        menu.body.products.map((product) => [product.name, product.priceMinor]),
        [["Latte", "25000"]],
      );

      // No key, no order.
      assert.equal(
        (await guest("POST", "/orders", { items: [{ productId: latte.id, quantity: 1 }] }, null))
          .status,
        400,
      );
      const key = randomUUID();
      const first = await guest(
        "POST",
        "/orders",
        {
          guestCount: 2,
          items: [{ productId: latte.id, quantity: 2, note: "Pisahkan es" }],
          note: "Pakai es",
        },
        key,
      );
      assert.equal(first.status, 201);
      assert.equal(first.body.status, "PENDING");
      assert.equal(first.body.totalMinor, "50000");
      assert.deepEqual(first.body.lines, [
        { modifiers: [], name: "Latte", productId: latte.id, quantity: 2 },
      ]);
      // The same key again is the same order.
      const repeat = await guest(
        "POST",
        "/orders",
        { items: [{ productId: latte.id, quantity: 2 }] },
        key,
      );
      assert.equal(repeat.body.orderNumber, first.body.orderNumber);

      // The guests now hold the table, as a visit staff see.
      const live = (await staff("GET", "/floor/live")).body;
      const table = live.tables.find((item) => item.id === t1.id);
      assert.equal(table.status, "OCCUPIED");
      assert.equal(table.pendingOrderCount, 1);
      const visitSession = live.sessions.find((session) => session.id === table.sessionId);
      assert.equal(visitSession.guestCount, 2);
      const opener = (
        await database.query(`SELECT opened_by FROM floor_table_sessions WHERE id = $1`, [
          table.sessionId,
        ])
      ).rows[0];
      assert.equal(opener.opened_by, null);

      // New QR orders wait for an explicit staff decision, with no debt or kitchen ticket.
      const orderService = app.get(OrderIntakeService);
      const firstOrder = (
        await orderService.listBySession(tenant.id, outlet.id, table.sessionId)
      )[0];
      assert.equal(firstOrder.moderationStatus, "PENDING");
      const review = (await staff("GET", `/floor/sessions/${table.sessionId}`)).body.orders[0];
      assert.equal(review.note, "Pakai es");
      assert.deepEqual(review.lines[0], {
        name: "Latte",
        quantity: 2,
        modifiers: [],
        note: "Pisahkan es",
      });
      assert.equal((await guest("GET", "/visit")).body.dueMinor, "0");
      assert.equal((await staff("GET", `/floor/sessions/${table.sessionId}`)).body.dueMinor, "0");
      await drain();
      assert.equal(await db.kdsTicket.count({ where: { tenantId: tenant.id } }), 0);
      assert.equal(
        await db.outboxEvent.count({
          where: { tenantId: tenant.id, aggregateId: firstOrder.id, type: "order.submitted.v1" },
        }),
        0,
      );
      assert.equal(
        await orderService.recordKitchenProgress(tenant.id, firstOrder.id, "PREPARING"),
        "unchanged",
      );
      assert.equal(
        (await staff("POST", `/floor/sessions/${table.sessionId}/close`)).body.code,
        "SELF_ORDER_PENDING",
      );
      assert.equal(
        (
          await staff("POST", `/pos/orders/${firstOrder.id}/payments`, {
            method: "CASH",
            tenderedMinor: "50000",
          })
        ).body.code,
        "POS_SHIFT_REQUIRED",
      );
      assert.equal((await staff("POST", "/pos/shifts", { openingCashMinor: "0" })).status, 201);
      assert.equal(
        (
          await staff("POST", `/pos/orders/${firstOrder.id}/payments`, {
            method: "CASH",
            tenderedMinor: "50000",
          })
        ).body.code,
        "SELF_ORDER_PENDING",
      );
      assert.equal(
        (
          await staff("POST", `/pos/table-sessions/${table.sessionId}/payments`, {
            method: "CASH",
            tenderedMinor: "50000",
          })
        ).body.code,
        "SELF_ORDER_PENDING",
      );
      await staff("PUT", "/floor/policy", { guestPaymentNote: "Pay at counter" });
      assert.equal(
        (await guest("POST", "/payment-claims", { method: "TRANSFER" })).body.code,
        "SELF_ORDER_PENDING",
      );
      await staff("PUT", "/floor/policy", { guestPaymentNote: null });
      assert.equal(
        (await staff("POST", `/floor/guest-orders/${firstOrder.id}/accept`, { actorId: owner.id }))
          .status,
        400,
      );
      const otherOutlet = await db.outlet.create({
        data: { brandId: brand.id, code: "OTHER", name: "Other", tenantId: tenant.id },
      });
      assert.equal(
        (
          await staff(
            "POST",
            `/floor/guest-orders/${firstOrder.id}/accept`,
            {},
            { "x-outlet-id": otherOutlet.id },
          )
        ).status,
        404,
      );
      const accepted = await Promise.all([
        staff("POST", `/floor/guest-orders/${firstOrder.id}/accept`, {}),
        staff("POST", `/floor/guest-orders/${firstOrder.id}/accept`, {}),
      ]);
      assert.deepEqual(
        accepted.map((result) => result.status),
        [200, 200],
      );
      assert.equal(accepted[0].body.moderationStatus, "ACCEPTED");
      assert.equal(
        (await staff("GET", "/floor/live")).body.tables.find((item) => item.id === t1.id)
          .pendingOrderCount,
        0,
      );
      assert.equal(accepted[0].body.subtotalMinor, "50000");
      assert.equal(
        (await staff("POST", `/floor/guest-orders/${firstOrder.id}/reject`, { reason: "Too late" }))
          .body.code,
        "SELF_ORDER_ALREADY_DECIDED",
      );
      assert.equal(
        await db.auditLog.count({
          where: { entityId: firstOrder.id, action: "order.guest_accept" },
        }),
        1,
      );
      assert.equal(
        await db.outboxEvent.count({
          where: { aggregateId: firstOrder.id, type: "order.submitted.v1" },
        }),
        1,
      );
      assert.equal(
        (await guest("POST", "/orders", { items: [{ productId: latte.id, quantity: 1 }] }, key))
          .body.status,
        "RECEIVED",
      );

      // A second round joins the same visit.
      await guest("POST", "/orders", { items: [{ productId: latte.id, quantity: 1 }] });
      const visit = await guest("GET", "/visit");
      assert.equal(visit.body.orders.length, 2);
      assert.equal(visit.body.dueMinor, "50000");
      assert.equal(visit.body.orders[1].status, "PENDING");
      const secondOrder = (
        await orderService.listBySession(tenant.id, outlet.id, table.sessionId)
      )[1];
      assert.equal(
        (await staff("POST", `/floor/guest-orders/${secondOrder.id}/accept`, {})).status,
        200,
      );
      assert.equal((await guest("GET", "/visit")).body.dueMinor, "75000");

      // Cashier and guests feed one kitchen (M4-QA-02).
      await app.get(OrderIntakeService).submitPosOrder(
        tenant.id,
        outlet.id,
        {
          items: [{ modifierOptionIds: [], productId: latte.id, quantity: 1 }],
          orderType: "TAKEAWAY",
        },
        "kasir-uji-0000000001",
        { actorId: owner.id, channel: "POS" },
      );
      await drain();
      const tickets = (
        await database.query(
          `SELECT source, table_label, station_id FROM kds_tickets WHERE tenant_id = $1 ORDER BY received_at`,
          [tenant.id],
        )
      ).rows;
      assert.deepEqual(
        tickets.map((row) => [row.source, row.table_label]),
        [
          ["SELF_ORDER", "T1"],
          ["SELF_ORDER", "T1"],
          ["POS", null],
        ],
      );
      assert.equal(new Set(tickets.map((row) => row.station_id)).size, 1);

      // The kitchen moves an order on; the guest sees it.
      const kitchen = (await staff("GET", "/kds/tickets")).body.tickets[0];
      await staff("POST", `/kds/tickets/${kitchen.id}/advance`, { expectedStatus: "NEW" });
      await staff("POST", `/kds/tickets/${kitchen.id}/advance`, { expectedStatus: "ACCEPTED" });
      await drain();
      assert.equal((await guest("GET", "/visit")).body.orders[0].status, "PREPARING");

      // Calling a waiter (M4-BE-06): asking twice while waiting is one request.
      await guest("POST", "/requests", { type: "WAITER" });
      const asked = await guest("POST", "/requests", { type: "WAITER" });
      assert.equal(asked.status, 200);
      assert.deepEqual(asked.body.requests, ["WAITER"]);
      const waiting = (await staff("GET", "/floor/live")).body.requests;
      assert.deepEqual(
        waiting.map((request) => [request.type, request.sessionId]),
        [["WAITER", table.sessionId]],
      );
      assert.equal((await staff("POST", `/floor/requests/${waiting[0].id}/done`)).status, 204);
      assert.equal((await staff("POST", `/floor/requests/${waiting[0].id}/done`)).status, 404);
      assert.deepEqual((await guest("GET", "/visit")).body.requests, []);
      assert.deepEqual((await staff("GET", "/floor/live")).body.requests, []);
      // Asking again after staff came is a new request.
      await guest("POST", "/requests", { type: "BILL" });
      assert.deepEqual(
        (await staff("GET", "/floor/live")).body.requests.map((request) => request.type),
        ["BILL"],
      );

      // Paying from the table (M4-BE-07): not offered until the outlet says how.
      const claimKey = randomUUID();
      assert.equal(
        (await guest("POST", "/payment-claims", { method: "TRANSFER" }, claimKey)).body.code,
        "SELF_ORDER_PAYMENT_UNAVAILABLE",
      );
      await staff("PUT", "/floor/policy", {
        guestPaymentNote: "Transfer ke BCA 123 a.n. Kopi Tamu",
      });
      assert.equal(
        (await guest("GET", "/menu")).body.paymentNote,
        "Transfer ke BCA 123 a.n. Kopi Tamu",
      );
      const claimed = await guest("POST", "/payment-claims", { method: "TRANSFER" }, randomUUID());
      assert.equal(claimed.status, 200);
      assert.deepEqual(claimed.body.claim, { amountMinor: "75000", method: "TRANSFER" });
      // Claiming again while waiting is the same claim; nothing is paid yet.
      await guest("POST", "/payment-claims", { method: "MERCHANT_QRIS" }, randomUUID());
      assert.equal((await guest("GET", "/visit")).body.dueMinor, "75000");
      const waitingClaims = (await staff("GET", "/floor/live")).body.claims;
      assert.deepEqual(
        waitingClaims.map((claim) => [claim.method, claim.amountMinor, claim.sessionId]),
        [["TRANSFER", "75000", table.sessionId]],
      );
      const status = async () =>
        (
          await database.query(`SELECT status, actor_id FROM billing_payments WHERE id = $1`, [
            waitingClaims[0].id,
          ])
        ).rows[0];
      assert.deepEqual(await status(), { actor_id: null, status: "VERIFYING" });
      // Confirming needs the cashier's shift; the claim becomes the payment.
      const claimPath = `/pos/table-sessions/${table.sessionId}/claims/${waitingClaims[0].id}`;
      const claimBlocker = await orderService.submitTableOrder(
        tenant.id,
        outlet.id,
        table.sessionId,
        { items: [{ modifierOptionIds: [], productId: latte.id, quantity: 1 }] },
        randomUUID(),
        { channel: "WEB" },
        "SELF_ORDER",
      );
      assert.equal((await staff("POST", `${claimPath}/confirm`)).body.code, "SELF_ORDER_PENDING");
      assert.equal((await status()).status, "VERIFYING");
      assert.equal((await guest("GET", "/visit")).body.dueMinor, "75000");
      assert.equal(
        (
          await staff("POST", `/floor/guest-orders/${claimBlocker.id}/reject`, {
            reason: "Not needed",
          })
        ).status,
        200,
      );
      const confirmed = await staff("POST", `${claimPath}/confirm`);
      assert.equal(confirmed.status, 200);
      assert.equal(confirmed.body.payment.id, waitingClaims[0].id);
      assert.equal(confirmed.body.payment.amountMinor, "75000");
      assert.equal(confirmed.body.checkouts.length, 2);
      assert.deepEqual(await status(), { actor_id: owner.id, status: "PAID" });
      assert.equal((await staff("POST", `${claimPath}/reject`)).body.code, "PAYMENT_CLAIM_CHANGED");
      const settled = await guest("GET", "/visit");
      assert.equal(settled.body.dueMinor, "0");
      assert.equal(settled.body.claim, null);
      assert.deepEqual((await staff("GET", "/floor/live")).body.claims, []);

      // Reject retries and opposing decisions are terminal and never create a bill/ticket.
      await guest("POST", "/orders", { items: [{ productId: latte.id, quantity: 1 }] });
      const rejectedOrder = (
        await orderService.listBySession(tenant.id, outlet.id, table.sessionId)
      ).at(-1);
      assert.equal(
        (await staff("POST", `/floor/guest-orders/${rejectedOrder.id}/reject`, { reason: " " }))
          .status,
        400,
      );
      const rejected = await Promise.all([
        staff("POST", `/floor/guest-orders/${rejectedOrder.id}/reject`, {
          reason: "Not available",
        }),
        staff("POST", `/floor/guest-orders/${rejectedOrder.id}/reject`, { reason: "Repeated tap" }),
      ]);
      assert.deepEqual(
        rejected.map((result) => result.status),
        [200, 200],
      );
      assert.equal(rejected[0].body.status, "CANCELED");
      assert.equal(rejected[0].body.moderationStatus, "REJECTED");
      assert.equal(
        (await staff("POST", `/floor/guest-orders/${rejectedOrder.id}/accept`, {})).status,
        409,
      );
      assert.equal(
        await db.auditLog.count({
          where: { entityId: rejectedOrder.id, action: "order.guest_reject" },
        }),
        1,
      );
      assert.equal(await db.bill.count({ where: { orderId: rejectedOrder.id } }), 0);
      await drain();
      assert.equal(await db.kdsTicket.count({ where: { sourceReference: rejectedOrder.id } }), 0);

      await guest("POST", "/orders", { items: [{ productId: latte.id, quantity: 1 }] });
      const racedOrder = (
        await orderService.listBySession(tenant.id, outlet.id, table.sessionId)
      ).at(-1);
      const race = await Promise.all([
        staff("POST", `/floor/guest-orders/${racedOrder.id}/accept`, {}),
        staff("POST", `/floor/guest-orders/${racedOrder.id}/reject`, { reason: "Cannot prepare" }),
      ]);
      assert.deepEqual(race.map((result) => result.status).sort(), [200, 409]);
      assert.equal(
        await db.auditLog.count({
          where: {
            entityId: racedOrder.id,
            action: { in: ["order.guest_accept", "order.guest_reject"] },
          },
        }),
        1,
      );
      if (race[0].status === 200)
        await staff("POST", `/pos/orders/${racedOrder.id}/cancel`, { reason: "Test finished" });
      assert.equal((await guest("GET", "/visit")).body.dueMinor, "0");
      assert.equal((await staff("POST", `/floor/sessions/${table.sessionId}/close`)).status, 200);

      // A separate visit exercises rollback and stale-read/race defenses without guest rate-limit noise.
      const t2 = await db.floorServiceTable.create({
        data: {
          areaId: area.id,
          capacity: 4,
          gridH: 2,
          gridW: 2,
          gridX: 7,
          gridY: 3,
          label: "T2",
          outletId: outlet.id,
          shape: "SQUARE",
          tenantId: tenant.id,
          visualSize: "SMALL",
        },
      });
      const anotherVisit = (
        await staff("POST", "/floor/sessions", { tableId: t2.id, guestCount: 1 })
      ).body;
      const submitPending = (visitId = anotherVisit.id, key = randomUUID()) =>
        orderService.submitTableOrder(
          tenant.id,
          outlet.id,
          visitId,
          { items: [{ modifierOptionIds: [], productId: latte.id, quantity: 1 }] },
          key,
          { channel: "WEB" },
          "SELF_ORDER",
        );
      const rollbackOrder = await submitPending();
      const reader = await db.user.create({
        data: {
          displayName: "Reader",
          email: "reader@uji.test",
          passwordHash: await hashPassword("rahasia-uji-123"),
        },
      });
      const readerRole = await access.createRole(tenant.id, {
        code: "FLOOR_READER",
        name: "Floor reader",
        permissionKeys: [PERMISSIONS.tableView],
      });
      await access.createMembership(tenant.id, {
        allOutlets: true,
        outletIds: [],
        roleIds: [readerRole.id],
        userId: reader.id,
      });
      const readerCookie = `${SESSION_COOKIE_NAME}=${(await auth.login({ email: "reader@uji.test", password: "rahasia-uji-123" })).token}`;
      for (const decision of ["accept", "reject"]) {
        assert.equal(
          (
            await staff(
              "POST",
              `/floor/guest-orders/${rollbackOrder.id}/${decision}`,
              decision === "accept" ? {} : { reason: "Read only" },
              { cookie: readerCookie },
            )
          ).status,
          403,
        );
      }
      assert.equal(
        (
          await staff("GET", `/floor/sessions/${anotherVisit.id}`, undefined, {
            cookie: readerCookie,
          })
        ).status,
        200,
      );
      const foreignTenant = await platform.createTenant(
        { name: "Other", slug: "other-moderation" },
        { actorId: undefined },
      );
      assert.equal(
        (
          await staff(
            "POST",
            `/floor/guest-orders/${rollbackOrder.id}/accept`,
            {},
            { "x-tenant-id": foreignTenant.id },
          )
        ).status,
        403,
      );
      await platform.replaceSubscription(
        foreignTenant.id,
        {
          planCode: PLAN_CODES.cafeOperations,
          startsAt: new Date(Date.now() - 60_000).toISOString(),
          status: "ACTIVE",
        },
        { actorId: undefined },
      );
      const foreignBrand = await db.brand.create({
        data: { name: "Other", slug: "other", tenantId: foreignTenant.id },
      });
      const foreignOutlet = await db.outlet.create({
        data: {
          brandId: foreignBrand.id,
          code: "OTHER",
          name: "Other",
          tenantId: foreignTenant.id,
        },
      });
      await access.provisionTenantOwner(foreignTenant.id, owner.id);
      assert.equal(
        (
          await staff(
            "POST",
            `/floor/guest-orders/${rollbackOrder.id}/accept`,
            {},
            { "x-tenant-id": foreignTenant.id, "x-outlet-id": foreignOutlet.id },
          )
        ).status,
        404,
      );
      const roleCookie = async (code) => {
        const person = await db.user.create({
          data: {
            displayName: code,
            email: `${code.toLowerCase()}@uji.test`,
            passwordHash: await hashPassword("rahasia-uji-123"),
          },
        });
        const role = await db.role.findUniqueOrThrow({
          where: { tenantId_code: { tenantId: tenant.id, code } },
        });
        await access.createMembership(tenant.id, {
          allOutlets: true,
          outletIds: [],
          roleIds: [role.id],
          userId: person.id,
        });
        return `${SESSION_COOKIE_NAME}=${(await auth.login({ email: person.email, password: "rahasia-uji-123" })).token}`;
      };
      const waiterCookie = await roleCookie("WAITER");
      const cashierCookie = await roleCookie("CASHIER");
      assert.equal(
        (
          await staff(
            "POST",
            `/floor/guest-orders/${rollbackOrder.id}/reject`,
            { reason: "No grant" },
            { cookie: waiterCookie },
          )
        ).status,
        403,
      );
      // Fault injection proves order/decision/audit/outbox commit together.
      await database.query(`CREATE FUNCTION fail_moderation_audit() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.action = 'order.guest_accept' THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER fail_moderation_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_moderation_audit();`);
      assert.equal(
        (await staff("POST", `/floor/guest-orders/${rollbackOrder.id}/accept`, {})).status,
        500,
      );
      await database.query(
        `DROP TRIGGER fail_moderation_audit ON audit_logs; DROP FUNCTION fail_moderation_audit();`,
      );
      const afterRollback = await db.order.findUniqueOrThrow({ where: { id: rollbackOrder.id } });
      assert.equal(afterRollback.moderationStatus, "PENDING");
      assert.equal(afterRollback.moderatedAt, null);
      assert.equal(
        await db.outboxEvent.count({
          where: { aggregateId: rollbackOrder.id, type: "order.submitted.v1" },
        }),
        0,
      );
      const { BillingService } = await import("../src/kernels/billing-payment-ledger/public.ts");
      const { OrganizationService } = await import("../src/core/workspaces/public.ts");
      const charges = await app.get(OrganizationService).outletCharges(tenant.id, outlet.id);
      const openShift = await db.posRegisterSession.findFirstOrThrow({
        where: { tenantId: tenant.id, status: "OPEN" },
      });
      // A stale/forged approved snapshot cannot bypass the persistence gate.
      await assert.rejects(
        app.get(BillingService).payOrderInFull(
          {
            charges,
            idempotencyKey: randomUUID(),
            order: { ...rollbackOrder, moderationStatus: "NOT_REQUIRED" },
            outletId: outlet.id,
            pay: { method: "CASH", tenderedMinor: "25000" },
            registerSessionId: openShift.id,
            tenantId: tenant.id,
          },
          { actorId: owner.id },
        ),
        (error) => error.getResponse().code === "SELF_ORDER_PENDING",
      );
      const staleVisit = {
        charges,
        idempotencyKey: randomUUID(),
        orders: [{ ...rollbackOrder, moderationStatus: "NOT_REQUIRED" }],
        outletId: outlet.id,
        tableSessionId: anotherVisit.id,
        tenantId: tenant.id,
      };
      await assert.rejects(
        app.get(BillingService).payTableSessionInFull(
          {
            ...staleVisit,
            pay: { method: "CASH", tenderedMinor: "25000" },
            registerSessionId: openShift.id,
          },
          { actorId: owner.id },
        ),
        (error) => error.getResponse().code === "SELF_ORDER_PENDING",
      );
      await assert.rejects(
        app
          .get(BillingService)
          .claimTableSessionPayment({ ...staleVisit, method: "TRANSFER" }, { channel: "WEB" }),
        (error) => error.getResponse().code === "SELF_ORDER_PENDING",
      );
      assert.equal(await db.bill.count({ where: { orderId: rollbackOrder.id } }), 0);
      assert.equal(
        (
          await staff(
            "POST",
            `/floor/guest-orders/${rollbackOrder.id}/reject`,
            { reason: "Test cleanup" },
            { cookie: cashierCookie },
          )
        ).status,
        200,
      );
      const waiterOrder = await submitPending();
      assert.equal(
        (
          await staff(
            "POST",
            `/floor/guest-orders/${waiterOrder.id}/accept`,
            {},
            { cookie: waiterCookie },
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await staff(
            "POST",
            `/pos/orders/${waiterOrder.id}/cancel`,
            { reason: "Test cleanup" },
            { cookie: cashierCookie },
          )
        ).status,
        200,
      );
      const paymentRaceOrder = await submitPending();
      const paymentRace = await Promise.all([
        staff("POST", `/floor/guest-orders/${paymentRaceOrder.id}/accept`, {}),
        staff("POST", `/pos/orders/${paymentRaceOrder.id}/payments`, {
          method: "CASH",
          tenderedMinor: "25000",
        }),
      ]);
      assert.equal(paymentRace[0].status, 200);
      if (paymentRace[1].status === 409) {
        assert.equal(paymentRace[1].body.code, "SELF_ORDER_PENDING");
        assert.equal(await db.bill.count({ where: { orderId: paymentRaceOrder.id } }), 0);
        await staff("POST", `/pos/orders/${paymentRaceOrder.id}/cancel`, {
          reason: "Test cleanup",
        });
      } else {
        assert.equal(paymentRace[1].status, 201);
        assert.equal(
          (await db.order.findUniqueOrThrow({ where: { id: paymentRaceOrder.id } }))
            .moderationStatus,
          "ACCEPTED",
        );
        assert.equal(
          await db.bill.count({ where: { orderId: paymentRaceOrder.id, status: "PAID" } }),
          1,
        );
      }
      // Reusing another visit's key must not expose its order or perform a second submit.
      await assert.rejects(
        submitPending(anotherVisit.id, key),
        (error) => error.getResponse().code === "IDEMPOTENCY_KEY_CONFLICT",
      );

      // Close and a new guest round serialize on the same visit key.
      const closeRace = await Promise.allSettled([
        submitPending(),
        staff("POST", `/floor/sessions/${anotherVisit.id}/close`),
      ]);
      const currentVisit = await db.floorTableSession.findUniqueOrThrow({
        where: { id: anotherVisit.id },
      });
      if (currentVisit.status === "CLOSED") {
        assert.equal(closeRace[0].status, "rejected");
        assert.equal(closeRace[1].value.status, 200);
      } else {
        assert.equal(closeRace[0].status, "fulfilled");
        assert.equal(closeRace[1].value.body.code, "SELF_ORDER_PENDING");
        await staff("POST", `/floor/guest-orders/${closeRace[0].value.id}/reject`, {
          reason: "Test cleanup",
        });
        assert.equal((await staff("POST", `/floor/sessions/${anotherVisit.id}/close`)).status, 200);
      }
      assert.equal(
        await db.order.count({
          where: {
            tableSessionId: anotherVisit.id,
            moderationStatus: "PENDING",
            status: { not: "CANCELED" },
          },
        }),
        0,
      );

      // Data guard (M4-SC-01): nothing a guest received names an internal id,
      // a position on the floor, or the token.
      const secret = [
        tenant.id,
        outlet.id,
        t1.id,
        table.sessionId,
        area.id,
        brand.id,
        token,
        ...(await orderService.listBySession(tenant.id, outlet.id, table.sessionId)).map(
          (order) => order.id,
        ),
      ];
      for (const text of seen) {
        for (const value of secret) assert.ok(!text.includes(value), `leaked ${value}`);
        assert.doesNotMatch(text, /grid[XYWH]|"gridX"|tableId|sessionId|outletId|tenantId/);
      }

      // A table that stops taking QR orders says so.
      await database.query(`UPDATE floor_service_tables SET qr_ordering = false WHERE id = $1`, [
        t1.id,
      ]);
      assert.equal((await guest("GET", "/menu")).body.code, "SELF_ORDER_CLOSED");
      await database.query(`UPDATE floor_service_tables SET qr_ordering = true WHERE id = $1`, [
        t1.id,
      ]);
      // A made-up QR leads nowhere.
      const bogus = await fetch(`${base}/public/table-qr/${"z".repeat(43)}/menu`);
      assert.equal((await bogus.json()).code, "TABLE_QR_INVALID");

      // Rate limit (M4-SC-02): 20 orders per table QR in ten minutes; the
      // Six counted taps above (including submit retries); fourteen invalid attempts still fit.
      const wrong = { items: [{ productId: randomUUID(), quantity: 1 }] };
      const codes = [];
      for (let attempt = 0; attempt < 15; attempt += 1) {
        codes.push((await guest("POST", "/orders", wrong)).status);
      }
      assert.deepEqual(codes.slice(0, 14), Array(14).fill(409));
      assert.equal(codes[14], 429);
      assert.equal((await staff("DELETE", "/modules/installations/TABLE_SELF_ORDER")).status, 200);
      assert.equal(
        (
          await staff("POST", `/floor/guest-orders/${rollbackOrder.id}/reject`, {
            reason: "No module",
          })
        ).status,
        409,
      );
    } finally {
      await app.close();
      await db.$disconnect();
      delete globalThis.prisma;
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
