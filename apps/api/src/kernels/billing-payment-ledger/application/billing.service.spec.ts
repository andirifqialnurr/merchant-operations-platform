import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { NO_CHARGES, type PaymentMethod } from "@merchant/contracts";
import { ConflictException } from "@nestjs/common";

import { billTotal, cashChange } from "../domain/bill-total.js";
import type {
  NewRefund,
  RefundOutcome,
  RefundRecord,
  BillingRepository,
  CheckoutRecord,
  FullPayment,
  FullPaymentOutcome,
  NewPaymentClaim,
  PaymentClaimRecord,
  SessionPayment,
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
  readonly claims: PaymentClaimRecord[] = [];

  async claimPayment(claim: NewPaymentClaim) {
    const waiting = this.claims.find(
      (item) => item.status === "VERIFYING" && item.tableSessionId === claim.tableSessionId,
    );
    if (waiting) return waiting;
    const made: PaymentClaimRecord = {
      amountMinor: claim.amountMinor,
      claimedAt: new Date(),
      id: randomUUID(),
      method: claim.method,
      status: "VERIFYING",
      tableSessionId: claim.tableSessionId,
    };
    this.claims.push(made);
    return made;
  }

  async findClaim(_tenantId: string, _outletId: string, id: string) {
    return this.claims.find((item) => item.id === id) ?? null;
  }

  async verifyingClaims() {
    return this.claims.filter((item) => item.status === "VERIFYING");
  }

  async rejectClaim(_tenantId: string, _outletId: string, id: string) {
    const claim = this.claims.find((item) => item.id === id && item.status === "VERIFYING");
    if (!claim) return null;
    claim.status = "FAILED";
    return claim;
  }

  async findSessionCheckoutByIdempotencyKey(_tenantId: string, _outletId: string, key: string) {
    const found = this.checkouts.filter((item) => item.key === key);
    if (found.length === 0) return null;
    return {
      checkouts: found.map(({ bill, sale }) => ({ bill, sale })),
      payment: found[0]!.payment,
    };
  }

  async recordSessionPayment(payment: SessionPayment) {
    if (!this.shiftOpen) return { kind: "shift_not_open" as const };
    if (payment.claimId) {
      const claim = this.claims.find((item) => item.id === payment.claimId);
      if (
        !claim ||
        claim.status !== "VERIFYING" ||
        claim.amountMinor !== payment.totalMinor ||
        claim.method !== payment.method
      ) {
        return { kind: "claim_changed" as const };
      }
      claim.status = "PAID";
    }
    if (payment.bills.some((line) => this.canceledOrders.has(line.orderId))) {
      return { kind: "order_canceled" as const };
    }
    if (
      this.checkouts.some((item) =>
        payment.bills.some((line) => line.orderId === item.bill.orderId),
      )
    ) {
      return { kind: "bill_already_paid" as const };
    }
    const now = new Date();
    const paid = {
      amountMinor: payment.totalMinor,
      confirmedAt: now,
      id: randomUUID(),
      method: payment.method,
      reference: payment.reference,
      status: "PAID" as const,
      tenderedMinor: payment.tenderedMinor,
    };
    const made = payment.bills.map((line) => {
      const checkout = {
        bill: {
          chargesIncluded: payment.charges.included,
          currency: payment.currency,
          discountMinor: 0n,
          id: randomUUID(),
          orderId: line.orderId,
          paidMinor: line.totalMinor,
          roundingMinor: 0n,
          serviceChargeMinor: line.serviceChargeMinor,
          serviceChargeRateBp: payment.charges.serviceChargeRateBp,
          status: "PAID" as const,
          subtotalMinor: line.subtotalMinor,
          tableSessionId: payment.tableSessionId,
          taxMinor: line.taxMinor,
          taxRateBp: payment.charges.taxRateBp,
          totalMinor: line.totalMinor,
        },
        key: payment.idempotencyKey,
        method: payment.method,
        payment: paid,
        sale: {
          completedAt: now,
          id: randomUUID(),
          saleNumber: this.checkouts.length + 1,
          status: "COMPLETED" as const,
          totalMinor: line.totalMinor,
        },
        shift: payment.registerSessionId,
      };
      this.checkouts.push(checkout);
      return { bill: checkout.bill, sale: checkout.sale };
    });
    return { checkout: { checkouts: made, payment: paid }, kind: "recorded" as const };
  }

  async findPaidCheckoutByOrder(_tenantId: string, _outletId: string, orderId: string) {
    const found = this.checkouts.find((item) => item.bill.orderId === orderId);
    return found ? { ...found, cashierName: "Kasir Uji" } : null;
  }

  readonly refunds: (RefundRecord & { key: string; saleId: string; shift: string })[] = [];

  async paidOrders(_tenantId: string, orderIds: readonly string[]) {
    return new Map(
      this.checkouts
        .filter((item) => orderIds.includes(item.bill.orderId))
        .map(
          (item) =>
            [
              item.bill.orderId,
              {
                saleNumber: item.sale.saleNumber,
                saleStatus: item.sale.status,
                totalMinor: item.bill.totalMinor,
              },
            ] as const,
        ),
    );
  }

  async refundsOfSale(_tenantId: string, saleId: string) {
    return this.refunds.filter((refund) => refund.saleId === saleId);
  }

  async findRefundByIdempotencyKey(_tenantId: string, _outletId: string, key: string) {
    const refund = this.refunds.find((item) => item.key === key);
    const checkout = this.checkouts.find((item) => item.sale.id === refund?.saleId);
    if (!refund || !checkout) return null;
    return {
      orderId: checkout.bill.orderId,
      result: { refunds: await this.refundsOfSale("", checkout.sale.id), sale: checkout.sale },
    };
  }

  async sumRefundsByMethod(_tenantId: string, registerSessionId: string) {
    const sums = new Map<PaymentMethod, bigint>();
    for (const refund of this.refunds.filter((item) => item.shift === registerSessionId)) {
      sums.set(refund.method, (sums.get(refund.method) ?? 0n) + refund.amountMinor);
    }
    return sums;
  }

  async recordRefund(refund: NewRefund): Promise<RefundOutcome> {
    if (!this.shiftOpen) return { kind: "shift_not_open" };
    const checkout = this.checkouts.find((item) => item.sale.id === refund.saleId)!;
    const refunded = (await this.refundsOfSale("", refund.saleId)).reduce(
      (sum, item) => sum + item.amountMinor,
      0n,
    );
    const refundableMinor = checkout.sale.totalMinor - refunded;
    if (refund.amountMinor > refundableMinor)
      return { kind: "exceeds_refundable", refundableMinor };
    this.refunds.push({
      amountMinor: refund.amountMinor,
      createdAt: new Date(),
      id: randomUUID(),
      key: refund.idempotencyKey,
      method: refund.method,
      reason: refund.reason,
      saleId: refund.saleId,
      shift: refund.registerSessionId,
    });
    checkout.sale = {
      ...checkout.sale,
      status: refund.amountMinor === refundableMinor ? "REFUNDED" : "PARTIALLY_REFUNDED",
    };
    return {
      kind: "recorded",
      result: { refunds: await this.refundsOfSale("", refund.saleId), sale: checkout.sale },
    };
  }

  async findCheckoutByIdempotencyKey(_tenantId: string, _outletId: string, key: string) {
    return this.checkouts.find((item) => item.key === key) ?? null;
  }

  async sumPaymentsByMethod(_tenantId: string, registerSessionId: string) {
    const sums = new Map<PaymentMethod, bigint>();
    for (const item of this.checkouts.filter((entry) => entry.shift === registerSessionId)) {
      sums.set(
        item.payment.method,
        (sums.get(item.payment.method) ?? 0n) + item.payment.amountMinor,
      );
    }
    return sums;
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
        chargesIncluded: payment.charges.included,
        currency: payment.currency,
        discountMinor: 0n,
        id: randomUUID(),
        orderId: payment.orderId,
        paidMinor: payment.totalMinor,
        roundingMinor: 0n,
        serviceChargeMinor: payment.serviceChargeMinor,
        serviceChargeRateBp: payment.charges.serviceChargeRateBp,
        status: "PAID" as const,
        subtotalMinor: payment.subtotalMinor,
        tableSessionId: null,
        taxMinor: payment.taxMinor,
        taxRateBp: payment.charges.taxRateBp,
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
// The M1 rule unless a test says otherwise: the menu price is the final price.
const base = {
  charges: NO_CHARGES,
  outletId: OUTLET,
  registerSessionId: SHIFT,
  tenantId: TENANT,
};
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
    [[paidOrder.id, { saleNumber: 1, saleStatus: "COMPLETED", totalMinor: 64_000n }]],
  );
});

