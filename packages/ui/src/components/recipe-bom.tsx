"use client";

import { type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { BookOpenCheck, PackageSearch, Plus, Trash2 } from "lucide-react";

import { AppIcon } from "./app-icon";

export type RecipeBomUnitOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

export type RecipeBomIngredientRow = {
  disabled?: boolean;
  disabledReason?: string;
  estimatedCostLabel?: string;
  ingredientLabel: string;
  ingredientSku?: string;
  noteLabel?: string;
  quantity: string;
  rowId: string;
  statusLabel?: ReactNode;
  unitOptions: readonly RecipeBomUnitOption[];
  unitValue: string;
};

export type RecipeBomIngredientValue = {
  quantity: string;
  rowId: string;
  unit: string;
};

export type RecipeBomEditorValues = {
  rows: RecipeBomIngredientValue[];
};

export type RecipeBomEditorProps = {
  addIngredientLabel?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  emptyLabel?: string;
  ingredientRows: readonly RecipeBomIngredientRow[];
  onAddIngredient?: () => void;
  onCancel?: () => void;
  onPickIngredient?: (rowId: string) => void;
  onQuantityChange?: (rowId: string, quantity: string) => void;
  onRemoveIngredient?: (rowId: string) => void;
  onSave?: (values: RecipeBomEditorValues) => void;
  onUnitChange?: (rowId: string, unit: string) => void;
  productLabel: string;
  statusLabel?: ReactNode;
  submitLabel?: string;
  summaryLabel?: string;
  totalEstimatedCostLabel?: string;
};

const recipeBomBlockedKeyPattern =
  /(?:payment|hpp|cogs|price|profit|margin|supplier|customer|phone|telepon|email|audit|actor|timestamp|barcode|token|payload|permission|internalId|productId|ingredientId|unitId|recipeId|bomId|stockMovement|orderId)/i;
const recipeBomCostKeyPattern = /cost/i;
const allowedEstimatedCostKeys = new Set(["estimatedCostLabel", "totalEstimatedCostLabel"]);

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertText(value: string | undefined, fieldName: string) {
  if (value !== undefined && !value.trim()) {
    throw new TypeError(`${fieldName} harus berisi teks bila dikirim.`);
  }
}

function assertNoRecipeBomSensitiveData(value: unknown, path = "Recipe/BOM payload") {
  if (value === null || value === undefined || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoRecipeBomSensitiveData(item, `${path}[${index}]`));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    const blockedCostKey = recipeBomCostKeyPattern.test(key) && !allowedEstimatedCostKeys.has(key);
    if (recipeBomBlockedKeyPattern.test(key) || blockedCostKey) {
      throw new TypeError(`${path} tidak boleh menerima data sensitif: ${key}.`);
    }
    if (nestedValue && typeof nestedValue === "object") {
      assertNoRecipeBomSensitiveData(nestedValue, `${path}.${key}`);
    }
  }
}

function normalizeQuantity(value: string) {
  return value.replace(/[^0-9,.-]/g, "");
}

function assertUnitOption(option: RecipeBomUnitOption) {
  if (!option.value.trim()) throw new TypeError("Unit Recipe/BOM memerlukan value.");
  if (!option.label.trim()) throw new TypeError("Unit Recipe/BOM memerlukan label.");
}

function assertIngredientRow(row: RecipeBomIngredientRow) {
  if (!row.rowId.trim()) throw new TypeError("Recipe/BOM row memerlukan id internal.");
  if (!row.ingredientLabel.trim()) throw new TypeError("Recipe/BOM row memerlukan ingredient.");
  if (!row.unitValue.trim()) throw new TypeError("Recipe/BOM row memerlukan unit aktif.");
  if (row.unitOptions.length === 0) throw new TypeError("Recipe/BOM row memerlukan pilihan unit.");
  row.unitOptions.forEach(assertUnitOption);
  assertText(row.ingredientSku, "SKU ingredient Recipe/BOM");
  assertText(row.estimatedCostLabel, "Estimasi biaya ingredient");
  assertText(row.noteLabel, "Catatan ingredient Recipe/BOM");
  assertText(row.disabledReason, "Alasan ingredient Recipe/BOM nonaktif");
}

function buildRecipeBomValues(rows: readonly RecipeBomIngredientRow[]): RecipeBomEditorValues {
  return {
    rows: rows.map((row) => ({
      quantity: row.quantity.trim(),
      rowId: row.rowId.trim(),
      unit: row.unitValue.trim(),
    })),
  };
}

