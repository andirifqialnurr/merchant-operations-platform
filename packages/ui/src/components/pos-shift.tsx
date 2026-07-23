"use client";

import { type FormEvent, useId } from "react";

import { Button } from "./button";
import { Badge } from "./feedback";
import { MoneyDisplay, type MoneyMinorValue } from "./money-display";
import { MoneyInput } from "./numeric-date";
import { FormField, Textarea } from "./text-field";

type ShiftSummaryCommonProps = {
  ariaLabel?: string;
  cashInMinor: MoneyMinorValue;
  cashOutMinor: MoneyMinorValue;
  cashSalesMinor: MoneyMinorValue;
  className?: string;
  currency?: string;
  expectedCashMinor: MoneyMinorValue;
  locale?: string;
  nonCashBreakdown?: readonly ShiftNonCashItem[];
  openedAtLabel: string;
  openedBy: string;
  openingCashMinor: MoneyMinorValue;
};

export type ShiftNonCashItem = {
  amountMinor: MoneyMinorValue;
  id: string;
  label: string;
};

export type ShiftSummaryProps =
  | (ShiftSummaryCommonProps & {
      status: "active";
    })
  | (ShiftSummaryCommonProps & {
      closedAtLabel: string;
      closedBy: string;
      canViewVariance?: boolean;
      countedCashMinor: MoneyMinorValue;
      status: "closed";
      varianceMinor: MoneyMinorValue;
    });

export type OpenShiftFormProps = {
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  onOpeningCashChange: (amountMinor: number | undefined) => void;
  onSubmit: () => void;
  openingCashMinor?: number;
};

export type CloseShiftFormProps = {
  className?: string;
  countedCashMinor?: number;
  currency?: string;
  disabled?: boolean;
  expectedCashMinor: MoneyMinorValue;
  loading?: boolean;
  locale?: string;
  onCountedCashChange: (amountMinor: number | undefined) => void;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
  reason: string;
};

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function toMinorBigInt(value: MoneyMinorValue, label: string) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(`${label} hanya menerima safe integer minor-unit.`);
    }
    return BigInt(value);
  }
  if (!/^-?\d+$/.test(value)) {
    throw new TypeError(`${label} hanya menerima integer minor-unit.`);
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
    ariaLabel = "Ringkasan shift",
    cashInMinor,
    cashOutMinor,
    cashSalesMinor,
    className,
    currency = "IDR",
    expectedCashMinor,
    locale = "id-ID",
    nonCashBreakdown = [],
    openedAtLabel,
    openedBy,
    openingCashMinor,
    status,
  } = props;
  const isClosed = status === "closed";
  const variance =
    isClosed && props.canViewVariance
      ? toMinorBigInt(props.varianceMinor, "Selisih kas")
      : undefined;

  return (
    <section aria-label={ariaLabel} className={classes("ui-shift-surface", className)}>
      <header className="ui-shift-surface__header">
        <div>
          <h2>Ringkasan shift</h2>
          <p>Rekonsiliasi kas dan pembayaran non-tunai.</p>
        </div>
        <Badge tone={isClosed ? "info" : "success"}>{isClosed ? "Ditutup" : "Aktif"}</Badge>
      </header>

      <dl className="ui-shift-meta">
        <div>
          <dt>Dibuka oleh</dt>
          <dd>{openedBy}</dd>
        </div>
        <div>
          <dt>Waktu buka</dt>
          <dd>{openedAtLabel}</dd>
        </div>
        {isClosed ? (
          <>
            <div>
              <dt>Ditutup oleh</dt>
              <dd>{props.closedBy}</dd>
            </div>
            <div>
              <dt>Waktu tutup</dt>
              <dd>{props.closedAtLabel}</dd>
            </div>
          </>
        ) : null}
      </dl>

      <div className="ui-shift-summary-section">
        <h3>Rekonsiliasi tunai</h3>
        <dl className="ui-shift-money-list">
          <SummaryMoneyRow
            amountMinor={openingCashMinor}
            currency={currency}
            label="Kas awal"
            locale={locale}
          />
          <SummaryMoneyRow
            amountMinor={cashSalesMinor}
            currency={currency}
            label="Penjualan tunai"
            locale={locale}
          />
          <SummaryMoneyRow
            amountMinor={cashInMinor}
            currency={currency}
            label="Kas masuk"
            locale={locale}
          />
          <SummaryMoneyRow
            amountMinor={cashOutMinor}
            currency={currency}
            label="Kas keluar"
            locale={locale}
          />
          <SummaryMoneyRow
            amountMinor={expectedCashMinor}
            currency={currency}
            emphasis
            label="Kas seharusnya"
            locale={locale}
          />
          {isClosed ? (
            <SummaryMoneyRow
              amountMinor={props.countedCashMinor}
              currency={currency}
              label="Kas fisik dihitung"
              locale={locale}
            />
          ) : null}
          {variance !== undefined ? (
            <SummaryMoneyRow
              amountMinor={variance}
              currency={currency}
              emphasis
              label="Selisih kas"
              locale={locale}
              tone={variance === 0n ? "success" : "warning"}
            />
          ) : null}
        </dl>
      </div>

      {nonCashBreakdown.length > 0 ? (
        <div className="ui-shift-summary-section">
          <h3>Pembayaran non-tunai</h3>
          <dl className="ui-shift-money-list">
            {nonCashBreakdown.map((item) => (
              <SummaryMoneyRow
                amountMinor={item.amountMinor}
                currency={currency}
                key={item.id}
                label={item.label}
                locale={locale}
              />
            ))}
          </dl>
        </div>
      ) : null}
    </section>
  );
}