test("returns the paid checkout of an order with its cashier", async () => {
  const { service } = setup();
  const paidOrder = order();
  assert.equal(await service.paidCheckout(TENANT, OUTLET, paidOrder.id), null);
  await service.payOrderInFull(
    { ...base, idempotencyKey: "key-1", order: paidOrder, pay: cash("100000") },
    context,
  );
  const receipt = await service.paidCheckout(TENANT, OUTLET, paidOrder.id);
  assert.equal(receipt?.cashierName, "Kasir Uji");
  assert.equal(receipt?.checkout.payment.changeMinor, "36000");
  assert.equal(receipt?.checkout.sale.saleNumber, 1);
});

test("takes transfer and EDC with a reference and keeps them out of the drawer", async () => {
  const { service } = setup();
  await service.payOrderInFull(
    {
      ...base,
      idempotencyKey: "key-1",
      order: order(),
      pay: { method: "TRANSFER", reference: "BCA-771" },
    },
    context,
  );
  const edc = await service.payOrderInFull(
    {
      ...base,
      idempotencyKey: "key-2",
      order: order({ subtotalMinor: "30000" }),
      pay: { method: "EDC" },
    },
    context,
  );
  await service.payOrderInFull(
    {
      ...base,
      idempotencyKey: "key-3",
      order: order({ subtotalMinor: "10000" }),
      pay: cash("10000"),
    },
    context,
  );
  assert.equal(edc.payment.reference, null);
  assert.equal(edc.payment.tenderedMinor, null);

  const taken = await service.paymentsInSession(TENANT, SHIFT);
  assert.equal(taken.cashMinor, 10_000n);
  assert.deepEqual(taken.nonCash, [
    { amountMinor: 64_000n, method: "TRANSFER" },
    { amountMinor: 30_000n, method: "EDC" },
  ]);
  assert.equal(await service.cashReceivedInSession(TENANT, SHIFT), 10_000n);
});

