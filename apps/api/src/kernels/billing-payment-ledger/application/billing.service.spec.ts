import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { ConflictException } from "@nestjs/common";

import { billTotal, cashChange } from "../domain/bill-total.js";
import type {
  BillingRepository,
  CheckoutRecord,
  FullPayment,
  FullPaymentOutcome,
} from "./billing.repository.js";
import { BillingService, type PayableOrder } from "./billing.service.js";

const TENANT = "019f738d-e61f-7d46-92de-17b35f975100";
const OUTLET = "019f738d-e61f-7d46-92de-17b35f975101";
const SHIFT = "019f738d-e61f-7d46-92de-17b35f975102";
const ACTOR = "019f738d-e61f-7d46-92de-17b35f975103";

class InMemoryBillingRepository implements BillingRepository {
  readonly checkouts: (CheckoutRecord & { key: string; method: string; shift: string })[] = [];
  shiftOpen = true;
  canceledOrders = new Set<string>();

  async paidOrders(_tenantId: string, orderIds: readonly string[]) {
    return new Map(
      this.checkouts
        .filter((item) => orderIds.includes(item.bill.orderId))
        .map((item) => [item.bill.orderId, item.sale.saleNumber] as const),
    );
  }

  async findCheckoutByIdempotencyKey(_tenantId: string, _outletId: string, key: string) {
    return this.checkouts.find((item) => item.key === key) ?? null;
  }

  async sumCashPayments(_tenantId: string, registerSessionId: string) {
    return this.checkouts
      .filter((item) => item.shift === registerSessionId && item.method === "CASH")
      .reduce((sum, item) => sum + item.payment.amountMinor, 0n);
  }

  async recordFullPayment(payment: FullPayment): Promise<FullPaymentOutcome> {
    if (!this.shiftOpen) return { kind: "shift_not_open" };
    if (this.canceledOrders.has(payment.orderId)) return { kind: "order_canceled" };
    if (this.checkouts.some((item) => item.bill.orderId === payment.orderId)) {
      return { kind: "bill_already_paid" };
    }
    const now = new Date();
    const checkout = {
      bill: {
        currency: payment.currency,
        discountMinor: 0n,
        id: randomUUID(),
        orderId: payment.orderId,
        paidMinor: payment.totalMinor,
        roundingMinor: 0n,
        serviceChargeMinor: 0n,
        status: "PAID" as const,
        subtotalMinor: payment.subtotalMinor,
        taxMinor: 0n,
        totalMinor: payment.totalMinor,
      },
      key: payment.idempotencyKey,
      method: payment.method,
      payment: {
        amountMinor: payment.totalMinor,
        confirmedAt: now,
        id: randomUUID(),
        method: payment.method,
        reference: payment.reference,
        status: "PAID" as const,
        tenderedMinor: payment.tenderedMinor,
      },
      sale: {
        completedAt: now,
        id: randomUUID(),
        saleNumber: this.checkouts.length + 1,
        status: "COMPLETED" as const,
        totalMinor: payment.totalMinor,
      },
      shift: payment.registerSessionId,
    };
    this.checkouts.push(checkout);
    return { checkout, kind: "recorded" };
  }
}

function setup() {
  const repository = new InMemoryBillingRepository();
  return { repository, service: new BillingService(repository) };
}

function order(overrides: Partial<PayableOrder> = {}): PayableOrder {
  return {
    currency: "IDR",
    id: randomUUID(),
    status: "SUBMITTED",
    subtotalMinor: "64000",
    ...overrides,
  };
}

const context = { actorId: ACTOR };
const base = { outletId: OUTLET, registerSessionId: SHIFT, tenantId: TENANT };
const cash = (tenderedMinor: string) => ({ method: "CASH" as const, tenderedMinor });

async function rejectsWithCode(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ConflictException);
    assert.equal((error.getResponse() as { code: string }).code, code);
    return true;
  });
}

test("derives the bill total and the cash change from integer minor units", () => {
  assert.equal(billTotal({ subtotalMinor: 64_000n }), 64_000n);
  assert.equal(
    billTotal({
      discountMinor: 4_000n,
      roundingMinor: -50n,
      serviceChargeMinor: 3_000n,
      subtotalMinor: 64_000n,
      taxMinor: 6_050n,
    }),
    69_000n,
  );
  assert.equal(cashChange(100_000n, 64_000n), 36_000n);
  assert.equal(cashChange(64_000n, 64_000n), 0n);
  assert.equal(cashChange(60_000n, 64_000n), null);
});

