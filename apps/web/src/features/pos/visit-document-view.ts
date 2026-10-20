import type { Order, PaymentMethod, VisitDocument } from "@merchant/contracts";
import type { ReceiptGroup, ReceiptLine, ReceiptProps, ReceiptRow } from "@merchant/ui/receipt";
import { ratePercent } from "@/lib/charges";

type TextKey =
  | "visit"
  | "table"
  | "order"
  | "pendingOrder"
  | "paymentAmount"
  | "time"
  | "cashier"
  | "reference"
  | "tendered"
  | "change"
  | "total"
  | "due"
  | "netPaid"
  | "refundOrder"
  | "discount"
  | "rounding"
  | "serviceAdded"
  | "serviceIncluded"
  | "taxAdded"
  | "taxIncluded"
  | "methodCash"
  | "methodQris"
  | "methodTransfer"
  | "methodEdc"
  | "methodOther"
  | `state.${VisitDocument["state"]}`;
type Copy = (key: TextKey, values?: Record<string, string | number>) => string;
const methodKeys = {
  CASH: "methodCash",
  EDC: "methodEdc",
  MERCHANT_QRIS: "methodQris",
  TRANSFER: "methodTransfer",
  OTHER: "methodOther",
} as const satisfies Record<PaymentMethod, TextKey>;

function lines(order: Order, money: (value: string) => string, priced: boolean): ReceiptLine[] {
  return order.items.map((item) => {
    const detail = [
      item.variantName,
      ...item.modifiers.map((modifier) => modifier.optionName),
      item.note,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      key: item.id,
      name: item.name,
      quantity: `${item.quantity}×`,
      ...(priced ? { amount: money(item.lineTotalMinor) } : {}),
      ...(detail ? { detail } : {}),
    };
  });
}

/** Formatting only. No aggregation/repricing of ledger data and no editable money fields. */
export function visitDocumentView(
  doc: VisitDocument,
  t: Copy,
  money: (value: string) => string,
  dateTime: (iso: string) => string,
  locale: string,
): Pick<
  ReceiptProps,
  | "title"
  | "subtitle"
  | "documentLabel"
  | "meta"
  | "lines"
  | "lineGroups"
  | "totals"
  | "payment"
  | "paymentGroups"
> {
  const lineGroups: ReceiptGroup[] = doc.orders.map(({ order, pricing }) => {
    const rows: ReceiptRow[] = [];
    if (pricing.discountMinor !== "0")
      rows.push({ label: t("discount"), value: `−${money(pricing.discountMinor)}` });
    if (pricing.serviceChargeMinor !== "0")
      rows.push({
        label: t(pricing.chargesIncluded ? "serviceIncluded" : "serviceAdded", {
          rate: ratePercent(pricing.serviceChargeRateBp, locale),
        }),
        value: money(pricing.serviceChargeMinor),
      });
    if (pricing.taxMinor !== "0")
      rows.push({
        label: t(pricing.chargesIncluded ? "taxIncluded" : "taxAdded", {
          rate: ratePercent(pricing.taxRateBp, locale),
        }),
        value: money(pricing.taxMinor),
      });
    if (pricing.roundingMinor !== "0")
      rows.push({ label: t("rounding"), value: money(pricing.roundingMinor) });
    return {
      key: order.id,
      title: t("order", { number: order.orderNumber }),
      lines: lines(order, money, true),
      rows,
      ...(order.note ? { detail: order.note } : {}),
    };
  });
  lineGroups.push(
    ...doc.pendingOrders.map((order) => ({
      key: order.id,
      title: t("pendingOrder", { number: order.orderNumber }),
      lines: lines(order, money, false),
      ...(order.note ? { detail: order.note } : {}),
    })),
  );
  const totals: ReceiptRow[] = [];
  if (doc.orders.length > 0) {
    totals.push({
      emphasis: true,
      label: t(doc.payments.length === 0 ? "due" : "total"),
      value: money(doc.totals.totalMinor),
    });
    if (doc.payments.length > 0 && BigInt(doc.totals.dueMinor) > 0n)
      totals.push({ emphasis: true, label: t("due"), value: money(doc.totals.dueMinor) });
    if (doc.refunds.length > 0)
      totals.push({ label: t("netPaid"), value: money(doc.totals.netPaidMinor) });
  }
  const paymentGroups: ReceiptGroup[] = doc.payments.map((payment) => ({
    key: payment.id,
    title: t(methodKeys[payment.method]),
    rows: [
      { label: t("paymentAmount"), value: money(payment.amountMinor) },
      ...(payment.tenderedMinor !== null && payment.tenderedMinor !== payment.amountMinor
        ? [{ label: t("tendered"), value: money(payment.tenderedMinor) }]
        : []),
      ...(payment.changeMinor !== null && BigInt(payment.changeMinor) > 0n
        ? [{ label: t("change"), value: money(payment.changeMinor) }]
        : []),
      ...(payment.confirmedAt ? [{ label: t("time"), value: dateTime(payment.confirmedAt) }] : []),
      { label: t("cashier"), value: payment.cashierName },
      ...(payment.reference ? [{ label: t("reference"), value: payment.reference }] : []),
    ],
  }));
  const orderNumbers = new Map(doc.orders.map(({ order }) => [order.id, order.orderNumber]));
  paymentGroups.push(
    ...doc.refunds.map((refund) => ({
      key: refund.id,
      title: t("refundOrder", { number: orderNumbers.get(refund.orderId)! }),
      rows: [{ label: t(methodKeys[refund.method]), value: `−${money(refund.amountMinor)}` }],
    })),
  );
  return {
    title: doc.outlet.name,
    ...(doc.outlet.workspaceName !== doc.outlet.name ? { subtitle: doc.outlet.workspaceName } : {}),
    documentLabel: t(`state.${doc.state}`),
    meta: [
      { label: t("visit"), value: `#${doc.visit.displayNumber}` },
      ...(doc.tableLabel ? [{ label: t("table"), value: doc.tableLabel }] : []),
    ],
    lines: [],
    lineGroups,
    totals,
    payment: [],
    paymentGroups,
  };
}
