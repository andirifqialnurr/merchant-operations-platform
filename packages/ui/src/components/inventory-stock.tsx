"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  ClipboardCheck,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  RotateCcw,
  Scale,
  Trash2,
} from "lucide-react";

import { AppIcon } from "./app-icon";

export type InventoryStockStatus = "normal" | "low" | "out" | "negative" | "unavailable";
export type InventoryStockIndicatorSize = "sm" | "md" | "lg";
export type InventoryStockIndicatorVariant = "quantity" | "status" | "delta";
export type InventoryMovementType =
  "receipt" | "consumption" | "reversal" | "waste" | "adjustment" | "transfer-in" | "transfer-out";
export type InventoryMovementDirection = "increase" | "decrease";

export type StockIndicatorDelta = {
  direction: InventoryMovementDirection;
  quantityLabel: string;
  unitLabel: string;
};

export type StockIndicatorProps = {
  ariaLabel?: string;
  className?: string;
  delta?: StockIndicatorDelta;
  quantityLabel?: string;
  size?: InventoryStockIndicatorSize;
  status: InventoryStockStatus;
  unitLabel?: string;
  variant?: InventoryStockIndicatorVariant;
};

export type MovementTypeBadgeProps = {
  className?: string;
  type: InventoryMovementType;
};

export type StockMovementRowProps = {
  actorLabel?: string;
  className?: string;
  delta: StockIndicatorDelta;
  itemLabel: string;
  referenceLabel?: string;
  resultingBalanceLabel?: string;
  resultingUnitLabel?: string;
  timeLabel: string;
  type: InventoryMovementType;
};

const stockStatusContent: Record<
  InventoryStockStatus,
  { icon: typeof PackageCheck; label: string }
> = {
  low: { icon: AlertTriangle, label: "Stok rendah" },
  negative: { icon: AlertTriangle, label: "Stok negatif" },
  normal: { icon: PackageCheck, label: "Stok tersedia" },
  out: { icon: PackageMinus, label: "Stok habis" },
  unavailable: { icon: Scale, label: "Stok belum tersedia" },
};

const movementTypeContent: Record<
  InventoryMovementType,
  { icon: typeof PackageCheck; label: string }
> = {
  adjustment: { icon: ClipboardCheck, label: "Adjustment" },
  consumption: { icon: PackageMinus, label: "Consumption" },
  receipt: { icon: PackagePlus, label: "Receipt" },
  reversal: { icon: RotateCcw, label: "Reversal" },
  "transfer-in": { icon: ArrowRightLeft, label: "Transfer masuk" },
  "transfer-out": { icon: ArrowRightLeft, label: "Transfer keluar" },
  waste: { icon: Trash2, label: "Waste" },
};

const inventoryStockSensitiveDataKeyPattern =
  /(?:payment|hpp|cogs|cost|price|profit|margin|supplier|customer|phone|telepon|email|audit|actorId|timestamp|barcode|token|payload|permission|internalId|itemId|unitId|movementId|outletId|balanceId)/i;

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertText(value: string | undefined, fieldName: string) {
  if (value !== undefined && !value.trim()) {
    throw new TypeError(`${fieldName} harus berisi teks bila dikirim.`);
  }
}

function assertNoInventoryStockSensitiveData(value: unknown, path = "Inventory stock payload") {
  if (value === null || value === undefined || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoInventoryStockSensitiveData(item, `${path}[${index}]`));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (inventoryStockSensitiveDataKeyPattern.test(key)) {
      throw new TypeError(`${path} tidak boleh menerima data sensitif: ${key}.`);
    }
    if (nestedValue && typeof nestedValue === "object") {
      assertNoInventoryStockSensitiveData(nestedValue, `${path}.${key}`);
    }
  }
}

function assertDelta(delta: StockIndicatorDelta, fieldName: string) {
  if (!delta.quantityLabel.trim()) {
    throw new TypeError(`${fieldName} memerlukan quantity delta.`);
  }
  if (!delta.unitLabel.trim()) {
    throw new TypeError(`${fieldName} memerlukan unit delta.`);
  }
}

function formatSignedQuantity(delta: StockIndicatorDelta) {
  const quantity = delta.quantityLabel.trim();
  const sign = delta.direction === "increase" ? "+" : "-";
  const normalizedQuantity = quantity.replace(/^[+-]/, "");
  return `${sign}${normalizedQuantity} ${delta.unitLabel.trim()}`;
}

