"use client";

import { BadgeCheck, CircleAlert, Clock3, Scale, WalletCards } from "lucide-react";

import { AppIcon } from "./app-icon";
import { Badge, type FeedbackTone } from "./feedback";
import { MoneyDisplay, type MoneyMinorValue } from "./money-display";

export type FinanceReconciliationStatus = "matched" | "pending" | "difference" | "blocked";
export type FinanceReconciliationTone = "neutral" | "info" | "success" | "warning" | "danger";

export type FinanceReconciliationItem = {
  actorLabel?: string;
  differenceMinor?: MoneyMinorValue | null;
  expectedMinor?: MoneyMinorValue | null;
  id: string;
  label: string;
  notesLabel?: string;
  recordedMinor?: MoneyMinorValue | null;
  statementLabel?: string;
  status: FinanceReconciliationStatus;
  statusLabel?: string;
  tone?: FinanceReconciliationTone;
};

export type FinanceShiftNonCashItem = {
  amountMinor: MoneyMinorValue;
  id: string;
  label: string;
};

type FinanceShiftSnapshotCommon = {
  cashInMinor?: MoneyMinorValue | null;
  cashOutMinor?: MoneyMinorValue | null;
  cashSalesMinor?: MoneyMinorValue | null;
  expectedCashMinor?: MoneyMinorValue | null;
  nonCashBreakdown?: readonly FinanceShiftNonCashItem[];
  openedAtLabel: string;
  openedByLabel: string;
  openingCashMinor?: MoneyMinorValue | null;
};

export type FinanceShiftSnapshot =
  | (FinanceShiftSnapshotCommon & {
      status: "active";
    })
  | (FinanceShiftSnapshotCommon & {
      closedAtLabel: string;
      closedByLabel: string;
      countedCashMinor?: MoneyMinorValue | null;
      status: "closed";
      varianceMinor?: MoneyMinorValue | null;
      varianceVisible?: boolean;
    });

export type FinanceReconciliationSummaryProps = {
  ariaLabel?: string;
  className?: string;
  currency?: string;
  items: readonly FinanceReconciliationItem[];
  locale?: string;
  periodLabel: string;
  shift?: FinanceShiftSnapshot;
  sourceLabel?: string;
  statusLabel?: string;
};

const statusContent: Record<
  FinanceReconciliationStatus,
  { defaultLabel: string; icon: typeof BadgeCheck; tone: FinanceReconciliationTone }
> = {
  blocked: { defaultLabel: "Perlu tindakan", icon: CircleAlert, tone: "danger" },
  difference: { defaultLabel: "Ada selisih", icon: CircleAlert, tone: "warning" },
  matched: { defaultLabel: "Cocok", icon: BadgeCheck, tone: "success" },
  pending: { defaultLabel: "Menunggu cek", icon: Clock3, tone: "info" },
};

const financeReconciliationSensitiveKeyPattern =
  /(?:paymentId|paymentToken|paymentPayload|paymentAllocation|billId|invoiceId|orderId|customer|phone|telepon|email|audit|actorId|userId|timestamp|createdAt|updatedAt|barcode|token|payload|permission|internalId|tenantId|outletId|ledgerId|journalId|receiptId|shiftId|raw|hpp|cogs|grossProfit|operatingProfit|margin|refund|dispute|webhook|attachment|approval)/i;

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertText(value: string | undefined, fieldName: string) {
  if (value !== undefined && !value.trim()) {
    throw new TypeError(`${fieldName} harus berisi teks bila dikirim.`);
  }
}

function assertNoSensitiveProps(value: unknown, path = "Finance reconciliation payload") {
  if (value === null || value === undefined || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveProps(item, `${path}[${index}]`));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (/^on[A-Z]/.test(key)) {
      throw new TypeError(`${path} bersifat read-only dan tidak menerima action prop: ${key}.`);
    }
    if (financeReconciliationSensitiveKeyPattern.test(key)) {
      throw new TypeError(`${path} tidak boleh menerima data sensitif/out-of-scope: ${key}.`);
    }
    if (nestedValue && typeof nestedValue === "object") {
      assertNoSensitiveProps(nestedValue, `${path}.${key}`);
    }
  }
}

function assertUniqueIds(items: readonly { id: string }[], fieldName: string) {
  const seen = new Set<string>();

  for (const item of items) {
    if (!item.id.trim()) throw new TypeError(`${fieldName} memerlukan id tersembunyi.`);
    if (seen.has(item.id)) throw new TypeError(`${fieldName} tidak boleh memiliki id duplikat.`);
    seen.add(item.id);
  }
}

