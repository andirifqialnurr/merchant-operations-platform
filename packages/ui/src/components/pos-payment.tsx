"use client";

import { type InputHTMLAttributes, type ReactNode, useId } from "react";
import {
  Banknote,
  Check,
  CreditCard,
  Delete,
  Landmark,
  QrCode,
  Split,
  type LucideIcon,
} from "lucide-react";

import { AppIcon } from "./app-icon";
import { Button, IconButton } from "./button";
import { Badge } from "./feedback";
import { MoneyDisplay, type MoneyMinorValue } from "./money-display";

export type PaymentMethodKind = "cash" | "qris" | "transfer" | "edc" | "mixed";
export type PaymentMethodSize = "md" | "lg";
export type PaymentMethodAvailability = "available" | "maintenance" | "unavailable";

export type PaymentMethodTileProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "checked" | "children" | "onChange" | "size" | "type"
> & {
  availability?: PaymentMethodAvailability;
  instruction?: ReactNode;
  kind: PaymentMethodKind;
  label: string;
  onSelectedChange?: (selected: boolean) => void;
  selected?: boolean;
  size?: PaymentMethodSize;
  visual?: ReactNode;
};

export type CashKeypadProps = {
  amountReceivedMinor: MoneyMinorValue;
  ariaLabel?: string;
  className?: string;
  currency?: string;
  disabled?: boolean;
  locale?: string;
  maxDigits?: number;
  onAmountReceivedChange?: (amountMinor: string) => void;
  presetsMinor?: readonly MoneyMinorValue[];
  totalMinor: MoneyMinorValue;
};

export type ManualPaymentStatus = "unpaid" | "verifying" | "paid";

export type PaymentConfirmationPanelProps = {
  amountMinor: MoneyMinorValue;
  ariaLabel?: string;
  className?: string;
  confirmDisabled?: boolean;
  currency?: string;
  loading?: boolean;
  locale?: string;
  methodLabel: string;
  onConfirm?: () => void;
  orderTimeLabel: string;
  reference?: string;
  status: ManualPaymentStatus;
  verifierInstruction?: string;
};

const iconByPaymentMethod: Record<PaymentMethodKind, LucideIcon> = {
  cash: Banknote,
  edc: CreditCard,
  mixed: Split,
  qris: QrCode,
  transfer: Landmark,
};

const availabilityLabel: Record<PaymentMethodAvailability, string> = {
  available: "Tersedia",
  maintenance: "Sedang gangguan",
  unavailable: "Tidak tersedia",
};

const manualPaymentStatusMeta: Record<
  ManualPaymentStatus,
  { label: string; tone: "success" | "warning" }
> = {
  paid: { label: "Lunas", tone: "success" },
  unpaid: { label: "Belum dibayar", tone: "warning" },
  verifying: { label: "Menunggu verifikasi", tone: "warning" },
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
  if (!/^\d+$/.test(value)) {
    throw new TypeError(`${label} hanya menerima integer minor-unit non-negatif.`);
  }
  return BigInt(value);
}

function requireNonNegative(value: MoneyMinorValue, label: string) {
  const amount = toMinorBigInt(value, label);
  if (amount < 0n) throw new RangeError(`${label} tidak boleh negatif.`);
  return amount;
}

function roundUp(value: bigint, step: bigint) {
  return ((value + step - 1n) / step) * step;
}

export function buildCashPresets(totalMinor: MoneyMinorValue) {
  const total = requireNonNegative(totalMinor, "Total transaksi");
  return Array.from(
    new Set(
      [total, roundUp(total, 10_000n), roundUp(total, 50_000n), roundUp(total, 100_000n)].map(
        String,
      ),
    ),
  );
}

export function PaymentMethodTile({
  availability = "available",
  className,
  disabled,
  instruction,
  kind,
  label,
  onSelectedChange,
  selected = false,
  size = "md",
  visual,
  ...props
}: PaymentMethodTileProps) {
  const isDisabled = disabled || availability !== "available";
  const Icon = iconByPaymentMethod[kind];

  return (
    <label
      className={classes(
        "ui-payment-method-tile",
        `ui-payment-method-tile--${size}`,
        `ui-payment-method-tile--${availability}`,
        selected && "ui-payment-method-tile--selected",
        isDisabled && "ui-payment-method-tile--disabled",
        className,
      )}
    >
      <input
        {...props}
        checked={selected}
        disabled={isDisabled}
        onChange={(event) => onSelectedChange?.(event.target.checked)}
        type="radio"
      />
      <span className="ui-payment-method-tile__surface">
        <span aria-hidden="true" className="ui-payment-method-tile__visual">
          {visual ?? <AppIcon icon={Icon} size={size === "lg" ? "xl" : "lg"} />}
        </span>
        {selected ? (
          <span className="ui-payment-method-tile__check">
            <AppIcon icon={Check} label="Dipilih" size="sm" />
          </span>
        ) : null}
        <strong>{label}</strong>
        <span className="ui-payment-method-tile__availability">
          {availabilityLabel[availability]}
        </span>
        {instruction ? (
          <span className="ui-payment-method-tile__instruction">{instruction}</span>
        ) : null}
      </span>
    </label>
  );
}