export function StockIndicator(props: StockIndicatorProps) {
  assertNoInventoryStockSensitiveData(props);

  const {
    ariaLabel,
    className,
    delta,
    quantityLabel,
    size = "md",
    status,
    unitLabel,
    variant = "quantity",
  } = props;

  assertText(quantityLabel, "Quantity stok");
  assertText(unitLabel, "Unit stok");
  if (delta !== undefined) assertDelta(delta, "Indikator delta stok");
  if (variant === "quantity" && status !== "unavailable" && quantityLabel === undefined) {
    throw new TypeError("Stock Indicator quantity memerlukan quantity label.");
  }
  if (variant === "quantity" && status !== "unavailable" && unitLabel === undefined) {
    throw new TypeError("Stock Indicator quantity memerlukan unit label.");
  }
  if (variant === "delta" && delta === undefined) {
    throw new TypeError("Stock Indicator delta memerlukan delta.");
  }
  if (
    status === "negative" &&
    quantityLabel !== undefined &&
    !quantityLabel.trim().startsWith("-")
  ) {
    throw new TypeError("Stok negatif harus menampilkan tanda minus pada quantity.");
  }

  const statusContent = stockStatusContent[status];
  const quantityText =
    quantityLabel === undefined
      ? undefined
      : `${quantityLabel.trim()}${unitLabel ? ` ${unitLabel.trim()}` : ""}`;
  const deltaText = delta ? formatSignedQuantity(delta) : undefined;
  const deltaDirection = delta?.direction;
  const accessibleLabel =
    ariaLabel ?? `Indikator stok ${deltaText ?? quantityText ?? statusContent.label}`;

  return (
    <section
      aria-label={accessibleLabel}
      className={classes(
        "ui-stock-indicator",
        `ui-stock-indicator--${status}`,
        `ui-stock-indicator--${size}`,
        `ui-stock-indicator--${variant}`,
        deltaDirection && `ui-stock-indicator--delta-${deltaDirection}`,
        className,
      )}
    >
      <span className="ui-stock-indicator__icon" aria-hidden="true">
        <AppIcon icon={statusContent.icon} size={size === "lg" ? "md" : "sm"} />
      </span>
      <span className="ui-stock-indicator__content">
        {variant !== "status" && quantityText ? (
          <strong className="ui-stock-indicator__quantity">{quantityText}</strong>
        ) : null}
        {variant === "delta" && deltaText ? (
          <strong className="ui-stock-indicator__delta">
            <AppIcon icon={deltaDirection === "increase" ? ArrowUp : ArrowDown} size="xs" />
            {deltaText}
          </strong>
        ) : null}
        <span className="ui-stock-indicator__status">{statusContent.label}</span>
      </span>
    </section>
  );
}

export function MovementTypeBadge({ className, type }: MovementTypeBadgeProps) {
  const content = movementTypeContent[type];

  return (
    <span
      className={classes("ui-movement-type-badge", `ui-movement-type-badge--${type}`, className)}
    >
      <AppIcon icon={content.icon} size="xs" />
      {content.label}
    </span>
  );
}

export function StockMovementRow(props: StockMovementRowProps) {
  assertNoInventoryStockSensitiveData(props);

  const {
    actorLabel,
    className,
    delta,
    itemLabel,
    referenceLabel,
    resultingBalanceLabel,
    resultingUnitLabel,
    timeLabel,
    type,
  } = props;

  if (!timeLabel.trim()) throw new TypeError("Stock Movement Row memerlukan waktu.");
  if (!itemLabel.trim()) throw new TypeError("Stock Movement Row memerlukan nama item.");
  assertDelta(delta, "Stock Movement Row");
  assertText(referenceLabel, "Referensi stock movement");
  assertText(actorLabel, "Actor stock movement");
  assertText(resultingBalanceLabel, "Resulting balance stock movement");
  assertText(resultingUnitLabel, "Resulting unit stock movement");
  if (resultingUnitLabel !== undefined && resultingBalanceLabel === undefined) {
    throw new TypeError("Resulting unit hanya boleh dikirim bersama resulting balance.");
  }

  const signedDelta = formatSignedQuantity(delta);
  const resultingBalance =
    resultingBalanceLabel === undefined
      ? undefined
      : `${resultingBalanceLabel.trim()}${resultingUnitLabel ? ` ${resultingUnitLabel.trim()}` : ""}`;

  return (
    <article
      aria-label={`Stock movement ${itemLabel.trim()}`}
      className={classes(
        "ui-stock-movement-row",
        `ui-stock-movement-row--${type}`,
        `ui-stock-movement-row--${delta.direction}`,
        className,
      )}
    >
      <time className="ui-stock-movement-row__time">{timeLabel.trim()}</time>
      <span className="ui-stock-movement-row__item">
        <strong>{itemLabel.trim()}</strong>
        {referenceLabel ? <span>{referenceLabel.trim()}</span> : null}
      </span>
      <MovementTypeBadge type={type} />
      <strong className="ui-stock-movement-row__delta">{signedDelta}</strong>
      <span className="ui-stock-movement-row__meta">
        {actorLabel ? <span>{actorLabel.trim()}</span> : null}
        {resultingBalance ? <span>Saldo {resultingBalance}</span> : null}
      </span>
    </article>
  );
}