test("refunds part then the rest of a sale, never more, and counts cash refunds", async () => {
  const { service } = setup();
  const paidOrder = order();
  await service.payOrderInFull(
    { ...base, idempotencyKey: "pay-1", order: paidOrder, pay: cash("64000") },
    context,
  );
  const refundBase = { ...base, orderId: paidOrder.id };

  const partial = await service.refundOrder(
    {
      ...refundBase,
      idempotencyKey: "refund-1",
      refund: { amountMinor: "14000", reason: "Salah pesan" },
    },
    context,
  );
  assert.equal(partial.sale.status, "PARTIALLY_REFUNDED");
  assert.equal(partial.refundableMinor, "50000");
  assert.equal(partial.refunds[0]!.method, "CASH");

  const retry = await service.refundOrder(
    {
      ...refundBase,
      idempotencyKey: "refund-1",
      refund: { amountMinor: "14000", reason: "Salah pesan" },
    },
    context,
  );
  assert.equal(retry.refunds.length, 1);

  await rejectsWithCode(
    service.refundOrder(
      {
        ...refundBase,
        idempotencyKey: "refund-2",
        refund: { amountMinor: "50001", reason: "Lebih" },
      },
      context,
    ),
    "REFUND_EXCEEDS_REFUNDABLE",
  );
  const rest = await service.refundOrder(
    {
      ...refundBase,
      idempotencyKey: "refund-3",
      refund: { amountMinor: "50000", reason: "Batal semua" },
    },
    context,
  );
  assert.equal(rest.sale.status, "REFUNDED");
  assert.equal(rest.refundableMinor, "0");

  const taken = await service.paymentsInSession(TENANT, SHIFT);
  assert.equal(taken.cashMinor, 64_000n);
  assert.equal(taken.cashRefundsMinor, 64_000n);
  assert.equal(await service.cashReceivedInSession(TENANT, SHIFT), 0n);
  assert.equal(
    (await service.paidOrders(TENANT, [paidOrder.id])).get(paidOrder.id)?.saleStatus,
    "REFUNDED",
  );

  await rejectsWithCode(
    service.refundOrder(
      {
        ...base,
        idempotencyKey: "refund-4",
        orderId: order().id,
        refund: { amountMinor: "1000", reason: "Tidak ada" },
      },
      context,
    ),
    "ORDER_NOT_PAID",
  );
});

