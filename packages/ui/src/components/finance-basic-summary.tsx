"use client";

import { Landmark, ReceiptText, TrendingDown, TrendingUp, WalletCards } from "lucide-react";

import { AppIcon } from "./app-icon";
import { MoneyDisplay, type MoneyMinorValue } from "./money-display";

export type FinanceBasicFlowKind = "sales" | "expense" | "other-income" | "cashbook";
export type FinanceBasicTone = "neutral" | "info" | "success" | "warning" | "danger";

export type FinanceBasicEntry = {
  amountMinor?: MoneyMinorValue | null;
  contextLabel?: string;
  countLabel?: string;
  id: string;
  kind: FinanceBasicFlowKind;
  label?: string;
  statusLabel?: string;
  tone?: FinanceBasicTone;
};

export type FinanceCashbookSnapshot = {
  cashInMinor?: MoneyMinorValue | null;
  cashOutMinor?: MoneyMinorValue | null;
  closingBalanceMinor?: MoneyMinorValue | null;
  label?: string;
  openingBalanceMinor?: MoneyMinorValue | null;
};

export type FinanceBasicSummaryProps = {
  ariaLabel?: string;
  cashbook?: FinanceCashbookSnapshot;
  className?: string;
  currency?: string;
  entries: readonly FinanceBasicEntry[];
  locale?: string;
  periodLabel: string;
  sourceLabel?: string;
  statusLabel?: string;
};

type FinanceBasicContent = {
  defaultLabel: string;
  icon: typeof TrendingUp;
  tone: FinanceBasicTone;
};

const financeBasicContent: Record<FinanceBasicFlowKind, FinanceBasicContent> = {
  cashbook: { defaultLabel: "Cashbook", icon: WalletCards, tone: "info" },
  expense: { defaultLabel: "Expense", icon: TrendingDown, tone: "warning" },
  "other-income": { defaultLabel: "Other income", icon: Landmark, tone: "success" },
  sales: { defaultLabel: "Sales", icon: TrendingUp, tone: "success" },
};

const financeBasicSensitiveKeyPattern =
  /(?:paymentId|paymentToken|paymentPayload|paymentBreakdown|methodBreakdown|billId|invoiceId|orderId|customer|phone|telepon|email|audit|actor|timestamp|barcode|token|payload|permission|internalId|tenantId|outletId|ledgerId|journalId|receiptId|shiftId|raw|hpp|cogs|grossProfit|operatingProfit|margin|reconciliation|attachment)/i;

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertText(value: string | undefined, fieldName: string) {
  if (value !== undefined && !value.trim()) {
    throw new TypeError(`${fieldName} harus berisi teks bila dikirim.`);
  }
}

function assertNoReadOnlyActionProps(value: unknown, path = "Finance Basic payload") {
  if (value === null || value === undefined || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoReadOnlyActionProps(item, `${path}[${index}]`));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (/^on[A-Z]/.test(key)) {
      throw new TypeError(`${path} bersifat read-only dan tidak menerima action prop: ${key}.`);
    }
    if (financeBasicSensitiveKeyPattern.test(key)) {
      throw new TypeError(`${path} tidak boleh menerima data sensitif/out-of-scope: ${key}.`);
    }
    if (nestedValue && typeof nestedValue === "object") {
      assertNoReadOnlyActionProps(nestedValue, `${path}.${key}`);
    }
  }
}

function assertUniqueFlowKinds(entries: readonly FinanceBasicEntry[]) {
  const seen = new Set<FinanceBasicFlowKind>();

  for (const entry of entries) {
    if (seen.has(entry.kind)) {
      throw new TypeError(`Finance Basic hanya menerima satu lokasi utama untuk ${entry.kind}.`);
    }
    seen.add(entry.kind);
  }
}

function hasMoneyValue(value: MoneyMinorValue | null | undefined) {
  return value !== null && value !== undefined;
}

function isVisibleEntry(entry: FinanceBasicEntry): entry is FinanceBasicEntry & {
  amountMinor: MoneyMinorValue;
} {
  return hasMoneyValue(entry.amountMinor);
}

function FinanceBasicMoneyRow({
  amountMinor,
  currency,
  label,
  locale,
  tone,
}: {
  amountMinor: MoneyMinorValue;
  currency: string;
  label: string;
  locale: string;
  tone?: FinanceBasicTone;
}) {
  return (
    <div className={classes("ui-finance-basic-row", tone && `ui-finance-basic-row--${tone}`)}>
      <dt>{label}</dt>
      <dd>
        <MoneyDisplay
          amountMinor={amountMinor}
          currency={currency}
          locale={locale}
          variant="accounting"
        />
      </dd>
    </div>
  );
}

