"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { PaymentMethod, Receipt as ReceiptData } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { ErrorState, Skeleton } from "@merchant/ui/feedback";
import { Receipt, type ReceiptPaper, type ReceiptRow } from "@merchant/ui/receipt";
import { SegmentedControl } from "@merchant/ui/selection-control";
import { Sheet } from "@merchant/ui/sheet";

import { useWorkspace } from "@/features/workspace";
import { useErrorMessage, useFormat } from "@/lib/i18n";

import { useReceipt } from "./api";

const PAPER_KEY = "pos-receipt-paper";
const PAPERS: readonly ReceiptPaper[] = ["58mm", "80mm", "a4"];

/** The paper width is a per-device convenience, so it lives in this browser only. */
function useStoredPaper() {
  const [paper, setPaper] = useState<ReceiptPaper>("80mm");
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PAPER_KEY);
      if (stored && (PAPERS as readonly string[]).includes(stored)) {
        const timer = window.setTimeout(() => setPaper(stored as ReceiptPaper), 0);
        return () => window.clearTimeout(timer);
      }
    } catch {
      // Storage can be unavailable; the default paper still works.
    }
    return undefined;
  }, []);
  return [
    paper,
    (next: ReceiptPaper) => {
      setPaper(next);
      try {
        window.localStorage.setItem(PAPER_KEY, next);
      } catch {
        // Not remembered, but printing still works.
      }
    },
  ] as const;
}

const methodKeys = {
  CASH: "methodCash",
  EDC: "methodEdc",
  MERCHANT_QRIS: "methodQris",
  OTHER: "methodOther",
  TRANSFER: "methodTransfer",
} as const satisfies Record<PaymentMethod, string>;

function ReceiptContent({
  copy,
  paper,
  receipt,
}: Readonly<{ copy: boolean; paper: ReceiptPaper; receipt: ReceiptData }>) {
  const t = useTranslations("pos");
  const { dateTime, money } = useFormat();
  const { outlet, workspace } = useWorkspace();
  const { bill, order, payment, sale } = receipt;

  // Adjustments are listed only when they apply; with none, the total stands alone.
  const adjustments: ReceiptRow[] = [
    ...(bill.discountMinor !== "0"
      ? [{ label: t("discount"), value: `-${money(bill.discountMinor)}` }]
      : []),
    ...(bill.taxMinor !== "0" ? [{ label: t("tax"), value: money(bill.taxMinor) }] : []),
    ...(bill.serviceChargeMinor !== "0"
      ? [{ label: t("serviceCharge"), value: money(bill.serviceChargeMinor) }]
      : []),
    ...(bill.roundingMinor !== "0"
      ? [{ label: t("rounding"), value: money(bill.roundingMinor) }]
      : []),
  ];

  return (
    <Receipt
      ariaLabel={t("receipt")}
      {...(copy ? { copyLabel: t("receiptCopy") } : {})}
      footer={t("receiptFooter")}
      lines={order.items.map((item) => {
        const detail = [
          ...(item.variantName ? [item.variantName] : []),
          ...item.modifiers.map((modifier) => modifier.optionName),
          ...(item.note ? [item.note] : []),
        ].join(" · ");
        return {
          amount: money(item.lineTotalMinor),
          ...(detail ? { detail } : {}),
          key: item.id,
          name: item.name,
          quantity: `${item.quantity}×`,
        };
      })}
      meta={[
        { label: t("saleNumber"), value: `#${sale.saleNumber}` },
        { label: t("receiptOrder"), value: `#${order.orderNumber}` },
        { label: t("time"), value: sale.completedAt ? dateTime(sale.completedAt) : "" },
        { label: t("cashier"), value: receipt.cashierName },
      ]}
      paper={paper}
      payment={[
        {
          label: t(methodKeys[payment.method]),
          value: money(payment.tenderedMinor ?? payment.amountMinor),
        },
        ...(payment.changeMinor !== null
          ? [{ emphasis: true, label: t("change"), value: money(payment.changeMinor) }]
          : []),
        ...(payment.reference ? [{ label: t("reference"), value: payment.reference }] : []),
      ]}
      {...(outlet ? { subtitle: workspace.tenant.name } : {})}
      title={outlet?.name ?? workspace.tenant.name}
      totals={[
        ...(adjustments.length > 0
          ? [{ label: t("subtotal"), value: money(bill.subtotalMinor) }, ...adjustments]
          : []),
        { emphasis: true, label: t("total"), value: money(bill.totalMinor) },
      ]}
    />
  );
}

/**
 * Shows the receipt of a paid order and prints it. A reprint from the order
 * list is marked as a copy.
 */
export function ReceiptSheet({
  copy,
  onClose,
  orderId,
  outletId,
  tenantId,
}: Readonly<{
  copy: boolean;
  onClose: () => void;
  orderId: string;
  outletId: string;
  tenantId: string;
}>) {
  const t = useTranslations("pos");
  const errorMessage = useErrorMessage();
  const receipt = useReceipt(tenantId, outletId, orderId);
  const [paper, setPaper] = useStoredPaper();

  return (
    <Sheet
      closeLabel={t("closeSheet")}
      footer={
        <Button disabled={!receipt.data} onClick={() => window.print()}>
          {t("print")}
        </Button>
      }
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={t("receipt")}
    >
      <div className="grid gap-4">
        <SegmentedControl
          items={PAPERS.map((value) => ({ label: t(`paper_${value}`), value }))}
          label={t("paper")}
          onValueChange={(value) => setPaper(value as ReceiptPaper)}
          size="sm"
          value={paper}
        />
        {receipt.data ? (
          <ReceiptContent copy={copy} paper={paper} receipt={receipt.data} />
        ) : receipt.isError ? (
          <ErrorState description={errorMessage(receipt.error)} title={t("receiptLoadFailed")} />
        ) : (
          <Skeleton variant="ticket" />
        )}
      </div>
    </Sheet>
  );
}