test("tax and service added on the receipt raise the total; the bill keeps every part", async () => {
  const { service } = setup();
  const charges = { included: false, serviceChargeRateBp: 500, taxRateBp: 1000 };
  const paid = await service.payOrderInFull(
    {
      ...base,
      charges,
      idempotencyKey: "added-1",
      order: order({ subtotalMinor: "100000" }),
      pay: cash("120000"),
    },
    context,
  );
  assert.deepEqual(
    [
      paid.bill.subtotalMinor,
      paid.bill.serviceChargeMinor,
      paid.bill.taxMinor,
      paid.bill.totalMinor,
      paid.payment.amountMinor,
      paid.payment.changeMinor,
    ],
    ["100000", "5000", "10500", "115500", "115500", "4500"],
  );
  assert.deepEqual(
    [paid.bill.chargesIncluded, paid.bill.serviceChargeRateBp, paid.bill.taxRateBp],
    [false, 500, 1000],
  );
  // Cash that covers the menu price but not the total is not enough.
  await rejectsWithCode(
    service.payOrderInFull(
      {
        ...base,
        charges,
        idempotencyKey: "added-2",
        order: order({ subtotalMinor: "100000" }),
        pay: cash("100000"),
      },
      context,
    ),
    "PAYMENT_TENDERED_INSUFFICIENT",
  );
});

test("tax and service already in the price leave the total alone and are taken out of it", async () => {
  const { service } = setup();
  const paid = await service.payOrderInFull(
    {
      ...base,
      charges: { included: true, serviceChargeRateBp: 500, taxRateBp: 1000 },
      idempotencyKey: "included-1",
      order: order({ subtotalMinor: "115500" }),
      pay: cash("115500"),
    },
    context,
  );
  assert.deepEqual(
    [
      paid.bill.subtotalMinor,
      paid.bill.serviceChargeMinor,
      paid.bill.taxMinor,
      paid.bill.totalMinor,
      paid.payment.changeMinor,
      paid.bill.chargesIncluded,
    ],
    ["100000", "5000", "10500", "115500", "0", true],
  );
});

test("a total other than the one the cashier saw is not charged", async () => {
  const { repository, service } = setup();
  const charges = { included: false, serviceChargeRateBp: 0, taxRateBp: 1100 };
  const input = {
    ...base,
    charges,
    idempotencyKey: "seen-1",
    order: order({ subtotalMinor: "50000" }),
  };
  await rejectsWithCode(
    service.payOrderInFull(
      { ...input, pay: { ...cash("60000"), expectedTotalMinor: "50000" } },
      context,
    ),
    "ORDER_TOTAL_CHANGED",
  );
  assert.equal(repository.checkouts.length, 0);
  const paid = await service.payOrderInFull(
    { ...input, pay: { ...cash("60000"), expectedTotalMinor: "55500" } },
    context,
  );
  assert.equal(paid.bill.totalMinor, "55500");
});

const VISIT = "019f738d-e61f-7d46-92de-17b35f975199";

test("a table visit pays all its orders with one payment, a bill and a sale per order", async () => {
  const { repository, service } = setup();
  const paid = await service.payTableSessionInFull(
    {
      ...base,
      charges: { included: false, serviceChargeRateBp: 500, taxRateBp: 1_000 },
      idempotencyKey: "visit-1",
      orders: [order({ subtotalMinor: "50000" }), order({ subtotalMinor: "30000" })],
      pay: { ...cash("100000"), expectedTotalMinor: "92400" },
      tableSessionId: VISIT,
    },
    context,
  );
  // Each order is billed as if paid alone: 50.000 + 5% + 10% and 30.000 + 5% + 10%.
  assert.deepEqual(
    paid.checkouts.map(({ bill }) => bill.totalMinor),
    ["57750", "34650"],
  );
  assert.equal(paid.payment.amountMinor, "92400");
  assert.equal(paid.payment.changeMinor, "7600");
  assert.deepEqual(
    paid.checkouts.map(({ sale }) => sale.saleNumber),
    [1, 2],
  );
  assert.equal(repository.checkouts.length, 2);

  // The same key returns the same payment.
  const again = await service.payTableSessionInFull(
    {
      ...base,
      idempotencyKey: "visit-1",
      orders: [],
      pay: cash("100000"),
      tableSessionId: VISIT,
    },
    context,
  );
  assert.equal(again.payment.id, paid.payment.id);
  await rejectsWithCode(
    service.payTableSessionInFull(
      {
        ...base,
        idempotencyKey: "visit-1",
        orders: [],
        pay: cash("100000"),
        tableSessionId: randomUUID(),
      },
      context,
    ),
    "IDEMPOTENCY_KEY_REUSED",
  );
});

