"use client";

import { createContext, useContext, type HTMLAttributes, type ReactNode } from "react";

export type MoneyDisplayVariant = "inline" | "summary" | "total" | "accounting";
export type MoneyDisplaySize = "sm" | "md" | "lg" | "xl";
export type MoneyNegativeFormat = "minus" | "parentheses";
export type MoneyMinorValue = bigint | number | string;

export type MoneyDisplayProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  amountMinor?: MoneyMinorValue | null;
  currency?: string;
  locale?: string;
  negativeFormat?: MoneyNegativeFormat;
  size?: MoneyDisplaySize;
  unavailableLabel?: string;
  variant?: MoneyDisplayVariant;
};

const defaultSizeByVariant: Record<MoneyDisplayVariant, MoneyDisplaySize> = {
  accounting: "sm",
  inline: "md",
  summary: "lg",
  total: "xl",
};

/**
 * Decimal places of one minor unit. Pinned for the currencies a workspace can
 * choose, so 25000 is always Rp25.000 and 1025 is always $10.25 whatever data
 * the device ships with.
 */
const PINNED_FRACTION_DIGITS: Record<string, number> = { IDR: 0, USD: 2 };

const MoneyCurrencyContext = createContext("IDR");

/** Sets the currency that money components use when none is given: the workspace's. */
export function MoneyCurrencyProvider({
  children,
  currency,
}: {
  children: ReactNode;
  currency: string;
}) {
  return <MoneyCurrencyContext.Provider value={currency}>{children}</MoneyCurrencyContext.Provider>;
}

/** The currency of the surrounding workspace; IDR outside one. */
export function useMoneyCurrency() {
  return useContext(MoneyCurrencyContext);
}

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function parseMinorValue(value: MoneyMinorValue) {
  if (typeof value === "bigint") return value;

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError("MoneyDisplay hanya menerima number berupa safe integer minor-unit.");
    }
    return BigInt(value);
  }

  if (!/^-?\d+$/.test(value)) {
    throw new TypeError("MoneyDisplay hanya menerima string integer minor-unit.");
  }
  return BigInt(value);
}

function withoutCurrencySpacing(parts: Intl.NumberFormatPart[]) {
  return parts
    .filter((part, index) => {
      if (part.type !== "literal" || !/^\s+$/.test(part.value)) return true;
      return parts[index - 1]?.type !== "currency" && parts[index + 1]?.type !== "currency";
    })
    .map((part) => part.value)
    .join("");
}

export function formatMoneyMinor(
  value: MoneyMinorValue,
  {
    currency = "IDR",
    locale = "id-ID",
    negativeFormat = "minus",
  }: {
    currency?: string;
    locale?: string;
    negativeFormat?: MoneyNegativeFormat;
  } = {},
) {
  const amount = parseMinorValue(value);
  const normalizedCurrency = currency.trim().toUpperCase();
  const pinned = PINNED_FRACTION_DIGITS[normalizedCurrency];
  const formatter = new Intl.NumberFormat(locale, {
    currency: normalizedCurrency,
    currencyDisplay: "narrowSymbol",
    style: "currency",
    ...(pinned === undefined
      ? {}
      : { maximumFractionDigits: pinned, minimumFractionDigits: pinned }),
  });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 0;
  const scale = 10n ** BigInt(fractionDigits);
  const absoluteAmount = amount < 0n ? -amount : amount;
  const major = absoluteAmount / scale;
  const fraction = absoluteAmount % scale;
  const fractionText = fraction.toString().padStart(fractionDigits, "0");
  const formatted = withoutCurrencySpacing(
    formatter
      .formatToParts(major)
      .map((part) => (part.type === "fraction" ? { ...part, value: fractionText } : part)),
  );

  if (amount >= 0n) return formatted;
  return negativeFormat === "parentheses" ? `(${formatted})` : `-${formatted}`;
}

export function MoneyDisplay({
  amountMinor,
  className,
  currency: givenCurrency,
  locale = "id-ID",
  negativeFormat = "minus",
  size,
  unavailableLabel,
  variant = "inline",
  ...props
}: MoneyDisplayProps) {
  const workspaceCurrency = useMoneyCurrency();
  const currency = givenCurrency ?? workspaceCurrency;
  const resolvedSize = size ?? defaultSizeByVariant[variant];
  const unavailable = amountMinor === null || amountMinor === undefined;

  return (
    <span
      {...props}
      className={classes(
        "ui-money-display",
        `ui-money-display--${variant}`,
        `ui-money-display--${resolvedSize}`,
        unavailable && "ui-money-display--unavailable",
        className,
      )}
    >
      {unavailable ? (
        <>
          <span aria-hidden="true">-</span>
          <span className="ui-money-display__unavailable-label">{unavailableLabel}</span>
        </>
      ) : (
        formatMoneyMinor(amountMinor, { currency, locale, negativeFormat })
      )}
    </span>
  );
}
