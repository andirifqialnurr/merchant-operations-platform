"use client";

import { type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ClipboardCheck,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { AppIcon } from "./app-icon";

export type InventoryStockOperationType =
  "stock-in" | "stock-out" | "adjustment" | "stocktake" | "waste" | "transfer";

export type InventoryOperationUnitOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

export type InventoryStockOperationValues = {
  countedQuantity?: string;
  destinationOutletLabel?: string;
  operationType: InventoryStockOperationType;
  quantity?: string;
  reason: string;
  reference?: string;
  unit: string;
};

export type StockOperationFormProps = {
  className?: string;
  countedQuantity?: string;
  currentStockLabel: string;
  currentUnitLabel: string;
  destinationOutletLabel?: string;
  differenceLabel?: string;
  disabled?: boolean;
  itemLabel: string;
  negativeWarningLabel?: string;
  onCancel?: () => void;
  onCountedQuantityChange?: (value: string) => void;
  onDestinationOutletLabelChange?: (value: string) => void;
  onOperationTypeChange?: (type: InventoryStockOperationType) => void;
  onQuantityChange?: (value: string) => void;
  onReasonChange?: (value: string) => void;
  onReferenceChange?: (value: string) => void;
  onSubmit?: (values: InventoryStockOperationValues) => void;
  onUnitChange?: (value: string) => void;
  operationType: InventoryStockOperationType;
  policyLabel?: string;
  quantity?: string;
  reason?: string;
  reference?: string;
  resultingStockLabel?: string;
  submitLabel?: string;
  unitOptions: readonly InventoryOperationUnitOption[];
  unitValue: string;
};

export type StocktakeCountRowProps = {
  className?: string;
  countedQuantity?: string;
  differenceLabel?: string;
  disabled?: boolean;
  itemLabel: string;
  onCountedQuantityChange?: (value: string) => void;
  reasonLabel?: string;
  statusLabel?: ReactNode;
  systemQuantityLabel: string;
  unitLabel: string;
};

const operationContent: Record<
  InventoryStockOperationType,
  { icon: typeof ClipboardCheck; label: string }
> = {
  adjustment: { icon: ClipboardCheck, label: "Adjustment" },
  stocktake: { icon: RefreshCw, label: "Opname" },
  "stock-in": { icon: ArrowDownToLine, label: "Stock in" },
  "stock-out": { icon: ArrowUpFromLine, label: "Stock out" },
  transfer: { icon: ArrowLeftRight, label: "Transfer" },
  waste: { icon: Trash2, label: "Waste" },
};

const operationSensitiveDataKeyPattern =
  /(?:payment|hpp|cogs|cost|price|profit|margin|supplier|customer|phone|telepon|email|audit|actor|timestamp|barcode|token|payload|permission|internalId|itemId|unitId|outletId|stocktakeId|movementId|approval)/i;

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertText(value: string | undefined, fieldName: string) {
  if (value !== undefined && !value.trim()) {
    throw new TypeError(`${fieldName} harus berisi teks bila dikirim.`);
  }
}

function assertNoOperationSensitiveData(value: unknown, path = "Inventory operation payload") {
  if (value === null || value === undefined || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoOperationSensitiveData(item, `${path}[${index}]`));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (operationSensitiveDataKeyPattern.test(key)) {
      throw new TypeError(`${path} tidak boleh menerima data sensitif: ${key}.`);
    }
    if (nestedValue && typeof nestedValue === "object") {
      assertNoOperationSensitiveData(nestedValue, `${path}.${key}`);
    }
  }
}

function assertUnitOption(option: InventoryOperationUnitOption) {
  if (!option.value.trim()) throw new TypeError("Unit operasi stok memerlukan value.");
  if (!option.label.trim()) throw new TypeError("Unit operasi stok memerlukan label.");
}

function normalizeQuantity(value: string) {
  return value.replace(/[^0-9,.-]/g, "");
}

function buildOperationValues({
  countedQuantity,
  destinationOutletLabel,
  operationType,
  quantity,
  reason,
  reference,
  unitValue,
}: Pick<
  StockOperationFormProps,
  | "countedQuantity"
  | "destinationOutletLabel"
  | "operationType"
  | "quantity"
  | "reason"
  | "reference"
  | "unitValue"
>): InventoryStockOperationValues {
  const values: InventoryStockOperationValues = {
    operationType,
    reason: reason?.trim() ?? "",
    unit: unitValue.trim(),
  };

  if (operationType === "stocktake") {
    values.countedQuantity = countedQuantity?.trim() ?? "";
  } else {
    values.quantity = quantity?.trim() ?? "";
  }
  if (reference?.trim()) values.reference = reference.trim();
  if (operationType === "transfer") {
    values.destinationOutletLabel = destinationOutletLabel?.trim() ?? "";
  }

  return values;
}

