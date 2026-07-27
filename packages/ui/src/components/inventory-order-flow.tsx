"use client";

import { type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { ClipboardList, RotateCcw, Trash2 } from "lucide-react";

import { AppIcon } from "./app-icon";
import { MovementTypeBadge, type InventoryMovementType } from "./inventory-stock";

export type OrderInventoryMovementType = Extract<
  InventoryMovementType,
  "consumption" | "reversal" | "waste"
>;

export type OrderInventoryImpactRow = {
  disabled?: boolean;
  itemLabel: string;
  reasonLabel?: string;
  referenceLabel?: string;
  resultingBalanceLabel?: string;
  resultingUnitLabel?: string;
  rowId: string;
  statusLabel?: ReactNode;
  type: OrderInventoryMovementType;
  quantityLabel: string;
  unitLabel: string;
};

export type OrderInventoryImpactPanelProps = {
  ariaLabel?: string;
  className?: string;
  emptyLabel?: string;
  onAcknowledge?: () => void;
  onReviewRow?: (rowId: string) => void;
  orderLabel: string;
  rows: readonly OrderInventoryImpactRow[];
  sourceLabel?: string;
  statusLabel?: ReactNode;
  summaryLabel?: string;
  tableLabel?: string;
};

export type OrderWasteUnitOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

export type OrderWasteItem = {
  availableQuantityLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
  itemLabel: string;
  quantity: string;
  rowId: string;
  unitOptions: readonly OrderWasteUnitOption[];
  unitValue: string;
};

export type OrderWasteCaptureValues = {
  items: Array<{
    quantity: string;
    rowId: string;
    unit: string;
  }>;
  reason: string;
};

export type OrderWasteCaptureFormProps = {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  items: readonly OrderWasteItem[];
  onCancel?: () => void;
  onQuantityChange?: (rowId: string, quantity: string) => void;
  onReasonChange?: (reason: string) => void;
  onSubmit?: (values: OrderWasteCaptureValues) => void;
  onUnitChange?: (rowId: string, unit: string) => void;
  orderLabel: string;
  policyLabel?: string;
  reason: string;
  submitLabel?: string;
  warningLabel?: string;
};

const impactDirectionByType: Record<OrderInventoryMovementType, "increase" | "decrease"> = {
  consumption: "decrease",
  reversal: "increase",
  waste: "decrease",
};

const impactActionLabel: Record<OrderInventoryMovementType, string> = {
  consumption: "Review consumption",
  reversal: "Review reversal",
  waste: "Review waste",
};

const orderInventoryBlockedKeyPattern =
  /(?:payment|bill|invoice|hpp|cogs|cost|price|profit|margin|supplier|customer|phone|telepon|email|audit|actor|timestamp|barcode|token|payload|event|outbox|permission|internalId|orderId|itemId|movementId|recipeId|unitId|sessionId)/i;

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertText(value: string | undefined, fieldName: string) {
  if (value !== undefined && !value.trim()) {
    throw new TypeError(`${fieldName} harus berisi teks bila dikirim.`);
  }
}

function assertNoOrderInventorySensitiveData(value: unknown, path = "Order inventory payload") {
  if (value === null || value === undefined || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoOrderInventorySensitiveData(item, `${path}[${index}]`));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (orderInventoryBlockedKeyPattern.test(key)) {
      throw new TypeError(`${path} tidak boleh menerima data sensitif: ${key}.`);
    }
    if (nestedValue && typeof nestedValue === "object") {
      assertNoOrderInventorySensitiveData(nestedValue, `${path}.${key}`);
    }
  }
}

function normalizeQuantity(value: string) {
  return value.replace(/[^0-9,.-]/g, "");
}

function formatSignedQuantity(row: OrderInventoryImpactRow) {
  const sign = impactDirectionByType[row.type] === "increase" ? "+" : "-";
  const normalizedQuantity = row.quantityLabel.trim().replace(/^[+-]/, "");
  return `${sign}${normalizedQuantity} ${row.unitLabel.trim()}`;
}

function assertImpactRow(row: OrderInventoryImpactRow) {
  if (!row.rowId.trim()) throw new TypeError("Order inventory impact row memerlukan id internal.");
  if (!row.itemLabel.trim()) throw new TypeError("Order inventory impact row memerlukan item.");
  if (!row.quantityLabel.trim())
    throw new TypeError("Order inventory impact row memerlukan quantity.");
  if (!row.unitLabel.trim()) throw new TypeError("Order inventory impact row memerlukan unit.");
  assertText(row.referenceLabel, "Referensi order inventory impact");
  assertText(row.reasonLabel, "Reason order inventory impact");
  assertText(row.resultingBalanceLabel, "Saldo order inventory impact");
  assertText(row.resultingUnitLabel, "Unit saldo order inventory impact");
  if (row.resultingUnitLabel !== undefined && row.resultingBalanceLabel === undefined) {
    throw new TypeError("Unit saldo hanya boleh dikirim bersama saldo.");
  }
}