export function CashKeypad({
  amountReceivedMinor,
  ariaLabel = "Keypad pembayaran tunai",
  className,
  currency = "IDR",
  disabled = false,
  locale = "id-ID",
  maxDigits = 12,
  onAmountReceivedChange,
  presetsMinor,
  totalMinor,
}: CashKeypadProps) {
  const instructionId = useId();
  const total = requireNonNegative(totalMinor, "Total transaksi");
  const amountReceived = requireNonNegative(amountReceivedMinor, "Nominal diterima");
  const presets = (presetsMinor ?? buildCashPresets(total)).map((preset) =>
    requireNonNegative(preset, "Preset tunai"),
  );
  const change = amountReceived > total ? amountReceived - total : 0n;
  const interactionDisabled = disabled || !onAmountReceivedChange;
  const currentDigits = amountReceived.toString();

  function emit(next: string | bigint) {
    onAmountReceivedChange?.(String(next));
  }

  function appendDigit(digit: string) {
    const next = currentDigits === "0" ? digit : `${currentDigits}${digit}`;
    if (next.length <= maxDigits) emit(BigInt(next));
  }

  function removeDigit() {
    emit(currentDigits.length <= 1 ? "0" : currentDigits.slice(0, -1));
  }

  return (
    <section
      aria-describedby={instructionId}
      aria-label={ariaLabel}
      className={classes("ui-cash-keypad", className)}
    >
      <p className="ui-cash-keypad__instruction" id={instructionId}>
        Masukkan uang tunai yang diterima.
      </p>

      <div aria-live="polite" className="ui-cash-keypad__amounts">
        <div>
          <span>Diterima</span>
          <MoneyDisplay
            amountMinor={amountReceived}
            currency={currency}
            locale={locale}
            variant="total"
          />
        </div>
        <div>
          <span>Kembalian</span>
          <MoneyDisplay
            amountMinor={change}
            currency={currency}
            locale={locale}
            variant="summary"
          />
        </div>
      </div>

      <div aria-label="Preset tunai" className="ui-cash-keypad__presets" role="group">
        {presets.map((preset, index) => (
          <Button
            className="ui-cash-keypad__preset"
            disabled={interactionDisabled}
            key={preset.toString()}
            onClick={() => emit(preset)}
            size="lg"
            type="button"
            variant="secondary"
          >
            {index === 0 ? "Uang pas " : ""}
            <MoneyDisplay amountMinor={preset} currency={currency} locale={locale} size="sm" />
          </Button>
        ))}
      </div>

      <div aria-label="Angka nominal tunai" className="ui-cash-keypad__keys" role="group">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <Button
            className="ui-cash-keypad__key"
            disabled={interactionDisabled}
            key={digit}
            onClick={() => appendDigit(digit)}
            size="lg"
            type="button"
            variant="outline"
          >
            {digit}
          </Button>
        ))}
        <Button
          aria-label="Bersihkan nominal"
          className="ui-cash-keypad__key"
          disabled={interactionDisabled}
          onClick={() => emit("0")}
          size="lg"
          type="button"
          variant="outline"
        >
          C
        </Button>
        <Button
          className="ui-cash-keypad__key"
          disabled={interactionDisabled}
          onClick={() => appendDigit("0")}
          size="lg"
          type="button"
          variant="outline"
        >
          0
        </Button>
        <IconButton
          className="ui-cash-keypad__key"
          disabled={interactionDisabled}
          icon={Delete}
          label="Hapus satu digit"
          onClick={removeDigit}
          size="lg"
          type="button"
          variant="outline"
        />
      </div>
    </section>
  );
}

export function PaymentConfirmationPanel({
  amountMinor,
  ariaLabel = "Konfirmasi pembayaran manual",
  className,
  confirmDisabled = false,
  currency = "IDR",
  loading = false,
  locale = "id-ID",
  methodLabel,
  onConfirm,
  orderTimeLabel,
  reference,
  status,
  verifierInstruction,
}: PaymentConfirmationPanelProps) {
  const statusMeta = manualPaymentStatusMeta[status];
  const canConfirm = status === "verifying" && Boolean(onConfirm);

  return (
    <section aria-label={ariaLabel} className={classes("ui-payment-confirmation", className)}>
      <header className="ui-payment-confirmation__header">
        <div>
          <h2>Konfirmasi pembayaran</h2>
          <p>Periksa data pembayaran sebelum mengubah status transaksi.</p>
        </div>
        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
      </header>

      <dl className="ui-payment-confirmation__details">
        <div>
          <dt>Metode</dt>
          <dd>{methodLabel}</dd>
        </div>
        <div>
          <dt>Nominal</dt>
          <dd>
            <MoneyDisplay
              amountMinor={amountMinor}
              currency={currency}
              locale={locale}
              variant="summary"
            />
          </dd>
        </div>
        <div>
          <dt>Waktu order</dt>
          <dd>{orderTimeLabel}</dd>
        </div>
        {reference ? (
          <div>
            <dt>Reference</dt>
            <dd>{reference}</dd>
          </div>
        ) : null}
      </dl>

      {status === "verifying" && verifierInstruction ? (
        <p className="ui-payment-confirmation__instruction">{verifierInstruction}</p>
      ) : null}

      {canConfirm ? (
        <Button
          disabled={confirmDisabled}
          fullWidth
          loading={loading}
          loadingLabel="Mengonfirmasi pembayaran"
          onClick={onConfirm}
          size="lg"
          type="button"
        >
          Konfirmasi pembayaran
        </Button>
      ) : null}
    </section>
  );
}