export function OpenShiftForm({
  className,
  disabled = false,
  loading = false,
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
    <form className={classes("ui-shift-surface", "ui-shift-form", className)} onSubmit={submit}>
      <header className="ui-shift-surface__header">
        <div>
          <h2>Buka shift</h2>
          <p>Catat uang tunai yang tersedia sebelum transaksi dimulai.</p>
        </div>
      </header>

      <FormField
        helperText="Hitung uang fisik di laci kas sebelum membuka shift."
        htmlFor={openingCashId}
        label="Kas awal"
        required
      >
        <MoneyInput
          disabled={disabled || loading}
          id={openingCashId}
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
        loadingLabel="Membuka shift"
        size="lg"
        type="submit"
      >
        Buka shift
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
  loading = false,
  locale = "id-ID",
  onCountedCashChange,
  onReasonChange,
  onSubmit,
  reason,
}: CloseShiftFormProps) {
  const countedCashId = useId();
  const varianceReasonId = useId();
  const expected = toMinorBigInt(expectedCashMinor, "Kas seharusnya");
  const counted = countedCashMinor === undefined ? undefined : BigInt(countedCashMinor);
  const variance = counted === undefined ? undefined : counted - expected;
  const needsReason = variance !== undefined && variance !== 0n;
  const reasonMissing = needsReason && reason.trim().length === 0;
  const submitDisabled = disabled || counted === undefined || reasonMissing;
  const disabledReason =
    counted === undefined
      ? "Masukkan kas fisik yang dihitung."
      : reasonMissing
        ? "Alasan selisih wajib diisi."
        : undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submitDisabled && !loading) onSubmit();
  }

  return (
    <form className={classes("ui-shift-surface", "ui-shift-form", className)} onSubmit={submit}>
      <header className="ui-shift-surface__header">
        <div>
          <h2>Tutup shift</h2>
          <p>Hitung uang fisik dan selesaikan rekonsiliasi kas.</p>
        </div>
      </header>

      <dl className="ui-shift-close-expected">
        <SummaryMoneyRow
          amountMinor={expected}
          currency={currency}
          emphasis
          label="Kas seharusnya"
          locale={locale}
        />
      </dl>

      <FormField
        helperText="Masukkan hasil hitung uang fisik di laci kas."
        htmlFor={countedCashId}
        label="Kas fisik dihitung"
        required
      >
        <MoneyInput
          disabled={disabled || loading}
          id={countedCashId}
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
            label={variance === 0n ? "Selisih kas · Cocok" : "Selisih kas · Perlu alasan"}
            locale={locale}
            tone={variance === 0n ? "success" : "warning"}
          />
        </dl>
      ) : null}

      {needsReason ? (
        <FormField
          helperText="Jelaskan penyebab selisih agar dapat ditinjau oleh Owner atau Manager."
          htmlFor={varianceReasonId}
          label="Alasan selisih"
          required
        >
          <Textarea
            disabled={disabled || loading}
            id={varianceReasonId}
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
          loadingLabel="Menutup shift"
          size="lg"
          type="submit"
        >
          Tutup shift
        </Button>
      </div>
    </form>
  );
}