export function StockOperationForm(props: StockOperationFormProps) {
  assertNoOperationSensitiveData(props);

  const {
    className,
    countedQuantity = "",
    currentStockLabel,
    currentUnitLabel,
    destinationOutletLabel = "",
    differenceLabel,
    disabled = false,
    itemLabel,
    negativeWarningLabel,
    onCancel,
    onCountedQuantityChange,
    onDestinationOutletLabelChange,
    onOperationTypeChange,
    onQuantityChange,
    onReasonChange,
    onReferenceChange,
    onSubmit,
    onUnitChange,
    operationType,
    policyLabel,
    quantity = "",
    reason = "",
    reference = "",
    resultingStockLabel,
    submitLabel = "Simpan operasi stok",
    unitOptions,
    unitValue,
  } = props;

  if (!itemLabel.trim()) throw new TypeError("Stock Operation Form memerlukan nama item.");
  if (!currentStockLabel.trim())
    throw new TypeError("Stock Operation Form memerlukan stok saat ini.");
  if (!currentUnitLabel.trim())
    throw new TypeError("Stock Operation Form memerlukan unit stok saat ini.");
  if (!unitValue.trim()) throw new TypeError("Stock Operation Form memerlukan unit aktif.");
  if (unitOptions.length === 0)
    throw new TypeError("Stock Operation Form memerlukan pilihan unit.");
  unitOptions.forEach(assertUnitOption);
  assertText(resultingStockLabel, "Preview hasil stok");
  assertText(differenceLabel, "Selisih opname");
  assertText(negativeWarningLabel, "Warning stok negatif");
  assertText(policyLabel, "Policy operasi stok");

  const operation = operationContent[operationType];
  const isStocktake = operationType === "stocktake";
  const isTransfer = operationType === "transfer";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit?.(
      buildOperationValues({
        countedQuantity,
        destinationOutletLabel,
        operationType,
        quantity,
        reason,
        reference,
        unitValue,
      }),
    );
  }

  function handleQuantityChange(event: ChangeEvent<HTMLInputElement>) {
    onQuantityChange?.(normalizeQuantity(event.currentTarget.value));
  }

  function handleCountedQuantityChange(event: ChangeEvent<HTMLInputElement>) {
    onCountedQuantityChange?.(normalizeQuantity(event.currentTarget.value));
  }

  return (
    <form
      aria-label="Form operasi stok"
      className={classes("ui-stock-operation-form", className)}
      onSubmit={handleSubmit}
    >
      <header className="ui-stock-operation-form__header">
        <span className="ui-stock-operation-form__header-icon" aria-hidden="true">
          <AppIcon icon={operation.icon} size="md" />
        </span>
        <span>
          <span>{operation.label}</span>
          <strong>{itemLabel.trim()}</strong>
        </span>
      </header>

      <dl className="ui-stock-operation-form__context">
        <div>
          <dt>Stok saat ini</dt>
          <dd>
            {currentStockLabel.trim()} {currentUnitLabel.trim()}
          </dd>
        </div>
        {resultingStockLabel ? (
          <div>
            <dt>Preview hasil</dt>
            <dd>{resultingStockLabel.trim()}</dd>
          </div>
        ) : null}
        {differenceLabel ? (
          <div>
            <dt>Selisih</dt>
            <dd>{differenceLabel.trim()}</dd>
          </div>
        ) : null}
      </dl>

      <fieldset className="ui-stock-operation-form__types" disabled={disabled}>
        <legend>Tipe operasi</legend>
        {Object.entries(operationContent).map(([type, content]) => (
          <button
            aria-pressed={operationType === type}
            className={classes(
              "ui-stock-operation-form__type",
              operationType === type && "is-active",
            )}
            key={type}
            onClick={() => onOperationTypeChange?.(type as InventoryStockOperationType)}
            type="button"
          >
            <AppIcon icon={content.icon} size="xs" />
            {content.label}
          </button>
        ))}
      </fieldset>

      <div className="ui-stock-operation-form__grid">
        {isStocktake ? (
          <label className="ui-stock-operation-form__field">
            <span>Counted quantity</span>
            <input
              disabled={disabled}
              inputMode="decimal"
              onChange={handleCountedQuantityChange}
              placeholder="0"
              value={countedQuantity}
            />
          </label>
        ) : (
          <label className="ui-stock-operation-form__field">
            <span>Quantity</span>
            <input
              disabled={disabled}
              inputMode="decimal"
              onChange={handleQuantityChange}
              placeholder="0"
              value={quantity}
            />
          </label>
        )}

        <label className="ui-stock-operation-form__field">
          <span>Unit</span>
          <select
            disabled={disabled}
            onChange={(event) => onUnitChange?.(event.currentTarget.value)}
            value={unitValue}
          >
            {unitOptions.map((unit) => (
              <option disabled={unit.disabled} key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </label>

        {isTransfer ? (
          <label className="ui-stock-operation-form__field">
            <span>Outlet tujuan</span>
            <input
              disabled={disabled}
              onChange={(event) => onDestinationOutletLabelChange?.(event.currentTarget.value)}
              placeholder="Nama outlet"
              value={destinationOutletLabel}
            />
          </label>
        ) : null}

        <label className="ui-stock-operation-form__field">
          <span>Referensi</span>
          <input
            disabled={disabled}
            onChange={(event) => onReferenceChange?.(event.currentTarget.value)}
            placeholder="Opsional"
            value={reference}
          />
        </label>

        <label className="ui-stock-operation-form__field ui-stock-operation-form__field--wide">
          <span>Reason</span>
          <textarea
            disabled={disabled}
            onChange={(event) => onReasonChange?.(event.currentTarget.value)}
            placeholder="Alasan wajib dari workflow"
            value={reason}
          />
        </label>
      </div>

      {negativeWarningLabel || policyLabel ? (
        <div className="ui-stock-operation-form__messages" aria-live="polite">
          {negativeWarningLabel ? (
            <p className="ui-stock-operation-form__warning">{negativeWarningLabel.trim()}</p>
          ) : null}
          {policyLabel ? <p>{policyLabel.trim()}</p> : null}
        </div>
      ) : null}

      <footer className="ui-stock-operation-form__actions">
        <button disabled={disabled || !onSubmit} type="submit">
          {submitLabel}
        </button>
        <button disabled={disabled || !onCancel} onClick={() => onCancel?.()} type="button">
          Batalkan
        </button>
      </footer>
    </form>
  );
}

export function StocktakeCountRow(props: StocktakeCountRowProps) {
  assertNoOperationSensitiveData(props);

  const {
    className,
    countedQuantity = "",
    differenceLabel,
    disabled = false,
    itemLabel,
    onCountedQuantityChange,
    reasonLabel,
    statusLabel,
    systemQuantityLabel,
    unitLabel,
  } = props;
  if (!itemLabel.trim()) throw new TypeError("Stocktake row memerlukan nama item.");
  if (!systemQuantityLabel.trim()) throw new TypeError("Stocktake row memerlukan quantity sistem.");
  if (!unitLabel.trim()) throw new TypeError("Stocktake row memerlukan unit.");
  assertText(differenceLabel, "Selisih stocktake");
  assertText(reasonLabel, "Reason stocktake");

  return (
    <article
      aria-label={`Opname ${itemLabel.trim()}`}
      className={classes("ui-stocktake-count-row", className)}
    >
      <span className="ui-stocktake-count-row__item">
        <strong>{itemLabel.trim()}</strong>
        {reasonLabel ? <span>{reasonLabel.trim()}</span> : null}
      </span>
      <span className="ui-stocktake-count-row__system">
        <span>System</span>
        <strong>
          {systemQuantityLabel.trim()} {unitLabel.trim()}
        </strong>
      </span>
      <label className="ui-stocktake-count-row__counted">
        <span>Counted</span>
        <input
          disabled={disabled}
          inputMode="decimal"
          onChange={(event) =>
            onCountedQuantityChange?.(normalizeQuantity(event.currentTarget.value))
          }
          value={countedQuantity}
        />
      </label>
      <span className="ui-stocktake-count-row__difference">
        <span>Selisih</span>
        <strong>{differenceLabel?.trim() ?? "-"}</strong>
      </span>
      {statusLabel ? <span className="ui-stocktake-count-row__status">{statusLabel}</span> : null}
    </article>
  );
}
