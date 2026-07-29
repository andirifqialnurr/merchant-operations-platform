"use client";

import { CircleDollarSign, ReceiptText, TrendingDown, TrendingUp } from "lucide-react";

import { AppIcon } from "./app-icon";
import { MoneyDisplay, type MoneyMinorValue } from "./money-display";

export type FinanceProfitEstimateTone = "neutral" | "info" | "success" | "warning" | "danger";
export type FinanceProfitEstimateKind =
  | "sales-revenue"
  | "hpp-estimate"
  | "gross-profit"
  | "other-income"
  | "operating-expense"
  | "operating-profit";

export type FinanceProfitEstimateProps = {
  ariaLabel?: string;
  basisLabel?: string;
  className?: string;
  currency?: string;
  grossProfitEstimateMinor?: MoneyMinorValue | null;
  hppEstimateMinor?: MoneyMinorValue | null;
  locale?: string;
  operatingExpenseMinor?: MoneyMinorValue | null;
  operatingProfitEstimateMinor?: MoneyMinorValue | null;
  otherIncomeMinor?: MoneyMinorValue | null;
  periodLabel: string;
  salesRevenueMinor?: MoneyMinorValue | null;
  sourceLabel?: string;
  statusLabel?: string;
};

type ProfitEstimateRow = {
  amountMinor: MoneyMinorValue | null;
  formulaLabel: string;
  kind: FinanceProfitEstimateKind;
  label: string;
  tone: FinanceProfitEstimateTone;
  unavailableLabel?: string;
};

const profitEstimateContent: Record<
  FinanceProfitEstimateKind,
  { icon: typeof CircleDollarSign; requiresEstimate: boolean }
> = {
  "gross-profit": { icon: CircleDollarSign, requiresEstimate: true },
  "hpp-estimate": { icon: ReceiptText, requiresEstimate: true },
  "operating-expense": { icon: TrendingDown, requiresEstimate: false },
  "operating-profit": { icon: CircleDollarSign, requiresEstimate: true },
  "other-income": { icon: TrendingUp, requiresEstimate: false },
  "sales-revenue": { icon: TrendingUp, requiresEstimate: false },
};

const financeProfitSensitiveKeyPattern =
  /(?:paymentId|paymentToken|paymentPayload|paymentAllocation|billId|invoiceId|orderId|customer|phone|telepon|email|audit|actor|timestamp|createdAt|updatedAt|barcode|token|payload|permission|internalId|tenantId|outletId|ledgerId|journalId|receiptId|shiftId|raw|ingredient|vendor|supplier|unitCost|costRow|recipeLine|stockMovement|reconciliation|refund|dispute|webhook|attachment|taxAccounting|formalReport|chart)/i;

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertText(value: string | undefined, fieldName: string) {
  if (value !== undefined && !value.trim()) {
    throw new TypeError(`${fieldName} harus berisi teks bila dikirim.`);
  }
}

function assertNoSensitiveProps(value: unknown, path = "Finance profit estimate payload") {
  if (value === null || value === undefined || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveProps(item, `${path}[${index}]`));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (/^on[A-Z]/.test(key)) {
      throw new TypeError(`${path} bersifat read-only dan tidak menerima action prop: ${key}.`);
    }
    if (financeProfitSensitiveKeyPattern.test(key)) {
      throw new TypeError(`${path} tidak boleh menerima data sensitif/out-of-scope: ${key}.`);
    }
    if (nestedValue && typeof nestedValue === "object") {
      assertNoSensitiveProps(nestedValue, `${path}.${key}`);
    }
  }
}

function hasConfiguredValue(value: MoneyMinorValue | null | undefined) {
  return value !== undefined;
}

function addRow(
  rows: ProfitEstimateRow[],
  amountMinor: MoneyMinorValue | null | undefined,
  row: Omit<ProfitEstimateRow, "amountMinor">,
) {
  if (hasConfiguredValue(amountMinor)) rows.push({ ...row, amountMinor });
}