export function RecipeBomEditor(props: RecipeBomEditorProps) {
  assertNoRecipeBomSensitiveData(props);

  const {
    addIngredientLabel = "Tambah ingredient",
    ariaLabel = "Recipe/BOM Editor",
    className,
    disabled = false,
    emptyLabel = "Belum ada ingredient pada recipe.",
    ingredientRows,
    onAddIngredient,
    onCancel,
    onPickIngredient,
    onQuantityChange,
    onRemoveIngredient,
    onSave,
    onUnitChange,
    productLabel,
    statusLabel,
    submitLabel = "Simpan recipe",
    summaryLabel,
    totalEstimatedCostLabel,
  } = props;

  if (!productLabel.trim()) throw new TypeError("Recipe/BOM Editor memerlukan nama produk.");
  assertText(addIngredientLabel, "Label tambah ingredient");
  assertText(emptyLabel, "Empty state Recipe/BOM");
  assertText(submitLabel, "Label simpan Recipe/BOM");
  assertText(summaryLabel, "Summary Recipe/BOM");
  assertText(totalEstimatedCostLabel, "Total estimasi biaya Recipe/BOM");
  ingredientRows.forEach(assertIngredientRow);

  const rowIds = new Set<string>();
  for (const row of ingredientRows) {
    const rowId = row.rowId.trim();
    if (rowIds.has(rowId)) throw new TypeError("Recipe/BOM row id harus unik.");
    rowIds.add(rowId);
  }

  const resolvedSummary =
    summaryLabel ??
    `${ingredientRows.length} ingredient${ingredientRows.length === 0 ? "" : " aktif"}`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave?.(buildRecipeBomValues(ingredientRows));
  }

  function handleQuantityChange(rowId: string, event: ChangeEvent<HTMLInputElement>) {
    onQuantityChange?.(rowId, normalizeQuantity(event.currentTarget.value));
  }

  return (
    <form
      aria-label={ariaLabel}
      className={classes("ui-recipe-bom-editor", className)}
      onSubmit={handleSubmit}
    >
      <header className="ui-recipe-bom-editor__header">
        <span className="ui-recipe-bom-editor__header-icon" aria-hidden="true">
          <AppIcon icon={BookOpenCheck} size="md" />
        </span>
        <span>
          <span>Recipe/BOM</span>
          <strong>{productLabel.trim()}</strong>
        </span>
        {statusLabel ? <span className="ui-recipe-bom-editor__status">{statusLabel}</span> : null}
      </header>

      <dl className="ui-recipe-bom-editor__summary">
        <div>
          <dt>Ingredient</dt>
          <dd>{resolvedSummary.trim()}</dd>
        </div>
        {totalEstimatedCostLabel ? (
          <div>
            <dt>Total estimasi</dt>
            <dd>{totalEstimatedCostLabel.trim()}</dd>
          </div>
        ) : null}
      </dl>

      <div className="ui-recipe-bom-editor__table" role="table" aria-label="Ingredient recipe">
        <div className="ui-recipe-bom-editor__row ui-recipe-bom-editor__row--head" role="row">
          <span role="columnheader">Ingredient</span>
          <span role="columnheader">Quantity</span>
          <span role="columnheader">Unit</span>
          <span role="columnheader">Estimasi</span>
          <span role="columnheader">Action</span>
        </div>

        {ingredientRows.length === 0 ? (
          <p className="ui-recipe-bom-editor__empty">{emptyLabel.trim()}</p>
        ) : (
          ingredientRows.map((row) => {
            const rowDisabled = disabled || row.disabled;
            const rowId = row.rowId.trim();
            const ingredientLabel = row.ingredientLabel.trim();

            return (
              <div
                className={classes("ui-recipe-bom-editor__row", rowDisabled && "is-disabled")}
                key={rowId}
                role="row"
              >
                <span
                  className="ui-recipe-bom-editor__ingredient"
                  data-label="Ingredient"
                  role="cell"
                >
                  <button
                    aria-label={`Pilih ingredient ${ingredientLabel}`}
                    disabled={rowDisabled || !onPickIngredient}
                    onClick={() => onPickIngredient?.(rowId)}
                    type="button"
                  >
                    <AppIcon icon={PackageSearch} size="sm" />
                    <span>
                      <strong>{ingredientLabel}</strong>
                      <span>
                        {row.ingredientSku ? <span>SKU {row.ingredientSku.trim()}</span> : null}
                        {row.noteLabel ? <span>{row.noteLabel.trim()}</span> : null}
                        {row.disabledReason ? <span>{row.disabledReason.trim()}</span> : null}
                      </span>
                    </span>
                  </button>
                </span>

                <span data-label="Quantity" role="cell">
                  <input
                    aria-label={`Quantity ${ingredientLabel}`}
                    disabled={rowDisabled}
                    inputMode="decimal"
                    onChange={(event) => handleQuantityChange(rowId, event)}
                    value={row.quantity}
                  />
                </span>

                <span data-label="Unit" role="cell">
                  <select
                    aria-label={`Unit ${ingredientLabel}`}
                    disabled={rowDisabled}
                    onChange={(event) => onUnitChange?.(rowId, event.currentTarget.value)}
                    value={row.unitValue}
                  >
                    {row.unitOptions.map((unit) => (
                      <option disabled={unit.disabled} key={unit.value} value={unit.value}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                </span>

                <span className="ui-recipe-bom-editor__estimate" data-label="Estimasi" role="cell">
                  <strong>{row.estimatedCostLabel?.trim() ?? "-"}</strong>
                  {row.statusLabel ? <span>{row.statusLabel}</span> : null}
                </span>

                <span className="ui-recipe-bom-editor__actions" data-label="Action" role="cell">
                  <button
                    aria-label={`Hapus ingredient ${ingredientLabel}`}
                    disabled={rowDisabled || !onRemoveIngredient}
                    onClick={() => onRemoveIngredient?.(rowId)}
                    title={`Hapus ${ingredientLabel}`}
                    type="button"
                  >
                    <AppIcon icon={Trash2} size="sm" />
                  </button>
                </span>
              </div>
            );
          })
        )}
      </div>

      <footer className="ui-recipe-bom-editor__footer">
        <button
          disabled={disabled || !onAddIngredient}
          onClick={() => onAddIngredient?.()}
          type="button"
        >
          <AppIcon icon={Plus} size="sm" />
          {addIngredientLabel.trim()}
        </button>
        <span>
          <button disabled={disabled || !onCancel} onClick={() => onCancel?.()} type="button">
            Batalkan
          </button>
          <button disabled={disabled || !onSave || ingredientRows.length === 0} type="submit">
            {submitLabel.trim()}
          </button>
        </span>
      </footer>
    </form>
  );
}
