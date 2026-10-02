"use client";

import { type FormEvent, useId } from "react";

import { Button } from "./button";
import { MoneyDisplay, type MoneyMinorValue } from "./money-display";
import { MoneyInput } from "./numeric-date";
import { FormField, Textarea } from "./text-field";

/**
 * Shift surfaces for the POS. They render no card of their own, so a page can
 * place them in a Panel or a Sheet without nesting. Every label comes from
 * props. Derived values (expected cash, variance) are displayed, never entered.
 */

export type ShiftSummaryLabels = {
  cashIn: string;
  cashOut: string;
  cashSales: string;
  countedCash: string;
  expectedCash: string;
  /** Heading of the non-cash section; only shown with nonCashBreakdown. */
  nonCash: string;
  openingCash: string;
  variance: string;
};

export type ShiftNonCashItem = {
  amountMinor: MoneyMinorValue;
  id: string;
  label: string;
};

export type ShiftSummaryFact = { label: string; value: string };

type ShiftSummaryCommonProps = {
  cashInMinor: MoneyMinorValue;
  cashOutMinor: MoneyMinorValue;
  /** Omit while cash sales are not available; the row is then not rendered. */
  cashSalesMinor?: MoneyMinorValue;
  className?: string;
  currency?: string;
  expectedCashMinor: MoneyMinorValue;
  /** Read-only context such as who opened the shift and when. */
  facts?: readonly ShiftSummaryFact[];
  labels: ShiftSummaryLabels;
  locale?: string;
  nonCashBreakdown?: readonly ShiftNonCashItem[];
  openingCashMinor: MoneyMinorValue;
};

export type ShiftSummaryProps =
  | (ShiftSummaryCommonProps & {
      status: "active";
    })
  | (ShiftSummaryCommonProps & {
      /** Variance is sensitive; pass true only when the viewer may see it. */
      canViewVariance?: boolean;
      countedCashMinor: MoneyMinorValue;
      status: "closed";
      varianceMinor: MoneyMinorValue;
    });

export type OpenShiftFormLabels = {
  openingCash: string;
  submit: string;
  submitting: string;
};

export type OpenShiftFormProps = {
  className?: string;
  disabled?: boolean;
  labels: OpenShiftFormLabels;
  loading?: boolean;
  locale?: string;
  onOpeningCashChange: (amountMinor: number | undefined) => void;
  onSubmit: () => void;
  openingCashMinor?: number;
};

export type CloseShiftFormLabels = {
  countedCash: string;
  /** Shown under the button while counted cash is empty. */
  countedCashRequired: string;
  expectedCash: string;
  reason: string;
  /** Shown under the button while a variance has no reason. */
  reasonRequired: string;
  submit: string;
  submitting: string;
  varianceBalanced: string;
  varianceNeedsReason: string;
};

export type CloseShiftFormProps = {
  className?: string;
  countedCashMinor?: number;
  currency?: string;
  disabled?: boolean;
  expectedCashMinor: MoneyMinorValue;
  labels: CloseShiftFormLabels;
  loading?: boolean;
  locale?: string;
  onCountedCashChange: (amountMinor: number | undefined) => void;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
  reason: string;
  /** Shortest reason the server accepts. */
  reasonMinLength?: number;
};

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function toMinorBigInt(value: MoneyMinorValue) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError("Shift amounts must be safe integer minor units.");
    }
    return BigInt(value);
  }
  if (!/^-?\d+$/.test(value)) {
    throw new TypeError("Shift amounts must be integer minor units.");
  }
  return BigInt(value);
}

function SummaryMoneyRow({
  amountMinor,
  currency,
  emphasis = false,
  label,
  locale,
  tone,
}: {
  amountMinor: MoneyMinorValue;
  currency: string;
  emphasis?: boolean;
  label: string;
  locale: string;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <div
      className={classes(
        "ui-shift-money-row",
        emphasis && "ui-shift-money-row--emphasis",
        tone && `ui-shift-money-row--${tone}`,
      )}
    >
      <dt>{label}</dt>
      <dd>
        <MoneyDisplay
          amountMinor={amountMinor}
          currency={currency}
          locale={locale}
          size={emphasis ? "lg" : "md"}
          variant={emphasis ? "summary" : "inline"}
        />
      </dd>
    </div>
  );
}

