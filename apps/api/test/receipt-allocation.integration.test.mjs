import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { withReceiptFixture } from "./receipt-fixture.mjs";

test("order receipts preserve actual allocations without rewriting shared payments", async (t) => {
  await withReceiptFixture(async ({ db, data, request, ownerId }) => {
    const idr = data.workspaces.idr;
    const read = (id, options) => request("GET", `/pos/orders/${id}/receipt`, undefined, options);
    const ledger = async () =>
      Promise.all([
        db.bill.findMany({ orderBy: { id: "asc" } }),
        db.billingPayment.findMany({ orderBy: { id: "asc" } }),
        db.paymentAllocation.findMany({ orderBy: { id: "asc" } }),
        db.sale.findMany({ orderBy: { id: "asc" } }),
        db.saleRefund.findMany({ orderBy: { id: "asc" } }),
        db.auditLog.count(),
        db.outboxEvent.count(),
      ]);
    await t.test(
      "different cash order amounts carry their real allocation and the same unmodified transaction",
      async () => {
        const before = await ledger();
        for (const [index, amount] of ["50000", "25000"].entries()) {
          const receipt = await read(idr.cashShared.orderIds[index]);
          assert.equal(receipt.status, 200);
          assert.deepEqual(receipt.body.paymentAllocation, { amountMinor: amount, shared: true });
          assert.equal(receipt.body.bill.totalMinor, amount);
          assert.equal(receipt.body.payment.id, idr.cashShared.paymentId);
          assert.equal(receipt.body.payment.amountMinor, "75000");
          assert.equal(receipt.body.payment.tenderedMinor, "100000");
          assert.equal(receipt.body.payment.changeMinor, "25000");
          assert.equal(
            (await read(idr.cashShared.orderIds[index])).body.paymentAllocation.amountMinor,
            amount,
          );
        }
        assert.deepEqual(
          await ledger(),
          before,
          "receipt reads cannot alter money, sale/refund, audit or outbox",
        );
      },
    );
    await t.test("non-cash shared and single-order cash stay distinguishable", async () => {
      const transfer = await read(idr.transferShared.orderIds[0]);
      assert.equal(transfer.status, 200);
      assert.deepEqual(transfer.body.paymentAllocation, { amountMinor: "50000", shared: true });
      assert.equal(transfer.body.payment.reference, "BANK-RECEIPT-001");
      assert.equal(transfer.body.payment.tenderedMinor, null);
      assert.equal(transfer.body.payment.changeMinor, null);
      const single = await read(idr.singleCash.orderId);
      assert.equal(single.status, 200);
      assert.deepEqual(single.body.paymentAllocation, { amountMinor: "25000", shared: false });
      assert.equal(single.body.payment.tenderedMinor, "50000");
      assert.equal(single.body.payment.changeMinor, "25000");
    });
    await t.test(
      "USD cents use the ledger's integer amounts rather than proportional rounding",
      async () => {
        const usd = data.workspaces.usd;
        for (const [index, amount] of ["1025", "2050"].entries()) {
          const receipt = await read(usd.cashShared.orderIds[index], { workspace: "usd" });
          assert.equal(receipt.status, 200);
          assert.equal(receipt.body.bill.currency, "USD");
          assert.deepEqual(receipt.body.paymentAllocation, { amountMinor: amount, shared: true });
          assert.equal(receipt.body.payment.amountMinor, "3075");
          assert.equal(receipt.body.payment.changeMinor, "925");
        }
      },
    );
    await t.test(
      "cashier is allowed but a table reader, different workspace and different outlet cannot read this receipt",
      async () => {
        assert.equal((await read(idr.cashShared.orderIds[0], { role: "cashier" })).status, 200);
        assert.equal((await read(idr.cashShared.orderIds[0], { role: "reader" })).status, 403);
        assert.equal((await read(idr.cashShared.orderIds[0], { workspace: "usd" })).status, 404);
        const brand = await db.brand.findFirstOrThrow({ where: { tenantId: idr.tenantId } });
        const other = await db.outlet.create({
          data: { tenantId: idr.tenantId, brandId: brand.id, name: "Other outlet", code: "OTHER" },
        });
        assert.equal(
          (await read(idr.cashShared.orderIds[0], { headers: { "x-outlet-id": other.id } })).status,
          404,
        );
      },
    );
    await t.test(
      "partial then full refund stays order-scoped and does not invent a new cash transaction",
      async () => {
        const [first, second] = idr.cashShared.orderIds;
        const partial = await request("POST", `/pos/orders/${first}/refunds`, {
          amountMinor: "10000",
          reason: "Item returned",
        });
        assert.equal(partial.status, 200);
        assert.equal(partial.body.refundableMinor, "40000");
        let receipt = await read(first);
        assert.equal(receipt.body.refunds.length, 1);
        assert.deepEqual(receipt.body.paymentAllocation, { amountMinor: "50000", shared: true });
        assert.equal(receipt.body.payment.amountMinor, "75000");
        const rest = await request("POST", `/pos/orders/${first}/refunds`, {
          amountMinor: "40000",
          reason: "Remaining items returned",
        });
        assert.equal(rest.status, 200);
        receipt = await read(first);
        assert.equal(receipt.status, 200);
        assert.equal(receipt.body.sale.status, "REFUNDED");
        assert.equal(receipt.body.refundableMinor, "0");
        assert.equal(receipt.body.refunds.length, 2);
        assert.equal(receipt.body.payment.tenderedMinor, "100000");
        assert.equal(receipt.body.payment.changeMinor, "25000");
        assert.deepEqual(receipt.body.paymentAllocation, { amountMinor: "50000", shared: true });
        assert.equal((await read(second)).body.refunds.length, 0);
        assert.equal(
          (await request("GET", "/pos/shifts/current")).body.session.expectedCashMinor,
          "1050000",
          "the actual shared cash transaction enters the drawer once, not per receipt",
        );
      },
    );
    await t.test(
      "inconsistent allocation and unsupported multiple tenders refuse a printable receipt without mutation",
      async () => {
        const bill = await db.bill.findFirstOrThrow({
          where: { tenantId: idr.tenantId, orderId: idr.cashShared.orderIds[0] },
        });
        const allocation = await db.paymentAllocation.findFirstOrThrow({
          where: { billId: bill.id },
        });
        await db.paymentAllocation.update({
          where: { id: allocation.id },
          data: { amountMinor: 49_999n },
        });
        let before = await ledger();
        let response = await read(bill.orderId);
        assert.equal(response.status, 409);
        assert.equal(response.body.code, "RECEIPT_ALLOCATION_UNAVAILABLE");
        assert.deepEqual(await ledger(), before);
        await db.paymentAllocation.update({
          where: { id: allocation.id },
          data: { amountMinor: 50_000n },
        });
        const extra = await db.billingPayment.create({
          data: {
            tenantId: idr.tenantId,
            outletId: idr.outletId,
            registerSessionId: idr.shiftId,
            method: "TRANSFER",
            amountMinor: 1n,
            status: "PAID",
            actorId: ownerId,
            confirmedBy: ownerId,
            confirmedAt: new Date(),
            idempotencyKey: randomUUID(),
          },
        });
        const extraAllocation = await db.paymentAllocation.create({
          data: { tenantId: idr.tenantId, billId: bill.id, paymentId: extra.id, amountMinor: 1n },
        });
        before = await ledger();
        response = await read(bill.orderId);
        assert.equal(response.status, 409);
        assert.equal(response.body.code, "RECEIPT_ALLOCATION_UNAVAILABLE");
        assert.deepEqual(await ledger(), before);
        // Fault injection and its cleanup are confined to this disposable test database.
        await db.paymentAllocation.delete({ where: { id: extraAllocation.id } });
        await db.billingPayment.delete({ where: { id: extra.id } });
        assert.equal((await read(bill.orderId)).status, 200);
      },
    );
  });
});
