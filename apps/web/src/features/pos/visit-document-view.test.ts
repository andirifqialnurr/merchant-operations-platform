import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Order, VisitDocument } from "@merchant/contracts";
import id from "../../../messages/id.json";
import { formatMoney } from "../../lib/format.ts";
import { visitDocumentView } from "./visit-document-view.ts";

function text(key: string, values?: Record<string, string | number>) {
  const value = key.startsWith("state.")
    ? id.visitDocument.state[key.slice(6) as keyof typeof id.visitDocument.state]
    : id.visitDocument[key as keyof typeof id.visitDocument];
  assert.equal(typeof value, "string");
  return String(value).replace(/\{(\w+)\}/g, (_match, name: string) => String(values?.[name]));
}
function order(number = 1): Order {
  return {
    id: randomUUID(),
    cancelReason: null,
    canceledAt: null,
    createdAt: "2026-10-20T08:00:00Z",
    currency: "IDR",
    items: [
      {
        id: randomUUID(),
        lineTotalMinor: "50000",
        modifiers: [{ groupName: "Manis", optionName: "Tanpa gula", priceDeltaMinor: "0" }],
        name: "Kopi",
        note: "Pisahkan es",
        productId: randomUUID(),
        quantity: 1,
        unitPriceMinor: "50000",
        variantName: "Dingin",
      },
    ],
    note: "Bawa ke meja",
    moderationStatus: "NOT_REQUIRED",
    orderNumber: number,
    orderType: "DINE_IN",
    outletId: randomUUID(),
    source: "POS",
    status: "SUBMITTED",
    submittedAt: "2026-10-20T08:00:00Z",
    tableSessionId: randomUUID(),
    subtotalMinor: "50000",
  };
}
function document(): VisitDocument {
  const taken = order();
  return {
    currency: "IDR",
    kind: "RECEIPT",
    state: "PAID",
    pendingOrders: [],
    visit: { id: taken.tableSessionId!, displayNumber: 7, status: "OPEN" },
    tableLabel: "T1",
    outlet: { name: "Outlet", workspaceName: "Workspace", timezone: "Asia/Jakarta" },
    orders: [
      {
        order: taken,
        paymentId: "payment-1",
        sale: null,
        pricing: {
          source: "PAID_SNAPSHOT",
          currency: "IDR",
          chargesIncluded: true,
          serviceChargeRateBp: 0,
          taxRateBp: 0,
          subtotalMinor: "50000",
          taxMinor: "0",
          serviceChargeMinor: "0",
          discountMinor: "0",
          roundingMinor: "0",
          totalMinor: "50000",
        },
      },
    ],
    payments: [
      {
        id: "payment-1",
        method: "CASH",
        amountMinor: "50000",
        tenderedMinor: "100000",
        changeMinor: "50000",
        status: "PAID",
        reference: null,
        confirmedAt: "2026-10-20T08:00:00Z",
        cashierName: "Ayu",
      },
    ],
    refunds: [],
    totals: {
      subtotalMinor: "50000",
      discountMinor: "0",
      taxMinor: "0",
      serviceChargeMinor: "0",
      roundingMinor: "0",
      totalMinor: "50000",
      paidMinor: "50000",
      dueMinor: "0",
      refundedMinor: "0",
      netPaidMinor: "50000",
    },
  };
}
const view = (doc: VisitDocument) =>
  visitDocumentView(
    doc,
    text,
    (amount) => formatMoney(amount, doc.currency, "id-ID"),
    () => "20 Okt 2026, 15.00",
    "id-ID",
  );

test("visit view prints each unique payment once, not once per order, and leaves source unchanged", () => {
  const doc = document();
  doc.orders.push({ ...structuredClone(doc.orders[0]!), order: order(2) });
  const before = structuredClone(doc);
  const result = view(doc);
  assert.equal(result.paymentGroups?.length, 1);
  assert.equal(result.lineGroups?.length, 2);
  assert.equal(result.paymentGroups?.[0]?.title, "Tunai");
  assert.deepEqual(
    result.paymentGroups?.[0]?.rows?.map((row) => row.label),
    ["Pembayaran", "Uang diterima", "Kembalian", "Waktu", "Kasir"],
  );
  assert.equal(result.totals.length, 1, "no duplicated aggregate paid/subtotal/tax rows");
  assert.equal(result.documentLabel, "Struk");
  assert.deepEqual(doc, before);
});

