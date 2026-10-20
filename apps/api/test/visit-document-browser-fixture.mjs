import process from "node:process";
import { randomUUID } from "node:crypto";
import { OrderIntakeService } from "../src/kernels/order-intake/public.ts";
import { BillingService } from "../src/kernels/billing-payment-ledger/public.ts";
import { TableSessions } from "../src/modules/floor/public.ts";
import { CheckoutService } from "../src/modules/pos-sales/application/checkout.service.ts";
import { withReceiptFixture } from "./receipt-fixture.mjs";

let stop;
const stopped = new Promise((resolve) => {
  stop = resolve;
});
process.on("message", (message) => {
  if (message?.type === "stop") stop();
});
process.on("disconnect", () => stop());
try {
  await withReceiptFixture(
    async ({ app, db, data, ownerId }) => {
      const current = data.workspaces.idr;
      const scope = { tenantId: current.tenantId, outletId: current.outletId };
      const origin = { actorId: ownerId, channel: "POS" };
      const orders = app.get(OrderIntakeService),
        tables = app.get(TableSessions),
        checkout = app.get(CheckoutService);
      const item = await db.orderItem.findFirstOrThrow({
        where: { orderId: current.cashShared.orderIds[0] },
      });
      const area = await db.floorArea.findFirstOrThrow({ where: scope });
      const visits = {};
      async function visit(key, label) {
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
        const session = await tables.open(
          scope.tenantId,
          scope.outletId,
          { tableId: table.id, guestCount: 2 },
          origin,
        );
        visits[key] = { sessionId: session.id, tableId: table.id, label, orderIds: [] };
        return session.id;
      }
      async function submit(key, source = "POS", note) {
        const taken = await orders.submitTableOrder(
          scope.tenantId,
          scope.outletId,
          visits[key].sessionId,
          {
            items: [
              {
                productId: item.productId,
                quantity: 1,
                modifierOptionIds: [],
                ...(note ? { note } : {}),
              },
            ],
            ...(note ? { note: "Sajikan bersama" } : {}),
          },
          randomUUID(),
          origin,
          source,
        );
        visits[key].orderIds.push(taken.id);
        return taken;
      }
      const pay = (key) =>
        checkout.payTableSession(
          scope.tenantId,
          scope.outletId,
          visits[key].sessionId,
          { method: "CASH", tenderedMinor: "200000" },
          randomUUID(),
          origin,
        );
      await visit("empty", "T3");
      await visit("pending", "T4");
      await submit("pending", "SELF_ORDER", "Tanpa gula");
      await visit("mixed", "T5");
      await submit("mixed");
      await pay("mixed");
      await submit("mixed", "SELF_ORDER");
      await visit("partial", "T6");
      await submit("partial");
      await pay("partial");
      await submit("partial");
      await visit("flow", "T7");
      await submit("flow");
      await visit("claim", "T8");
      const claimed = await submit("claim");
      await app.get(BillingService).claimTableSessionPayment(
        {
          tenantId: scope.tenantId,
          outletId: scope.outletId,
          tableSessionId: visits.claim.sessionId,
          orders: [claimed],
          charges: { included: true, serviceChargeRateBp: 0, taxRateBp: 0 },
          method: "TRANSFER",
          idempotencyKey: randomUUID(),
        },
        { channel: "WEB" },
      );
      await visit("legacy", "T9");
      const legacy = await submit("legacy");
      await checkout.payOrder(
        scope.tenantId,
        scope.outletId,
        legacy.id,
        { method: "TRANSFER", reference: "BANK-LEGACY-001" },
        randomUUID(),
        origin,
      );
      await submit("legacy");
      await submit("legacy");
      await pay("legacy");
      await visit("long", "T10");
      for (let index = 0; index < 24; index++)
        await submit(
          "long",
          "POS",
          `Catatan panjang ronde ${index + 1}: pisahkan es dan sajikan tanpa gula tambahan.`,
        );
      // Give one submitted snapshot a long user-facing name in this owned fixture only.
      await db.orderItem.updateMany({
        where: { orderId: { in: visits.long.orderIds } },
        data: {
          nameSnapshot:
            "Kopi susu dengan nama menu yang sangat panjang untuk pengujian pembungkusan teks",
        },
      });
      process.send?.({ type: "ready", data: { ...data, visits } });
      await stopped;
    },
    { port: Number(process.env.E2E_RECEIPT_API_PORT ?? "4101"), webURL: "http://localhost:4100" },
  );
} catch (error) {
  process.send?.({
    type: "failed",
    message: error instanceof Error ? error.message : "Visit document fixture failed.",
  });
  process.exitCode = 1;
} finally {
  process.disconnect?.();
}