test("takes a cash payment in full and completes the sale", async () => {
  const { repository, service } = setup();
  const paid = await service.payOrderInFull(
    { ...base, idempotencyKey: "key-1", order: order(), pay: cash("100000") },
    context,
  );

  assert.equal(paid.bill.status, "PAID");
  assert.equal(paid.bill.totalMinor, "64000");
  assert.equal(paid.bill.paidMinor, "64000");
  assert.equal(paid.bill.taxMinor, "0");
  assert.equal(paid.payment.amountMinor, "64000");
  assert.equal(paid.payment.tenderedMinor, "100000");
  assert.equal(paid.payment.changeMinor, "36000");
  assert.equal(paid.payment.status, "PAID");
  assert.ok(paid.payment.confirmedAt);
  assert.equal(paid.sale.status, "COMPLETED");
  assert.equal(paid.sale.saleNumber, 1);
  assert.equal(paid.sale.totalMinor, "64000");
  assert.equal(await service.cashReceivedInSession(TENANT, SHIFT), 64_000n);
  assert.equal(repository.checkouts.length, 1);
});

test("takes a manual QRIS payment without tendered cash or change", async () => {
  const { service } = setup();
  const paid = await service.payOrderInFull(
    {
      ...base,
      idempotencyKey: "key-1",
      order: order(),
      pay: { method: "MERCHANT_QRIS", reference: "TRX-88213" },
    },
    context,
  );

  assert.equal(paid.payment.method, "MERCHANT_QRIS");
  assert.equal(paid.payment.reference, "TRX-88213");
  assert.equal(paid.payment.tenderedMinor, null);
  assert.equal(paid.payment.changeMinor, null);
  // Non-cash money never enters the drawer.
  assert.equal(await service.cashReceivedInSession(TENANT, SHIFT), 0n);
});

test("replays a retried payment and never charges an order twice", async () => {
  const { repository, service } = setup();
  const target = order();
  const first = await service.payOrderInFull(
    { ...base, idempotencyKey: "key-1", order: target, pay: cash("70000") },
    context,
  );
  const retry = await service.payOrderInFull(
    { ...base, idempotencyKey: "key-1", order: target, pay: cash("70000") },
    context,
  );
  assert.equal(retry.payment.id, first.payment.id);
  assert.equal(repository.checkouts.length, 1);

  await rejectsWithCode(
    service.payOrderInFull(
      { ...base, idempotencyKey: "key-2", order: target, pay: cash("70000") },
      context,
    ),
    "BILL_ALREADY_PAID",
  );
  await rejectsWithCode(
    service.payOrderInFull(
      { ...base, idempotencyKey: "key-1", order: order(), pay: cash("70000") },
      context,
    ),
    "IDEMPOTENCY_KEY_REUSED",
  );
  assert.equal(repository.checkouts.length, 1);
});

test("refuses payments that cannot be taken", async () => {
  const { repository, service } = setup();
  const pay = (target: PayableOrder, tendered: string, key: string) =>
    service.payOrderInFull(
      { ...base, idempotencyKey: key, order: target, pay: cash(tendered) },
      context,
    );

  await rejectsWithCode(pay(order(), "63999", "key-1"), "PAYMENT_TENDERED_INSUFFICIENT");
  await rejectsWithCode(pay(order({ status: "CANCELED" }), "64000", "key-2"), "ORDER_CANCELED");
  await rejectsWithCode(pay(order({ subtotalMinor: "0" }), "1000", "key-3"), "BILL_NOTHING_TO_PAY");
  repository.shiftOpen = false;
  await rejectsWithCode(pay(order(), "64000", "key-4"), "POS_SHIFT_NOT_OPEN");
  assert.equal(repository.checkouts.length, 0);
});

test("refuses an order cancelled while it was being paid, and reports paid orders", async () => {
  const { repository, service } = setup();
  const paidOrder = order();
  await service.payOrderInFull(
    { ...base, idempotencyKey: "key-1", order: paidOrder, pay: cash("64000") },
    context,
  );
  assert.equal(await service.isOrderPaid(TENANT, paidOrder.id), true);

  const raced = order();
  repository.canceledOrders.add(raced.id);
  await rejectsWithCode(
    service.payOrderInFull(
      { ...base, idempotencyKey: "key-2", order: raced, pay: cash("64000") },
      context,
    ),
    "ORDER_CANCELED",
  );
  assert.equal(await service.isOrderPaid(TENANT, raced.id), false);
  assert.deepEqual(
    [...(await service.paidOrders(TENANT, [paidOrder.id, raced.id]))],
    [[paidOrder.id, 1]],
  );
});