test("pending-only and empty views never invent price, debt zero or a paid label", () => {
  const doc = document();
  doc.orders = [];
  doc.payments = [];
  doc.pendingOrders = [{ ...order(), moderationStatus: "PENDING" }];
  doc.state = "PENDING";
  doc.kind = "BILL";
  let result = view(doc);
  assert.equal(result.totals.length, 0);
  assert.equal(result.paymentGroups?.length, 0);
  assert.equal(result.lineGroups?.[0]?.lines?.[0]?.amount, undefined);
  assert.equal(result.documentLabel, "Tagihan · Menunggu tinjauan");
  doc.pendingOrders = [];
  doc.state = "EMPTY";
  result = view(doc);
  assert.equal(result.lineGroups?.length, 0);
  assert.equal(result.totals.length, 0);
});

test("unpaid uses one amount location while partial payment exposes the remaining due once", () => {
  const doc = document();
  doc.state = "UNPAID";
  doc.kind = "BILL";
  doc.payments = [];
  let result = view(doc);
  assert.deepEqual(
    result.totals.map((row) => row.label),
    ["Belum dibayar"],
  );
  doc.state = "PARTIALLY_PAID";
  doc.payments = document().payments;
  doc.totals.dueMinor = "25000";
  result = view(doc);
  assert.deepEqual(
    result.totals.map((row) => row.label),
    ["Total", "Belum dibayar"],
  );
});

test("tax/service are explained at their snapshot order only, including mixed included/added rates", () => {
  const doc = document();
  const first = doc.orders[0]!;
  Object.assign(first.pricing, { taxMinor: "4955", taxRateBp: 1100, chargesIncluded: true });
  doc.orders.push({
    ...structuredClone(first),
    order: order(2),
    pricing: {
      ...first.pricing,
      chargesIncluded: false,
      taxRateBp: 1000,
      taxMinor: "5000",
      serviceChargeRateBp: 500,
      serviceChargeMinor: "2500",
      discountMinor: "1000",
      roundingMinor: "-1",
    },
  });
  const result = view(doc);
  assert.deepEqual(
    result.lineGroups?.[0]?.rows?.map((row) => row.label),
    ["Termasuk pajak 11%"],
  );
  assert.deepEqual(
    result.lineGroups?.[1]?.rows?.map((row) => row.label),
    ["Diskon", "Layanan 5%", "Pajak 10%", "Pembulatan"],
  );
  assert.deepEqual(
    result.totals.map((row) => row.label),
    ["Total"],
  );
});

test("refunds appear once with their order, net paid once, without audit/reason or duplicate aggregate refund", () => {
  const doc = document();
  doc.refunds = [
    {
      id: randomUUID(),
      orderId: doc.orders[0]!.order.id,
      amountMinor: "10000",
      method: "CASH",
      createdAt: "2026-10-20T08:00:00Z",
      reason: "PRIVATE AUDIT REASON",
    },
  ];
  doc.totals.netPaidMinor = "40000";
  const result = view(doc);
  assert.equal(result.paymentGroups?.length, 2);
  assert.equal(result.paymentGroups?.[1]?.title, "Pengembalian · Pesanan #1");
  assert.deepEqual(
    result.totals.map((row) => row.label),
    ["Total", "Pembayaran bersih"],
  );
  assert.equal(JSON.stringify(result).includes("PRIVATE AUDIT REASON"), false);
});

test("exact cash and non-applicable metadata rows are omitted; snapshot USD formatting stays exact", () => {
  const doc = document();
  const payment = doc.payments[0]!;
  payment.tenderedMinor = payment.amountMinor;
  payment.changeMinor = "0";
  doc.outlet.workspaceName = doc.outlet.name;
  doc.tableLabel = null;
  let result = view(doc);
  assert.equal(result.subtitle, undefined);
  assert.equal(result.meta.length, 1);
  assert.deepEqual(
    result.paymentGroups?.[0]?.rows?.map((row) => row.label),
    ["Pembayaran", "Waktu", "Kasir"],
  );
  payment.method = "TRANSFER";
  payment.tenderedMinor = null;
  payment.changeMinor = null;
  payment.reference = "BANK-1";
  result = view(doc);
  assert.equal(result.paymentGroups?.[0]?.title, "Transfer");
  assert.equal(result.paymentGroups?.[0]?.rows?.at(-1)?.value, "BANK-1");
  doc.currency = "USD";
  doc.totals.totalMinor = "9007199254740993";
  result = view(doc);
  assert.equal(result.totals[0]!.value, formatMoney("9007199254740993", "USD", "id-ID"));
});