export function FinanceProfitEstimate(props: FinanceProfitEstimateProps) {
  assertNoSensitiveProps(props);

  const {
    ariaLabel = "Ringkasan estimasi profit Finance",
    basisLabel,
    className,
    currency = "IDR",
    grossProfitEstimateMinor,
    hppEstimateMinor,
    locale = "id-ID",
    operatingExpenseMinor,
    operatingProfitEstimateMinor,
    otherIncomeMinor,
    periodLabel,
    salesRevenueMinor,
    sourceLabel,
    statusLabel,
  } = props;

  assertText(basisLabel, "Basis estimasi profit Finance");
  assertText(periodLabel, "Periode estimasi profit Finance");
  assertText(sourceLabel, "Sumber estimasi profit Finance");
  assertText(statusLabel, "Status estimasi profit Finance");

  const rows: ProfitEstimateRow[] = [];
  addRow(rows, salesRevenueMinor, {
    formulaLabel: "Dari transaksi valid",
    kind: "sales-revenue",
    label: "Sales revenue",
    tone: "success",
  });
  addRow(rows, hppEstimateMinor, {
    formulaLabel: "Estimasi recipe dan biaya bahan",
    kind: "hpp-estimate",
    label: "HPP estimate",
    tone: "warning",
    unavailableLabel: "HPP belum tersedia",
  });
  addRow(rows, grossProfitEstimateMinor, {
    formulaLabel: "Sales revenue - HPP estimate",
    kind: "gross-profit",
    label: "Gross profit",
    tone: "info",
    unavailableLabel: "Gross profit belum tersedia",
  });
  addRow(rows, otherIncomeMinor, {
    formulaLabel: "Pemasukan non-penjualan",
    kind: "other-income",
    label: "Other income",
    tone: "success",
  });
  addRow(rows, operatingExpenseMinor, {
    formulaLabel: "Expense operasional",
    kind: "operating-expense",
    label: "Operating expense",
    tone: "warning",
  });
  addRow(rows, operatingProfitEstimateMinor, {
    formulaLabel: "Gross profit + other income - operating expense",
    kind: "operating-profit",
    label: "Operating profit",
    tone: "info",
    unavailableLabel: "Operating profit belum tersedia",
  });

  return (
    <section aria-label={ariaLabel} className={classes("ui-finance-profit", className)}>
      <header className="ui-finance-profit__header">
        <div>
          <h2>Estimasi profit</h2>
          <p>{periodLabel.trim()}</p>
          {sourceLabel ? <small>{sourceLabel.trim()}</small> : null}
        </div>
        {statusLabel ? <span>{statusLabel.trim()}</span> : null}
      </header>

      {basisLabel ? <p className="ui-finance-profit__basis">{basisLabel.trim()}</p> : null}

      {rows.length > 0 ? (
        <dl className="ui-finance-profit__rows">
          {rows.map((row) => {
            const content = profitEstimateContent[row.kind];
            const Icon = content.icon;
            const unavailable = row.amountMinor === null;

            return (
              <div
                className={classes(
                  "ui-finance-profit-row",
                  `ui-finance-profit-row--${row.tone}`,
                  unavailable && "is-unavailable",
                )}
                key={row.kind}
              >
                <dt>
                  <span className="ui-finance-profit-row__icon" aria-hidden="true">
                    <AppIcon icon={Icon} size="sm" />
                  </span>
                  <span>
                    <span>{row.label}</span>
                    <small>{row.formulaLabel}</small>
                  </span>
                </dt>
                <dd>
                  <MoneyDisplay
                    amountMinor={row.amountMinor}
                    currency={currency}
                    locale={locale}
                    unavailableLabel={row.unavailableLabel ?? "Nominal belum tersedia"}
                    variant={row.kind === "operating-profit" ? "total" : "summary"}
                  />
                  {content.requiresEstimate ? (
                    <span className="ui-finance-profit-row__estimate">Estimasi operasional</span>
                  ) : null}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="ui-finance-profit__empty">Estimasi profit belum tersedia.</p>
      )}
    </section>
  );
}
