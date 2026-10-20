import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { MODULES, visitDocumentSchema } from "@merchant/contracts";
import { InstallationService } from "../src/core/installations/public.ts";
import { OrderIntakeService } from "../src/kernels/order-intake/public.ts";
import { TableSessions } from "../src/modules/floor/public.ts";
import { CheckoutService } from "../src/modules/pos-sales/application/checkout.service.ts";
import { READ_SNAPSHOTS } from "../src/shared/query/read-snapshot.ts";
import { readDatabase } from "../src/core/read-snapshots/public.ts";
import { withReceiptFixture } from "./receipt-fixture.mjs";

const { fetch } = globalThis;

test("visit document API reads one complete read-only snapshot without duplicating money", async (t) => {
  await withReceiptFixture(async ({ app, db, data, request, ownerId, base }) => {
    const idr = data.workspaces.idr;
    const read = (id, options) =>
      request("GET", `/floor/sessions/${id}/document`, undefined, options);
    const orders = app.get(OrderIntakeService);
    const tables = app.get(TableSessions);
    const checkout = app.get(CheckoutService);
    const origin = { actorId: ownerId, channel: "POS" };
    const product = await db.orderItem.findFirstOrThrow({
      where: { orderId: idr.cashShared.orderIds[0] },
    });
    const area = await db.floorArea.findFirstOrThrow({
      where: { tenantId: idr.tenantId, outletId: idr.outletId },
    });
    const scope = { tenantId: idr.tenantId, outletId: idr.outletId };
    async function visit(label) {
      const table = await db.floorServiceTable.create({
        data: {
          ...scope,
          areaId: area.id,
          label,
          capacity: 2,
          shape: "SQUARE",
          visualSize: "SMALL",
          gridW: 2,
          gridH: 2,
        },
      });
      return tables.open(
        scope.tenantId,
        scope.outletId,
        { tableId: table.id, guestCount: 2 },
        origin,
      );
    }
    const submit = (sessionId, source = "POS") =>
      orders.submitTableOrder(
        scope.tenantId,
        scope.outletId,
        sessionId,
        { items: [{ productId: product.productId, quantity: 1, modifierOptionIds: [] }] },
        randomUUID(),
        origin,
        source,
      );
    const payVisit = (sessionId) =>
      checkout.payTableSession(
        scope.tenantId,
        scope.outletId,
        sessionId,
        { method: "CASH", tenderedMinor: "200000" },
        randomUUID(),
        origin,
      );
    const ledger = () =>
      Promise.all([
        db.bill.findMany({ orderBy: { id: "asc" } }),
        db.billingPayment.findMany({ orderBy: { id: "asc" } }),
        db.paymentAllocation.findMany({ orderBy: { id: "asc" } }),
        db.sale.findMany({ orderBy: { id: "asc" } }),
        db.saleRefund.findMany({ orderBy: { id: "asc" } }),
        db.auditLog.count(),
        db.outboxEvent.count(),
        db.order.findMany({ orderBy: { id: "asc" } }),
        db.floorTableSession.findMany({ orderBy: { id: "asc" } }),
      ]);

    await t.test(
      "cash shared and USD cents count one payment and preserve each bill snapshot without writes",
      async () => {
        const before = await ledger();
        for (const workspace of ["idr", "usd"]) {
          const current = data.workspaces[workspace];
          const response = await read(current.cashShared.sessionId, { workspace });
          assert.equal(response.status, 200);
          const doc = visitDocumentSchema.parse(response.body);
          assert.equal(doc.kind, "RECEIPT");
          assert.equal(doc.state, "PAID");
          assert.equal(doc.payments.length, 1);
          assert.equal(doc.orders.length, 2);
          assert.equal(doc.totals.paidMinor, workspace === "idr" ? "75000" : "3075");
          assert.equal(doc.totals.totalMinor, doc.totals.paidMinor);
          assert.equal(doc.totals.dueMinor, "0");
          assert.equal(doc.payments[0].changeMinor, workspace === "idr" ? "25000" : "925");
          assert.equal(doc.tableLabel, "T1");
          assert.equal(doc.currency, current.currency);
          assert.deepEqual(
            (await read(current.cashShared.sessionId, { workspace })).body,
            response.body,
          );
          assert.equal(JSON.stringify(doc).includes("idempotencyKey"), false);
          assert.equal(JSON.stringify(doc).includes("actorId"), false);
        }
        assert.deepEqual(await ledger(), before);
        const noncash = await read(idr.transferShared.sessionId);
        assert.equal(noncash.body.payments.length, 1);
        assert.equal(noncash.body.payments[0].reference, "BANK-RECEIPT-001");
        assert.equal(noncash.body.payments[0].tenderedMinor, null);
      },
    );

    await t.test(
      "same receipt permission: cashier allowed; table reader, absent session and cross-scope denied",
      async () => {
        assert.equal((await read(idr.cashShared.sessionId, { role: "cashier" })).status, 200);
        assert.equal((await read(idr.cashShared.sessionId, { role: "reader" })).status, 403);
        assert.equal((await read(idr.cashShared.sessionId, { workspace: "usd" })).status, 404);
        assert.equal((await read(randomUUID())).status, 404);
        assert.equal((await read("invalid")).status, 400);
        const response = await fetch(
          `${base}/floor/sessions/${idr.cashShared.sessionId}/document`,
          { headers: { "x-tenant-id": scope.tenantId, "x-outlet-id": scope.outletId } },
        );
        assert.equal(response.status, 401);
        const brand = await db.brand.findFirstOrThrow({ where: { tenantId: scope.tenantId } });
        const outlet = await db.outlet.create({
          data: { tenantId: scope.tenantId, brandId: brand.id, name: "Other", code: "OTHER" },
        });
        assert.equal(
          (await read(idr.cashShared.sessionId, { headers: { "x-outlet-id": outlet.id } })).status,
          404,
        );
        const authorized = await fetch(
          `${base}/floor/sessions/${idr.cashShared.sessionId}/document`,
          {
            headers: {
              "x-tenant-id": scope.tenantId,
              "x-outlet-id": scope.outletId,
              cookie: data.cookies.owner.map((entry) => `${entry.name}=${entry.value}`).join("; "),
            },
          },
        );
        assert.equal(authorized.status, 200);
        assert.equal(authorized.headers.get("cache-control"), "private, no-store");
      },
    );

    await t.test(
      "empty, pending-only, unpaid, accepted+pending and rejected states never claim false settlement",
      async () => {
        const session = await visit("STATES");
        let response = await read(session.id);
        assert.equal(response.body.state, "EMPTY");
        assert.equal(response.body.kind, "BILL");
        const pending = await submit(session.id, "SELF_ORDER");
        response = await read(session.id);
        assert.equal(response.body.state, "PENDING");
        assert.equal(response.body.orders.length, 0);
        assert.equal(response.body.pendingOrders.length, 1);
        assert.equal(response.body.totals.dueMinor, "0");
        const accepted = await submit(session.id);
        response = await read(session.id);
        assert.equal(response.body.state, "PENDING");
        assert.equal(response.body.orders.length, 1);
        assert.equal(response.body.totals.dueMinor, "50000");
        await orders.decideGuestOrder(
          scope.tenantId,
          scope.outletId,
          pending.id,
          "REJECTED",
          "Not available",
          origin,
        );
        response = await read(session.id);
        assert.equal(response.body.state, "UNPAID");
        assert.equal(response.body.pendingOrders.length, 0);
        assert.equal(response.body.orders[0].order.id, accepted.id);
        await payVisit(session.id);
        const nextPending = await submit(session.id, "SELF_ORDER");
        response = await read(session.id);
        assert.equal(response.body.state, "PENDING");
        assert.equal(response.body.kind, "BILL");
        assert.equal(response.body.totals.paidMinor, "50000");
        assert.equal(response.body.totals.dueMinor, "0");
        assert.equal(response.body.pendingOrders[0].id, nextPending.id);
      },
    );

    await t.test(
      "legacy per-order payments remain alongside later shared visit payment",
      async () => {
        const session = await visit("LEGACY");
        const first = await submit(session.id);
        await checkout.payOrder(
          scope.tenantId,
          scope.outletId,
          first.id,
          { method: "TRANSFER", reference: "LEGACY" },
          randomUUID(),
          origin,
        );
        await submit(session.id);
        let response = await read(session.id);
        assert.equal(response.body.state, "PARTIALLY_PAID");
        assert.equal(response.body.totals.dueMinor, "50000");
        await submit(session.id);
        await payVisit(session.id);
        response = await read(session.id);
        assert.equal(response.status, 200);
        assert.equal(response.body.orders.length, 3);
        assert.equal(response.body.payments.length, 2);
        assert.equal(response.body.totals.paidMinor, "150000");
        assert.equal(
          response.body.payments.filter((payment) => payment.reference === "LEGACY").length,
          1,
        );
      },
    );

    await t.test(
      "partial/full refunds are unique, preserve original paid total and never reopen debt",
      async () => {
        const first = idr.cashShared.orderIds[0];
        assert.equal(
          (
            await request("POST", `/pos/orders/${first}/refunds`, {
              amountMinor: "10000",
              reason: "Returned item",
            })
          ).status,
          200,
        );
        let response = await read(idr.cashShared.sessionId);
        assert.equal(response.status, 200);
        assert.equal(response.body.refunds.length, 1);
        assert.equal(response.body.totals.refundedMinor, "10000");
        assert.equal(response.body.totals.netPaidMinor, "65000");
        assert.equal(
          (
            await request("POST", `/pos/orders/${first}/refunds`, {
              amountMinor: "40000",
              reason: "Remaining item",
            })
          ).status,
          200,
        );
        response = await read(idr.cashShared.sessionId);
        assert.equal(response.body.kind, "RECEIPT");
        assert.equal(response.body.refunds.length, 2);
        assert.equal(response.body.totals.totalMinor, "75000");
        assert.equal(response.body.totals.paidMinor, "75000");
        assert.equal(response.body.totals.netPaidMinor, "25000");
        assert.equal(response.body.totals.dueMinor, "0");
      },
    );

    await t.test(
      "paid charges remain historical while unpaid orders use current outlet rates",
      async () => {
        const session = await visit("RATES");
        await submit(session.id);
        await payVisit(session.id);
        await submit(session.id);
        await db.outlet.update({
          where: { id: scope.outletId },
          data: { chargesIncluded: false, serviceChargeRateBp: 500, taxRateBp: 1100 },
        });
        try {
          const response = await read(session.id);
          assert.equal(response.status, 200);
          assert.equal(response.body.state, "PARTIALLY_PAID");
          const [paid, unpaid] = response.body.orders;
          assert.equal(paid.pricing.source, "PAID_SNAPSHOT");
          assert.equal(paid.pricing.totalMinor, "50000");
          assert.equal(paid.pricing.taxRateBp, 0);
          assert.equal(unpaid.pricing.source, "CURRENT_CHARGES");
          assert.equal(unpaid.pricing.totalMinor, "58275");
          assert.equal(response.body.totals.dueMinor, "58275");
          assert.equal(response.body.totals.totalMinor, "108275");
        } finally {
          await db.outlet.update({
            where: { id: scope.outletId },
            data: { chargesIncluded: true, serviceChargeRateBp: 0, taxRateBp: 0 },
          });
        }
      },
    );

    await t.test(
      "all 105 old rounds are read, not the POS recent-order page or its 100-row cap",
      async () => {
        const session = await visit("COMPLETE");
        const old = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const seeded = Array.from({ length: 105 }, (_, index) => ({
          ...scope,
          id: randomUUID(),
          orderNumber: 10000 + index,
          source: "POS",
          orderType: "DINE_IN",
          status: "SUBMITTED",
          moderationStatus: "NOT_REQUIRED",
          currency: "IDR",
          submittedAt: old,
          createdAt: old,
          actorId: ownerId,
          idempotencyKey: randomUUID(),
          tableSessionId: session.id,
        }));
        await db.$transaction(async (tx) => {
          await tx.floorTableSession.update({ where: { id: session.id }, data: { openedAt: old } });
          await tx.order.createMany({ data: seeded });
          await tx.orderItem.createMany({
            data: seeded.map((entry) => ({
              tenantId: scope.tenantId,
              orderId: entry.id,
              position: 0,
              nameSnapshot: "Old round",
              unitPriceMinor: 1000n,
              quantity: 1,
              lineTotalMinor: 1000n,
            })),
          });
        });
        const response = await read(session.id);
        assert.equal(response.status, 200);
        assert.equal(response.body.orders.length, 105);
        assert.equal(response.body.totals.dueMinor, "105000");
        assert.deepEqual(
          new Set(response.body.orders.map((row) => row.order.id)),
          new Set(seeded.map((entry) => entry.id)),
        );
      },
    );

    await t.test(
      "moved and closed visits retain authoritative context without changing original payments",
      async () => {
        const session = await visit("TO-CLOSE");
        await submit(session.id);
        await payVisit(session.id);
        const other = await visit("DESTINATION");
        await tables.close(scope.tenantId, scope.outletId, other.id, origin);
        await tables.move(
          scope.tenantId,
          scope.outletId,
          session.id,
          { tableId: other.tableIds[0] },
          origin,
        );
        let response = await read(session.id);
        assert.equal(response.status, 200);
        assert.equal(response.body.tableLabel, "DESTINATION");
        const payment = response.body.payments[0];
        await tables.close(scope.tenantId, scope.outletId, session.id, origin);
        response = await read(session.id);
        assert.equal(response.body.visit.status, "CLOSED");
        assert.equal(response.body.tableLabel, "DESTINATION");
        assert.deepEqual(response.body.payments, [payment]);
      },
    );

    await t.test(
      "broken or cross-scope ledger data fails closed with 409, never silently becoming unpaid",
      async () => {
        const orderId = idr.transferShared.orderIds[0];
        const bill = await db.bill.findFirstOrThrow({ where: { ...scope, orderId } });
        const allocation = await db.paymentAllocation.findFirstOrThrow({
          where: { billId: bill.id },
        });
        const sale = await db.sale.findFirstOrThrow({ where: { billId: bill.id } });
        const otherOutlet = await db.outlet.findFirstOrThrow({
          where: { tenantId: scope.tenantId, code: "OTHER" },
        });
        async function fault(mutate, restore) {
          try {
            await mutate();
            const before = await ledger();
            const response = await read(idr.transferShared.sessionId);
            assert.equal(response.status, 409);
            assert.equal(response.body.code, "RECEIPT_ALLOCATION_UNAVAILABLE");
            assert.deepEqual(await ledger(), before);
          } finally {
            await restore();
          }
          assert.equal((await read(idr.transferShared.sessionId)).status, 200);
        }
        await fault(
          () =>
            db.paymentAllocation.update({
              where: { id: allocation.id },
              data: { amountMinor: 49999n },
            }),
          () =>
            db.paymentAllocation.update({
              where: { id: allocation.id },
              data: { amountMinor: allocation.amountMinor },
            }),
        );
        await fault(
          () => db.paymentAllocation.delete({ where: { id: allocation.id } }),
          () => db.paymentAllocation.create({ data: allocation }),
        );
        await fault(
          () => db.sale.delete({ where: { id: sale.id } }),
          () => db.sale.create({ data: sale }),
        );
        await fault(
          () => db.bill.update({ where: { id: bill.id }, data: { status: "UNPAID" } }),
          () => db.bill.update({ where: { id: bill.id }, data: { status: bill.status } }),
        );
        await fault(
          () => db.bill.update({ where: { id: bill.id }, data: { outletId: otherOutlet.id } }),
          () => db.bill.update({ where: { id: bill.id }, data: { outletId: scope.outletId } }),
        );
        await fault(
          () =>
            db.billingPayment.update({
              where: { id: allocation.paymentId },
              data: { outletId: otherOutlet.id },
            }),
          () =>
            db.billingPayment.update({
              where: { id: allocation.paymentId },
              data: { outletId: scope.outletId },
            }),
        );
        await fault(
          () => db.sale.update({ where: { id: sale.id }, data: { outletId: otherOutlet.id } }),
          () => db.sale.update({ where: { id: sale.id }, data: { outletId: scope.outletId } }),
        );
        await fault(
          () =>
            db.order.update({
              where: { id: idr.transferShared.orderIds[1] },
              data: { tableSessionId: idr.cashShared.sessionId },
            }),
          () =>
            db.order.update({
              where: { id: idr.transferShared.orderIds[1] },
              data: { tableSessionId: idr.transferShared.sessionId },
            }),
        );
        const extra = await db.billingPayment.create({
          data: {
            ...scope,
            registerSessionId: idr.shiftId,
            amountMinor: 1n,
            method: "TRANSFER",
            status: "PAID",
            actorId: ownerId,
            confirmedBy: ownerId,
            confirmedAt: new Date(),
            idempotencyKey: randomUUID(),
          },
        });
        const extraAllocation = {
          id: randomUUID(),
          tenantId: scope.tenantId,
          billId: bill.id,
          paymentId: extra.id,
          amountMinor: 1n,
        };
        try {
          await fault(
            () => db.paymentAllocation.create({ data: extraAllocation }),
            () => db.paymentAllocation.delete({ where: { id: extraAllocation.id } }),
          );
        } finally {
          await db.billingPayment.delete({ where: { id: extra.id } });
        }
      },
    );

    await t.test(
      "repeatable read spans facade calls even when payment commits between orders and ledger",
      async () => {
        const session = await visit("RACE-PAY");
        await submit(session.id);
        const original = orders.listBySession;
        let raced = false;
        orders.listBySession = async function (...args) {
          const rows = await original.apply(this, args);
          if (args[2] === session.id && !raced) {
            raced = true;
            await payVisit(session.id);
          }
          return rows;
        };
        try {
          const beforePayment = await read(session.id);
          assert.equal(beforePayment.status, 200);
          assert.equal(beforePayment.body.state, "UNPAID");
          assert.equal(beforePayment.body.payments.length, 0);
          assert.equal(beforePayment.body.totals.dueMinor, "50000");
        } finally {
          orders.listBySession = original;
        }
        const afterPayment = await read(session.id);
        assert.equal(afterPayment.body.state, "PAID");
        assert.equal(afterPayment.body.payments.length, 1);
      },
    );

    await t.test(
      "refund committing between facade reads is wholly before/after, not mixed with sale state",
      async () => {
        const session = await visit("RACE-REFUND");
        const taken = await submit(session.id);
        await payVisit(session.id);
        const original = orders.listBySession;
        let raced = false;
        orders.listBySession = async function (...args) {
          const rows = await original.apply(this, args);
          if (args[2] === session.id && !raced) {
            raced = true;
            assert.equal(
              (
                await request("POST", `/pos/orders/${taken.id}/refunds`, {
                  amountMinor: "50000",
                  reason: "Return during document read",
                })
              ).status,
              200,
            );
          }
          return rows;
        };
        try {
          const beforeRefund = await read(session.id);
          assert.equal(beforeRefund.status, 200);
          assert.equal(beforeRefund.body.refunds.length, 0);
          assert.equal(beforeRefund.body.orders[0].sale.status, "COMPLETED");
        } finally {
          orders.listBySession = original;
        }
        const afterRefund = await read(session.id);
        assert.equal(afterRefund.status, 200);
        assert.equal(afterRefund.body.refunds.length, 1);
        assert.equal(afterRefund.body.orders[0].sale.status, "REFUNDED");
        assert.equal(afterRefund.body.totals.netPaidMinor, "0");
      },
    );

    await t.test(
      "read capabilities are read-only, scope-bound and expire on success/error",
      async () => {
        const snapshots = app.get(READ_SNAPSHOTS);
        let expired;
        const before = await ledger();
        await snapshots.run(scope, async (snapshot) => {
          expired = snapshot;
          const database = readDatabase(scope, snapshot);
          const [settings] =
            await database.$queryRaw`SELECT current_setting('transaction_isolation') AS isolation, current_setting('transaction_read_only') AS read_only`;
          assert.equal(settings.isolation, "repeatable read");
          assert.equal(settings.read_only, "on");
          assert.throws(
            () => readDatabase({ ...scope, outletId: randomUUID() }, snapshot),
            /another scope/,
          );
          assert.throws(
            () => readDatabase({ ...scope, tenantId: randomUUID() }, snapshot),
            /another scope/,
          );
        });
        assert.throws(() => readDatabase(scope, expired), /expired/);
        await assert.rejects(
          snapshots.run(scope, async (snapshot) => {
            expired = snapshot;
            await readDatabase(scope, snapshot).auditLog.deleteMany({ where: scope });
          }),
          /read-only/i,
        );
        assert.throws(() => readDatabase(scope, expired), /expired/);
        assert.deepEqual(await ledger(), before);
      },
    );

    await t.test(
      "an uninstalled Floor module cannot expose an existing visit document",
      async () => {
        await app
          .get(InstallationService)
          .uninstall(scope.tenantId, MODULES.tableSelfOrder, origin);
        const response = await read(idr.cashShared.sessionId);
        assert.equal(response.status, 409);
        assert.equal(response.body.code, "INSTALLATION_SETUP_REQUIRED");
      },
    );
  });
});