test("a table visit is not paid with a changed total, too little cash, or nothing owed", async () => {
  const { service } = setup();
  const visit = (
    pay: Parameters<BillingService["payTableSessionInFull"]>[0]["pay"],
    orders = [order(), order()],
  ) =>
    service.payTableSessionInFull(
      { ...base, idempotencyKey: randomUUID(), orders, pay, tableSessionId: VISIT },
      context,
    );
  await rejectsWithCode(
    visit({ ...cash("200000"), expectedTotalMinor: "64000" }),
    "ORDER_TOTAL_CHANGED",
  );
  await rejectsWithCode(visit(cash("100000")), "PAYMENT_TENDERED_INSUFFICIENT");
  await rejectsWithCode(visit(cash("100000"), []), "TABLE_SESSION_NOTHING_TO_PAY");
  await rejectsWithCode(
    visit({ method: "EDC" }, [order(), order({ status: "CANCELED" })]),
    "ORDER_CANCELED",
  );
});

test("guests claim a visit's payment; it waits for a cashier, who confirms or rejects it", async () => {
  const { repository, service } = setup();
  const orders = [order({ subtotalMinor: "50000" }), order({ subtotalMinor: "25000" })];
  const claimFor = (key: string) =>
    service.claimTableSessionPayment(
      {
        charges: NO_CHARGES,
        idempotencyKey: key,
        method: "TRANSFER",
        orders,
        outletId: OUTLET,
        tableSessionId: VISIT,
        tenantId: TENANT,
      },
      { channel: "WEB" },
    );
  const claim = await claimFor("guest-1");
  assert.equal(claim.amountMinor, "75000");
  // Claiming again while waiting is the same claim; nothing is paid yet.
  assert.equal((await claimFor("guest-2")).id, claim.id);
  assert.equal(repository.checkouts.length, 0);
  assert.deepEqual(
    (await service.verifyingClaims(TENANT, OUTLET)).map((item) => item.id),
    [claim.id],
  );

  // A claim for a different amount than the visit now owes is not confirmed.
  await rejectsWithCode(
    service.payTableSessionInFull(
      {
        ...base,
        claimId: claim.id,
        idempotencyKey: "cashier-0",
        orders: [...orders, order({ subtotalMinor: "10000" })],
        pay: { method: "TRANSFER" },
        tableSessionId: VISIT,
      },
      context,
    ),
    "PAYMENT_CLAIM_CHANGED",
  );

  const paid = await service.payTableSessionInFull(
    {
      ...base,
      claimId: claim.id,
      idempotencyKey: "cashier-1",
      orders,
      pay: { expectedTotalMinor: "75000", method: "TRANSFER" },
      tableSessionId: VISIT,
    },
    context,
  );
  assert.equal(paid.payment.amountMinor, "75000");
  assert.equal(repository.claims[0]!.status, "PAID");
  assert.deepEqual(await service.verifyingClaims(TENANT, OUTLET), []);
  await rejectsWithCode(
    service.rejectClaim(TENANT, OUTLET, claim.id, context),
    "PAYMENT_CLAIM_CHANGED",
  );

  // Rejected: the guest may claim again.
  const second = await service.claimTableSessionPayment(
    {
      charges: NO_CHARGES,
      idempotencyKey: "guest-3",
      method: "MERCHANT_QRIS",
      orders: [order()],
      outletId: OUTLET,
      tableSessionId: randomUUID(),
      tenantId: TENANT,
    },
    { channel: "WEB" },
  );
  assert.equal((await service.rejectClaim(TENANT, OUTLET, second.id, context)).id, second.id);
  assert.equal(await service.verifyingClaim(TENANT, OUTLET, second.id), null);

  // Nothing owed, nothing to claim.
  await rejectsWithCode(
    claimFor("guest-4").then(() =>
      service.claimTableSessionPayment(
        {
          charges: NO_CHARGES,
          idempotencyKey: "guest-5",
          method: "TRANSFER",
          orders: [],
          outletId: OUTLET,
          tableSessionId: VISIT,
          tenantId: TENANT,
        },
        { channel: "WEB" },
      ),
    ),
    "TABLE_SESSION_NOTHING_TO_PAY",
  );
});