export function FinanceBasicSummary(props: FinanceBasicSummaryProps) {
  assertNoReadOnlyActionProps(props);
  assertUniqueFlowKinds(props.entries);

  const {
    ariaLabel = "Ringkasan Finance Basic",
    cashbook,
    className,
    currency = "IDR",
    entries,
    locale = "id-ID",
    periodLabel,
    sourceLabel,
    statusLabel,
  } = props;

  assertText(periodLabel, "Periode Finance Basic");
  assertText(sourceLabel, "Sumber Finance Basic");
  assertText(statusLabel, "Status Finance Basic");
  assertText(cashbook?.label, "Label cashbook Finance Basic");
  entries.forEach((entry) => {
    assertText(entry.contextLabel, "Konteks entry Finance Basic");
    assertText(entry.countLabel, "Jumlah entry Finance Basic");
    assertText(entry.label, "Label entry Finance Basic");
    assertText(entry.statusLabel, "Status entry Finance Basic");
  });

  const visibleEntries = entries.filter(isVisibleEntry);
  const cashbookRows: Array<{
    amountMinor: MoneyMinorValue;
    label: string;
    tone: FinanceBasicTone;
  }> = [];

  if (hasMoneyValue(cashbook?.openingBalanceMinor)) {
    cashbookRows.push({
      amountMinor: cashbook.openingBalanceMinor,
      label: "Saldo awal",
      tone: "neutral",
    });
  }
  if (hasMoneyValue(cashbook?.cashInMinor)) {
    cashbookRows.push({ amountMinor: cashbook.cashInMinor, label: "Kas masuk", tone: "success" });
  }
  if (hasMoneyValue(cashbook?.cashOutMinor)) {
    cashbookRows.push({
      amountMinor: cashbook.cashOutMinor,
      label: "Kas keluar",
      tone: "warning",
    });
  }
  if (hasMoneyValue(cashbook?.closingBalanceMinor)) {
    cashbookRows.push({
      amountMinor: cashbook.closingBalanceMinor,
      label: "Saldo akhir",
      tone: "info",
    });
  }

  return (
    <section aria-label={ariaLabel} className={classes("ui-finance-basic-summary", className)}>
      <header className="ui-finance-basic-summary__header">
        <div>
          <h2>Finance Basic</h2>
          <p>{periodLabel.trim()}</p>
          {sourceLabel ? <small>{sourceLabel.trim()}</small> : null}
        </div>
        {statusLabel ? <span>{statusLabel.trim()}</span> : null}
      </header>

      {visibleEntries.length > 0 ? (
        <ul className="ui-finance-basic-flow-list">
          {visibleEntries.map((entry) => {
            const content = financeBasicContent[entry.kind];
            const Icon = content.icon;
            const resolvedTone = entry.tone ?? content.tone;
            const moneyDisplayProps = {
              amountMinor: entry.amountMinor,
              currency,
              locale,
            };

            return (
              <li
                className={classes(
                  "ui-finance-basic-flow",
                  `ui-finance-basic-flow--${resolvedTone}`,
                )}
                key={entry.id}
              >
                <span className="ui-finance-basic-flow__icon" aria-hidden="true">
                  <AppIcon icon={Icon} size="sm" />
                </span>
                <div className="ui-finance-basic-flow__body">
                  <h3>{entry.label?.trim() || content.defaultLabel}</h3>
                  {entry.contextLabel ? <p>{entry.contextLabel.trim()}</p> : null}
                </div>
                <div className="ui-finance-basic-flow__value">
                  <MoneyDisplay {...moneyDisplayProps} variant="summary" />
                  <div>
                    {entry.countLabel ? <span>{entry.countLabel.trim()}</span> : null}
                    {entry.statusLabel ? <small>{entry.statusLabel.trim()}</small> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="ui-finance-basic-empty">Ringkasan finansial belum tersedia.</p>
      )}

      {cashbookRows.length > 0 ? (
        <section
          className="ui-finance-basic-cashbook"
          aria-label={cashbook?.label ?? "Detail cashbook"}
        >
          <header>
            <span className="ui-finance-basic-flow__icon" aria-hidden="true">
              <AppIcon icon={ReceiptText} size="sm" />
            </span>
            <h3>{cashbook?.label?.trim() || "Mutasi kas"}</h3>
          </header>
          <dl>
            {cashbookRows.map((row) => (
              <FinanceBasicMoneyRow
                amountMinor={row.amountMinor}
                currency={currency}
                key={row.label}
                label={row.label}
                locale={locale}
                tone={row.tone}
              />
            ))}
          </dl>
        </section>
      ) : null}
    </section>
  );
}