function assertUnitOption(option: OrderWasteUnitOption) {
  if (!option.value.trim()) throw new TypeError("Unit waste order memerlukan value.");
  if (!option.label.trim()) throw new TypeError("Unit waste order memerlukan label.");
}

function assertWasteItem(item: OrderWasteItem) {
  if (!item.rowId.trim()) throw new TypeError("Order waste item memerlukan id internal.");
  if (!item.itemLabel.trim()) throw new TypeError("Order waste item memerlukan item.");
  if (!item.unitValue.trim()) throw new TypeError("Order waste item memerlukan unit aktif.");
  if (item.unitOptions.length === 0)
    throw new TypeError("Order waste item memerlukan pilihan unit.");
  item.unitOptions.forEach(assertUnitOption);
  assertText(item.availableQuantityLabel, "Available quantity order waste");
  assertText(item.disabledReason, "Alasan order waste item nonaktif");
}

function assertUniqueRowIds(rows: readonly { rowId: string }[], fieldName: string) {
  const ids = new Set<string>();
  for (const row of rows) {
    const rowId = row.rowId.trim();
    if (ids.has(rowId)) throw new TypeError(`${fieldName} row id harus unik.`);
    ids.add(rowId);
  }
}

function buildWasteValues(
  items: readonly OrderWasteItem[],
  reason: string,
): OrderWasteCaptureValues {
  return {
    items: items.map((item) => ({
      quantity: item.quantity.trim(),
      rowId: item.rowId.trim(),
      unit: item.unitValue.trim(),
    })),
    reason: reason.trim(),
  };
}

export function OrderInventoryImpactPanel(props: OrderInventoryImpactPanelProps) {
  assertNoOrderInventorySensitiveData(props);

  const {
    ariaLabel = "Dampak stok order",
    className,
    emptyLabel = "Belum ada stock movement dari order.",
    onAcknowledge,
    onReviewRow,
    orderLabel,
    rows,
    sourceLabel,
    statusLabel,
    summaryLabel,
    tableLabel,
  } = props;

  if (!orderLabel.trim()) throw new TypeError("Order inventory impact memerlukan label order.");
  assertText(emptyLabel, "Empty state order inventory impact");
  assertText(sourceLabel, "Source order inventory impact");
  assertText(summaryLabel, "Summary order inventory impact");
  assertText(tableLabel, "Table order inventory impact");
  rows.forEach(assertImpactRow);
  assertUniqueRowIds(rows, "Order inventory impact");

  const resolvedSummary = summaryLabel ?? `${rows.length} movement stok`;

  return (
    <section aria-label={ariaLabel} className={classes("ui-order-inventory-impact", className)}>
      <header className="ui-order-inventory-impact__header">
        <span className="ui-order-inventory-impact__header-icon" aria-hidden="true">
          <AppIcon icon={ClipboardList} size="md" />
        </span>
        <span>
          <span>Order inventory</span>
          <strong>{orderLabel.trim()}</strong>
        </span>
        {statusLabel ? (
          <span className="ui-order-inventory-impact__status">{statusLabel}</span>
        ) : null}
      </header>

      <dl className="ui-order-inventory-impact__context">
        <div>
          <dt>Movement</dt>
          <dd>{resolvedSummary.trim()}</dd>
        </div>
        {sourceLabel ? (
          <div>
            <dt>Source</dt>
            <dd>{sourceLabel.trim()}</dd>
          </div>
        ) : null}
        {tableLabel ? (
          <div>
            <dt>Meja</dt>
            <dd>{tableLabel.trim()}</dd>
          </div>
        ) : null}
      </dl>

      <div className="ui-order-inventory-impact__rows">
        {rows.length === 0 ? (
          <p className="ui-order-inventory-impact__empty">{emptyLabel.trim()}</p>
        ) : (
          rows.map((row) => {
            const resultingBalance =
              row.resultingBalanceLabel === undefined
                ? undefined
                : `${row.resultingBalanceLabel.trim()}${
                    row.resultingUnitLabel ? ` ${row.resultingUnitLabel.trim()}` : ""
                  }`;

            return (
              <article
                aria-label={`${impactActionLabel[row.type]} ${row.itemLabel.trim()}`}
                className={classes(
                  "ui-order-inventory-impact__row",
                  `ui-order-inventory-impact__row--${row.type}`,
                  row.disabled && "is-disabled",
                )}
                key={row.rowId}
              >
                <span className="ui-order-inventory-impact__item">
                  <strong>{row.itemLabel.trim()}</strong>
                  {row.referenceLabel ? <span>{row.referenceLabel.trim()}</span> : null}
                  {row.reasonLabel ? <span>{row.reasonLabel.trim()}</span> : null}
                </span>
                <MovementTypeBadge type={row.type} />
                <strong className="ui-order-inventory-impact__delta">
                  {formatSignedQuantity(row)}
                </strong>
                <span className="ui-order-inventory-impact__meta">
                  {resultingBalance ? <span>Saldo {resultingBalance}</span> : null}
                  {row.statusLabel ? <span>{row.statusLabel}</span> : null}
                </span>
                <button
                  disabled={row.disabled || !onReviewRow}
                  onClick={() => onReviewRow?.(row.rowId)}
                  type="button"
                >
                  {impactActionLabel[row.type]}
                </button>
              </article>
            );
          })
        )}
      </div>

      <footer className="ui-order-inventory-impact__footer">
        <p>Consumption, reversal, dan waste mengikuti workflow order dan recipe aktif.</p>
        <button disabled={!onAcknowledge} onClick={() => onAcknowledge?.()} type="button">
          Tandai ditinjau
        </button>
      </footer>
    </section>
  );
}

