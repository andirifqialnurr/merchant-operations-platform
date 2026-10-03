"use client";

import { useTranslations } from "next-intl";

import type { RegisterSession } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { Panel } from "@merchant/ui/data-display";
import { PageHeader } from "@merchant/ui/page";
import { ShiftSummary } from "@merchant/ui/pos-shift";
import { Receipt, type ReceiptRow } from "@merchant/ui/receipt";

import { useWorkspace } from "@/features/workspace";
import { useFormat } from "@/lib/i18n";

const NON_CASH_LABELS = {
  EDC: "methodEdc",
  MERCHANT_QRIS: "methodQris",
  OTHER: "methodOther",
  TRANSFER: "methodTransfer",
} as const;

/**
 * The result of closing a shift: the cash reconciliation and non-cash totals,
 * shown once on screen and printable as a paper summary. Variance is shown
 * only to those allowed to close shifts.
 */
export function ClosedShiftView({
  canViewVariance,
  onDone,
  shift,
}: Readonly<{ canViewVariance: boolean; onDone: () => void; shift: RegisterSession }>) {
  const t = useTranslations("pos");
  const { dateTime, locale, money } = useFormat();
  const { outlet, workspace } = useWorkspace();
  const refunds = shift.cashRefundsMinor === "0" ? undefined : shift.cashRefundsMinor;
  const variance =
    canViewVariance && shift.varianceMinor !== null ? shift.varianceMinor : undefined;

  const facts = [
    { label: t("cashier"), value: shift.openedByName },
    { label: t("openedAt"), value: dateTime(shift.openedAt) },
    ...(shift.closedAt ? [{ label: t("closedAt"), value: dateTime(shift.closedAt) }] : []),
    ...(variance !== undefined && shift.varianceReason
      ? [{ label: t("varianceReason"), value: shift.varianceReason }]
      : []),
  ];

  // The same facts for paper, in the order a cashier reads them off.
  const cashRows: ReceiptRow[] = [
    { label: t("openingCash"), value: money(shift.openingCashMinor) },
    { label: t("cashSales"), value: money(shift.cashSalesMinor) },
    ...(refunds ? [{ label: t("cashRefunds"), value: `-${money(refunds)}` }] : []),
    { label: t("cashIn"), value: money(shift.cashInMinor) },
    {
      label: t("cashOut"),
      value: shift.cashOutMinor === "0" ? money("0") : `-${money(shift.cashOutMinor)}`,
    },
    { emphasis: true, label: t("expectedCash"), value: money(shift.expectedCashMinor) },
    ...(shift.countedCashMinor !== null
      ? [{ label: t("countedCash"), value: money(shift.countedCashMinor) }]
      : []),
    ...(variance !== undefined
      ? [{ emphasis: true, label: t("variance"), value: money(variance) }]
      : []),
  ];

  return (
    <>
      <PageHeader
        primaryAction={<Button onClick={onDone}>{t("done")}</Button>}
        secondaryActions={
          <Button onClick={() => window.print()} variant="secondary">
            {t("printSummary")}
          </Button>
        }
        title={t("shiftClosedTitle")}
      />
      <Panel title={t("cash")}>
        <div className="p-4">
          <ShiftSummary
            canViewVariance={canViewVariance}
            cashInMinor={shift.cashInMinor}
            cashOutMinor={shift.cashOutMinor}
            cashSalesMinor={shift.cashSalesMinor}
            countedCashMinor={shift.countedCashMinor ?? "0"}
            expectedCashMinor={shift.expectedCashMinor}
            facts={facts}
            labels={{
              cashIn: t("cashIn"),
              cashOut: t("cashOut"),
              cashRefunds: t("cashRefunds"),
              cashSales: t("cashSales"),
              countedCash: t("countedCash"),
              expectedCash: t("expectedCash"),
              nonCash: t("nonCash"),
              openingCash: t("openingCash"),
              variance: t("variance"),
            }}
            locale={locale}
            nonCashBreakdown={shift.nonCashPayments.map((payment) => ({
              amountMinor: payment.amountMinor,
              id: payment.method,
              label: t(NON_CASH_LABELS[payment.method]),
            }))}
            openingCashMinor={shift.openingCashMinor}
            status="closed"
            varianceMinor={shift.varianceMinor ?? "0"}
            {...(refunds ? { cashRefundsMinor: refunds } : {})}
          />
        </div>
      </Panel>

      {/* Paper only: the screen already shows these facts above. */}
      <div className="hidden print:block">
        <Receipt
          ariaLabel={t("shiftReport")}
          lines={[]}
          meta={facts}
          payment={shift.nonCashPayments.map((payment) => ({
            label: t(NON_CASH_LABELS[payment.method]),
            value: money(payment.amountMinor),
          }))}
          {...(outlet ? { subtitle: workspace.tenant.name } : {})}
          title={`${t("shiftReport")} · ${outlet?.name ?? workspace.tenant.name}`}
          totals={cashRows}
        />
      </div>
    </>
  );
}