function hasMoneyValue(value: MoneyMinorValue | null | undefined) {
  return value !== null && value !== undefined;
}

function toBadgeTone(tone: FinanceReconciliationTone): FeedbackTone {
  return tone === "neutral" ? "info" : tone;
}

function resolveDifferenceTone(
  status: FinanceReconciliationStatus,
  differenceMinor: MoneyMinorValue | null | undefined,
  tone: FinanceReconciliationTone | undefined,
) {
  if (tone) return tone;
  if (status === "blocked") return "danger";
  if (status === "difference") return "warning";
  if (!hasMoneyValue(differenceMinor)) return statusContent[status].tone;
  return String(differenceMinor) === "0" ? "success" : "warning";
}

function ReconciliationMoneyRow({
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
  tone?: FinanceReconciliationTone;
}) {
  return (
    <div className={classes("ui-finance-reconciliation-row", tone && `ui-finance-row--${tone}`)}>
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

function ShiftMoneyRows({
  currency,
  locale,
  shift,
}: {
  currency: string;
  locale: string;
  shift: FinanceShiftSnapshot;
}) {
  const closed = shift.status === "closed";
  const varianceMinor = closed ? shift.varianceMinor : undefined;
  const showVariance = closed && shift.varianceVisible && hasMoneyValue(varianceMinor);

  return (
    <>
      {hasMoneyValue(shift.openingCashMinor) ? (
        <ReconciliationMoneyRow
          amountMinor={shift.openingCashMinor}
          currency={currency}
          label="Kas awal"
          locale={locale}
        />
      ) : null}
      {hasMoneyValue(shift.cashSalesMinor) ? (
        <ReconciliationMoneyRow
          amountMinor={shift.cashSalesMinor}
          currency={currency}
          label="Penjualan tunai"
          locale={locale}
          tone="success"
        />
      ) : null}
      {hasMoneyValue(shift.cashInMinor) ? (
        <ReconciliationMoneyRow
          amountMinor={shift.cashInMinor}
          currency={currency}
          label="Kas masuk"
          locale={locale}
          tone="success"
        />
      ) : null}
      {hasMoneyValue(shift.cashOutMinor) ? (
        <ReconciliationMoneyRow
          amountMinor={shift.cashOutMinor}
          currency={currency}
          label="Kas keluar"
          locale={locale}
          tone="warning"
        />
      ) : null}
      {hasMoneyValue(shift.expectedCashMinor) ? (
        <ReconciliationMoneyRow
          amountMinor={shift.expectedCashMinor}
          currency={currency}
          label="Kas seharusnya"
          locale={locale}
          tone="info"
        />
      ) : null}
      {closed && hasMoneyValue(shift.countedCashMinor) ? (
        <ReconciliationMoneyRow
          amountMinor={shift.countedCashMinor}
          currency={currency}
          label="Kas fisik dihitung"
          locale={locale}
        />
      ) : null}
      {showVariance ? (
        <ReconciliationMoneyRow
          amountMinor={varianceMinor}
          currency={currency}
          label="Selisih kas"
          locale={locale}
          tone={String(varianceMinor) === "0" ? "success" : "warning"}
        />
      ) : null}
      {shift.nonCashBreakdown?.map((item) => (
        <ReconciliationMoneyRow
          amountMinor={item.amountMinor}
          currency={currency}
          key={item.id}
          label={item.label}
          locale={locale}
        />
      ))}
    </>
  );
}

export function FinanceReconciliationSummary(props: FinanceReconciliationSummaryProps) {
  assertNoSensitiveProps(props);
  assertUniqueIds(props.items, "Reconciliation item");
  if (props.shift?.nonCashBreakdown) {
    assertUniqueIds(props.shift.nonCashBreakdown, "Shift non-cash item");
  }

  const {
    ariaLabel = "Ringkasan rekonsiliasi Finance",
    className,
    currency = "IDR",
    items,
    locale = "id-ID",
    periodLabel,
    shift,
    sourceLabel,
    statusLabel,
  } = props;

  assertText(periodLabel, "Periode rekonsiliasi Finance");
  assertText(sourceLabel, "Sumber rekonsiliasi Finance");
  assertText(statusLabel, "Status rekonsiliasi Finance");
  items.forEach((item) => {
    assertText(item.actorLabel, "Actor rekonsiliasi Finance");
    assertText(item.label, "Label rekonsiliasi Finance");
    assertText(item.notesLabel, "Catatan rekonsiliasi Finance");
    assertText(item.statementLabel, "Statement rekonsiliasi Finance");
    assertText(item.statusLabel, "Status rekonsiliasi Finance");
  });
  if (shift) {
    assertText(shift.openedAtLabel, "Waktu buka shift Finance");
    assertText(shift.openedByLabel, "Pembuka shift Finance");
    if (shift.status === "closed") {
      assertText(shift.closedAtLabel, "Waktu tutup shift Finance");
      assertText(shift.closedByLabel, "Penutup shift Finance");
    }
    shift.nonCashBreakdown?.forEach((item) =>
      assertText(item.label, "Label breakdown non-tunai Finance"),
    );
  }

  return (
    <section aria-label={ariaLabel} className={classes("ui-finance-reconciliation", className)}>
      <header className="ui-finance-reconciliation__header">
        <div>
          <h2>Reconciliation</h2>
          <p>{periodLabel.trim()}</p>
          {sourceLabel ? <small>{sourceLabel.trim()}</small> : null}
        </div>
        {statusLabel ? <span>{statusLabel.trim()}</span> : null}
      </header>

      {items.length > 0 ? (
        <ul className="ui-finance-reconciliation-list">
          {items.map((item) => {
            const status = statusContent[item.status];
            const StatusIcon = status.icon;
            const tone = resolveDifferenceTone(item.status, item.differenceMinor, item.tone);

            return (
              <li
                className={classes("ui-finance-reconciliation-item", `ui-finance-row--${tone}`)}
                key={item.id}
              >
                <header>
                  <span className="ui-finance-reconciliation__icon" aria-hidden="true">
                    <AppIcon icon={Scale} size="sm" />
                  </span>
                  <div>
                    <h3>{item.label.trim()}</h3>
                    {item.statementLabel ? <p>{item.statementLabel.trim()}</p> : null}
                  </div>
                  <Badge tone={toBadgeTone(status.tone)}>
                    <AppIcon icon={StatusIcon} size="xs" />
                    {item.statusLabel?.trim() || status.defaultLabel}
                  </Badge>
                </header>

                <dl className="ui-finance-reconciliation-money">
                  {hasMoneyValue(item.expectedMinor) ? (
                    <ReconciliationMoneyRow
                      amountMinor={item.expectedMinor}
                      currency={currency}
                      label="Expected"
                      locale={locale}
                    />
                  ) : null}
                  {hasMoneyValue(item.recordedMinor) ? (
                    <ReconciliationMoneyRow
                      amountMinor={item.recordedMinor}
                      currency={currency}
                      label="Recorded"
                      locale={locale}
                    />
                  ) : null}
                  {hasMoneyValue(item.differenceMinor) ? (
                    <ReconciliationMoneyRow
                      amountMinor={item.differenceMinor}
                      currency={currency}
                      label="Difference"
                      locale={locale}
                      tone={tone}
                    />
                  ) : null}
                </dl>

                {(item.actorLabel || item.notesLabel) && (
                  <dl className="ui-finance-reconciliation-meta">
                    {item.actorLabel ? (
                      <div>
                        <dt>Dicek oleh</dt>
                        <dd>{item.actorLabel.trim()}</dd>
                      </div>
                    ) : null}
                    {item.notesLabel ? (
                      <div>
                        <dt>Catatan</dt>
                        <dd>{item.notesLabel.trim()}</dd>
                      </div>
                    ) : null}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="ui-finance-reconciliation-empty">Ringkasan rekonsiliasi belum tersedia.</p>
      )}

      {shift ? (
        <section className="ui-finance-shift-snapshot" aria-label="Shift Summary">
          <header>
            <span className="ui-finance-reconciliation__icon" aria-hidden="true">
              <AppIcon icon={WalletCards} size="sm" />
            </span>
            <div>
              <h3>Shift Summary</h3>
              <p>{shift.status === "closed" ? "Ditutup" : "Aktif"}</p>
            </div>
          </header>

          <dl className="ui-finance-reconciliation-meta ui-finance-shift-meta">
            <div>
              <dt>Dibuka oleh</dt>
              <dd>{shift.openedByLabel.trim()}</dd>
            </div>
            <div>
              <dt>Waktu buka</dt>
              <dd>{shift.openedAtLabel.trim()}</dd>
            </div>
            {shift.status === "closed" ? (
              <>
                <div>
                  <dt>Ditutup oleh</dt>
                  <dd>{shift.closedByLabel.trim()}</dd>
                </div>
                <div>
                  <dt>Waktu tutup</dt>
                  <dd>{shift.closedAtLabel.trim()}</dd>
                </div>
              </>
            ) : null}
          </dl>

          <dl className="ui-finance-reconciliation-money">
            <ShiftMoneyRows currency={currency} locale={locale} shift={shift} />
          </dl>
        </section>
      ) : null}
    </section>
  );
}
