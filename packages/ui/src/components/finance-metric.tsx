"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CircleDollarSign,
  ReceiptText,
} from "lucide-react";

import { AppIcon } from "./app-icon";
import { MoneyDisplay, type MoneyMinorValue } from "./money-display";

export type FinanceMetricVariant =
  "revenue" | "hpp-estimate" | "gross-profit" | "expense" | "operating-profit" | "cash-variance";

export type FinanceMetricTone = "neutral" | "info" | "success" | "warning" | "danger";
export type FinanceMetricDeltaDirection = "increase" | "decrease" | "flat";

export type FinanceMetricDelta = {
  comparisonPeriodLabel: string;
  direction: FinanceMetricDeltaDirection;
  label: string;
};

export type FinanceMetricProps = {
  amountMinor?: MoneyMinorValue | null;
  ariaLabel?: string;
  className?: string;
  contextLabel?: string;
  currency?: string;
  delta?: FinanceMetricDelta;
  estimationLabel?: string;
  label?: string;
  locale?: string;
  statusLabel?: string;
  tone?: FinanceMetricTone;
  unavailableLabel?: string;
  variant: FinanceMetricVariant;
};

const financeMetricContent: Record<
  FinanceMetricVariant,
  { defaultLabel: string; icon: typeof CircleDollarSign; requiresEstimate: boolean }
> = {
  "cash-variance": { defaultLabel: "Selisih kas", icon: ReceiptText, requiresEstimate: false },
  expense: { defaultLabel: "Expense", icon: ReceiptText, requiresEstimate: false },
  "gross-profit": { defaultLabel: "Gross profit", icon: CircleDollarSign, requiresEstimate: true },
  "hpp-estimate": { defaultLabel: "HPP estimate", icon: ReceiptText, requiresEstimate: true },
  "operating-profit": {
    defaultLabel: "Operating profit",
    icon: CircleDollarSign,
    requiresEstimate: true,
  },
  revenue: { defaultLabel: "Revenue", icon: CircleDollarSign, requiresEstimate: false },
};

const financeMetricSensitiveKeyPattern =
  /(?:paymentId|paymentToken|paymentPayload|billId|invoiceId|orderId|customer|phone|telepon|email|audit|actor|timestamp|barcode|token|payload|permission|internalId|tenantId|outletId|ledgerId|journalId|receiptId|raw|methodBreakdown)/i;

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertText(value: string | undefined, fieldName: string) {
  if (value !== undefined && !value.trim()) {
    throw new TypeError(`${fieldName} harus berisi teks bila dikirim.`);
  }
}

function assertNoFinanceMetricSensitiveData(value: unknown, path = "Finance metric payload") {
  if (value === null || value === undefined || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoFinanceMetricSensitiveData(item, `${path}[${index}]`));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (financeMetricSensitiveKeyPattern.test(key)) {
      throw new TypeError(`${path} tidak boleh menerima data sensitif: ${key}.`);
    }
    if (nestedValue && typeof nestedValue === "object") {
      assertNoFinanceMetricSensitiveData(nestedValue, `${path}.${key}`);
    }
  }
}

function assertDelta(delta: FinanceMetricDelta) {
  if (!delta.label.trim()) throw new TypeError("Finance Metric delta memerlukan label.");
  if (!delta.comparisonPeriodLabel.trim()) {
    throw new TypeError("Finance Metric delta memerlukan periode pembanding.");
  }
}

function deltaIcon(direction: FinanceMetricDeltaDirection) {
  if (direction === "increase") return ArrowUpRight;
  if (direction === "decrease") return ArrowDownRight;
  return ArrowRight;
}

export function FinanceMetric(props: FinanceMetricProps) {
  assertNoFinanceMetricSensitiveData(props);

  const {
    amountMinor,
    ariaLabel,
    className,
    contextLabel,
    currency,
    delta,
    estimationLabel,
    label,
    locale,
    statusLabel,
    tone = "neutral",
    unavailableLabel = "Metrik belum tersedia",
    variant,
  } = props;

  const content = financeMetricContent[variant];
  const resolvedLabel = label?.trim() || content.defaultLabel;
  const resolvedEstimationLabel =
    estimationLabel ?? (content.requiresEstimate ? "Estimasi operasional" : undefined);

  assertText(contextLabel, "Konteks Finance Metric");
  assertText(estimationLabel, "Label estimasi Finance Metric");
  assertText(label, "Label Finance Metric");
  assertText(statusLabel, "Status Finance Metric");
  assertText(unavailableLabel, "Unavailable label Finance Metric");
  if (delta !== undefined) assertDelta(delta);

  const DeltaIcon = delta ? deltaIcon(delta.direction) : undefined;
  const moneyDisplayProps = {
    ...(amountMinor !== undefined ? { amountMinor } : {}),
    ...(currency !== undefined ? { currency } : {}),
    ...(locale !== undefined ? { locale } : {}),
  };

  return (
    <section
      aria-label={ariaLabel ?? `Finance metric ${resolvedLabel}`}
      className={classes(
        "ui-finance-metric",
        `ui-finance-metric--${variant}`,
        `ui-finance-metric--${tone}`,
        amountMinor === null || amountMinor === undefined ? "is-unavailable" : undefined,
        className,
      )}
    >
      <header className="ui-finance-metric__header">
        <span className="ui-finance-metric__icon" aria-hidden="true">
          <AppIcon icon={content.icon} size="sm" />
        </span>
        <span>
          <span>{resolvedLabel}</span>
          {contextLabel ? <small>{contextLabel.trim()}</small> : null}
        </span>
      </header>

      <MoneyDisplay
        {...moneyDisplayProps}
        className="ui-finance-metric__amount"
        unavailableLabel={unavailableLabel}
        variant="total"
      />

      <footer className="ui-finance-metric__footer">
        {delta ? (
          <span
            className={classes(
              "ui-finance-metric__delta",
              `ui-finance-metric__delta--${delta.direction}`,
            )}
          >
            {DeltaIcon ? <AppIcon icon={DeltaIcon} size="xs" /> : null}
            <span>{delta.label.trim()}</span>
            <small>{delta.comparisonPeriodLabel.trim()}</small>
          </span>
        ) : null}
        {resolvedEstimationLabel ? (
          <span className="ui-finance-metric__estimate">{resolvedEstimationLabel.trim()}</span>
        ) : null}
        {statusLabel ? (
          <span className="ui-finance-metric__status">{statusLabel.trim()}</span>
        ) : null}
      </footer>
    </section>
  );
}