export function OrderWasteCaptureForm(props: OrderWasteCaptureFormProps) {
  assertNoOrderInventorySensitiveData(props);

  const {
    ariaLabel = "Form waste order",
    className,
    disabled = false,
    items,
    onCancel,
    onQuantityChange,
    onReasonChange,
    onSubmit,
    onUnitChange,
    orderLabel,
    policyLabel,
    reason,
    submitLabel = "Catat waste order",
    warningLabel,
  } = props;

  if (!orderLabel.trim()) throw new TypeError("Order waste form memerlukan label order.");
  assertText(policyLabel, "Policy order waste");
  assertText(warningLabel, "Warning order waste");
  assertText(submitLabel, "Submit label order waste");
  items.forEach(assertWasteItem);
  assertUniqueRowIds(items, "Order waste");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit?.(buildWasteValues(items, reason));
  }

  function handleQuantityChange(rowId: string, event: ChangeEvent<HTMLInputElement>) {
    onQuantityChange?.(rowId, normalizeQuantity(event.currentTarget.value));
  }

  return (
    <form
      aria-label={ariaLabel}
      className={classes("ui-order-waste-form", className)}
      onSubmit={handleSubmit}
    >
      <header className="ui-order-waste-form__header">
        <span className="ui-order-waste-form__header-icon" aria-hidden="true">
          <AppIcon icon={Trash2} size="md" />
        </span>
        <span>
          <span>Waste order</span>
          <strong>{orderLabel.trim()}</strong>
        </span>
      </header>

      <div className="ui-order-waste-form__items">
        {items.map((item) => {
          const rowDisabled = disabled || item.disabled;
          const itemLabel = item.itemLabel.trim();

          return (
            <fieldset className="ui-order-waste-form__item" disabled={rowDisabled} key={item.rowId}>
              <legend>{itemLabel}</legend>
              {item.availableQuantityLabel ? (
                <p>Available {item.availableQuantityLabel.trim()}</p>
              ) : null}
              {item.disabledReason ? <p>{item.disabledReason.trim()}</p> : null}
              <label>
                <span>Quantity</span>
                <input
                  aria-label={`Waste quantity ${itemLabel}`}
                  inputMode="decimal"
                  onChange={(event) => handleQuantityChange(item.rowId, event)}
                  value={item.quantity}
                />
              </label>
              <label>
                <span>Unit</span>
                <select
                  aria-label={`Waste unit ${itemLabel}`}
                  onChange={(event) => onUnitChange?.(item.rowId, event.currentTarget.value)}
                  value={item.unitValue}
                >
                  {item.unitOptions.map((unit) => (
                    <option disabled={unit.disabled} key={unit.value} value={unit.value}>
                      {unit.label}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          );
        })}
      </div>

      <label className="ui-order-waste-form__reason">
        <span>Reason</span>
        <textarea
          disabled={disabled}
          onChange={(event) => onReasonChange?.(event.currentTarget.value)}
          placeholder="Alasan waste dari order"
          value={reason}
        />
      </label>

      {warningLabel || policyLabel ? (
        <div className="ui-order-waste-form__messages" aria-live="polite">
          {warningLabel ? (
            <p className="ui-order-waste-form__warning">{warningLabel.trim()}</p>
          ) : null}
          {policyLabel ? <p>{policyLabel.trim()}</p> : null}
        </div>
      ) : null}

      <footer className="ui-order-waste-form__footer">
        <button disabled={disabled || !onCancel} onClick={() => onCancel?.()} type="button">
          Batalkan
        </button>
        <button disabled={disabled || !onSubmit || items.length === 0} type="submit">
          <AppIcon icon={RotateCcw} size="sm" />
          {submitLabel.trim()}
        </button>
      </footer>
    </form>
  );
}