export function ShiftSummary(props: ShiftSummaryProps) {
  const {
    cashInMinor,
    cashOutMinor,
    cashSalesMinor,
    className,
    currency = "IDR",
    expectedCashMinor,
    facts = [],
    labels,
    locale = "id-ID",
    nonCashBreakdown = [],
    openingCashMinor,
    status,
  } = props;
  const isClosed = status === "closed";
  const variance =
    isClosed && props.canViewVariance ? toMinorBigInt(props.varianceMinor) : undefined;
  const row = { currency, locale };

  return (
    <div className={classes("ui-shift-summary", className)}>
      {facts.length > 0 ? (
        <dl className="ui-shift-meta">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <dl className="ui-shift-money-list">
        <SummaryMoneyRow {...row} amountMinor={openingCashMinor} label={labels.openingCash} />
        {cashSalesMinor !== undefined ? (
          <SummaryMoneyRow {...row} amountMinor={cashSalesMinor} label={labels.cashSales} />
        ) : null}
        <SummaryMoneyRow {...row} amountMinor={cashInMinor} label={labels.cashIn} />
        <SummaryMoneyRow {...row} amountMinor={cashOutMinor} label={labels.cashOut} />
        <SummaryMoneyRow
          {...row}
          amountMinor={expectedCashMinor}
          emphasis
          label={labels.expectedCash}
        />
        {isClosed ? (
          <SummaryMoneyRow
            {...row}
            amountMinor={props.countedCashMinor}
            label={labels.countedCash}
          />
        ) : null}
        {variance !== undefined ? (
          <SummaryMoneyRow
            {...row}
            amountMinor={variance}
            emphasis
            label={labels.variance}
            tone={variance === 0n ? "success" : "warning"}
          />
        ) : null}
      </dl>

      {nonCashBreakdown.length > 0 ? (
        <div className="ui-shift-summary-section">
          <h3>{labels.nonCash}</h3>
          <dl className="ui-shift-money-list">
            {nonCashBreakdown.map((item) => (
              <SummaryMoneyRow
                {...row}
                amountMinor={item.amountMinor}
                key={item.id}
                label={item.label}
              />
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}

export function OpenShiftForm({
  className,
  disabled = false,
  labels,
  loading = false,
  locale = "id-ID",
  onOpeningCashChange,
  onSubmit,
  openingCashMinor,
}: OpenShiftFormProps) {
  const openingCashId = useId();
  const submitDisabled = openingCashMinor === undefined || disabled;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submitDisabled && !loading) onSubmit();
  }

  return (
    <form className={classes("ui-shift-form", className)} onSubmit={submit}>
      <FormField htmlFor={openingCashId} label={labels.openingCash}>
        <MoneyInput
          disabled={disabled || loading}
          id={openingCashId}
          locale={locale}
          min={0}
          onValueChange={onOpeningCashChange}
          size="lg"
          {...(openingCashMinor === undefined ? {} : { value: openingCashMinor })}
        />
      </FormField>

      <Button
        disabled={submitDisabled}
        fullWidth
        loading={loading}
        loadingLabel={labels.submitting}
        size="lg"
        type="submit"
      >
        {labels.submit}
      </Button>
    </form>
  );
}

export function CloseShiftForm({
  className,
  countedCashMinor,
  currency = "IDR",
  disabled = false,
  expectedCashMinor,
  labels,
  loading = false,
  locale = "id-ID",
  onCountedCashChange,
  onReasonChange,
  onSubmit,
  reason,
  reasonMinLength = 1,
}: CloseShiftFormProps) {
  const countedCashId = useId();
  const varianceReasonId = useId();
  const expected = toMinorBigInt(expectedCashMinor);
  const counted = countedCashMinor === undefined ? undefined : BigInt(countedCashMinor);
  const variance = counted === undefined ? undefined : counted - expected;
  const needsReason = variance !== undefined && variance !== 0n;
  const reasonMissing = needsReason && reason.trim().length < reasonMinLength;
  const submitDisabled = disabled || counted === undefined || reasonMissing;
  const disabledReason =
    counted === undefined
      ? labels.countedCashRequired
      : reasonMissing
        ? labels.reasonRequired
        : undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submitDisabled && !loading) onSubmit();
  }

  return (
    <form className={classes("ui-shift-form", className)} onSubmit={submit}>
      <dl className="ui-shift-close-expected">
        <SummaryMoneyRow
          amountMinor={expected}
          currency={currency}
          emphasis
          label={labels.expectedCash}
          locale={locale}
        />
      </dl>

      <FormField htmlFor={countedCashId} label={labels.countedCash}>
        <MoneyInput
          disabled={disabled || loading}
          id={countedCashId}
          locale={locale}
          min={0}
          onValueChange={onCountedCashChange}
          size="lg"
          {...(countedCashMinor === undefined ? {} : { value: countedCashMinor })}
        />
      </FormField>

      {variance !== undefined ? (
        <dl aria-live="polite" className="ui-shift-close-variance">
          <SummaryMoneyRow
            amountMinor={variance}
            currency={currency}
            emphasis
            label={variance === 0n ? labels.varianceBalanced : labels.varianceNeedsReason}
            locale={locale}
            tone={variance === 0n ? "success" : "warning"}
          />
        </dl>
      ) : null}

      {needsReason ? (
        <FormField htmlFor={varianceReasonId} label={labels.reason}>
          <Textarea
            disabled={disabled || loading}
            id={varianceReasonId}
            maxLength={500}
            onChange={(event) => onReasonChange(event.target.value)}
            rows={3}
            value={reason}
          />
        </FormField>
      ) : null}

      <div className="ui-shift-form__actions">
        {disabledReason ? <p>{disabledReason}</p> : null}
        <Button
          disabled={submitDisabled}
          fullWidth
          loading={loading}
          loadingLabel={labels.submitting}
          size="lg"
          type="submit"
        >
          {labels.submit}
        </Button>
      </div>
    </form>
  );
}
