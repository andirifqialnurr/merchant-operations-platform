"use client";

import { type ChangeEvent, type ReactNode } from "react";
import { Boxes, CheckCircle2, PackageSearch, Ruler, Scale } from "lucide-react";

import { AppIcon } from "./app-icon";

export type InventoryItemStatus = "active" | "inactive" | "archived";
export type InventoryStockStatus = "normal" | "low" | "out" | "negative" | "unavailable";

export type InventoryItemOption = {
  disabled?: boolean;
  disabledReason?: string;
  id: string;
  name: string;
  primaryUnit: string;
  sku?: string;
  status?: InventoryItemStatus;
  stockLabel?: string;
  stockStatus?: InventoryStockStatus;
};

export type InventoryUnitConversion = {
  fromQuantity: string;
  fromUnit: string;
  id: string;
  label?: string;
  toQuantity: string;
  toUnit: string;
};

export type InventoryItemPickerProps = {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  emptyLabel?: string;
  items: readonly InventoryItemOption[];
  loading?: boolean;
  onQueryChange?: (query: string) => void;
  onSelectItem?: (itemId: string) => void;
  query?: string;
  resultCountLabel?: ReactNode;
  selectedId?: string;
};

export type InventoryUnitConversionListProps = {
  ariaLabel?: string;
  className?: string;
  conversions: readonly InventoryUnitConversion[];
  primaryUnit: string;
};

const itemStatusLabel: Record<InventoryItemStatus, string> = {
  active: "Aktif",
  archived: "Diarsipkan",
  inactive: "Tidak aktif",
};

const stockStatusLabel: Record<InventoryStockStatus, string> = {
  low: "Stok rendah",
  negative: "Stok negatif",
  normal: "Stok tersedia",
  out: "Stok habis",
  unavailable: "Stok belum tersedia",
};

const inventorySensitiveDataKeyPattern =
  /(?:payment|hpp|cogs|cost|price|profit|margin|supplier|customer|phone|telepon|email|audit|actor|timestamp|barcode|token|payload|permission)/i;

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertText(value: string | undefined, fieldName: string) {
  if (value !== undefined && !value.trim()) {
    throw new TypeError(`${fieldName} harus berisi teks bila dikirim.`);
  }
}

function assertNoInventorySensitiveData(value: unknown, path = "Inventory item/unit payload") {
  if (value === null || value === undefined || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoInventorySensitiveData(item, `${path}[${index}]`));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (inventorySensitiveDataKeyPattern.test(key)) {
      throw new TypeError(`${path} tidak boleh menerima data sensitif: ${key}.`);
    }
    if (nestedValue && typeof nestedValue === "object") {
      assertNoInventorySensitiveData(nestedValue, `${path}.${key}`);
    }
  }
}

function assertInventoryItem(item: InventoryItemOption) {
  if (!item.id.trim()) throw new TypeError("Inventory Item Picker memerlukan id internal item.");
  if (!item.name.trim()) throw new TypeError("Nama item inventory harus berisi teks.");
  if (!item.primaryUnit.trim()) throw new TypeError("Unit utama item inventory harus berisi teks.");
  assertText(item.sku, "SKU item inventory");
  assertText(item.stockLabel, "Label stok item inventory");
  assertText(item.disabledReason, "Alasan item inventory nonaktif");
}

function assertInventoryUnitConversion(conversion: InventoryUnitConversion) {
  if (!conversion.id.trim()) {
    throw new TypeError("Daftar konversi unit memerlukan id internal konversi.");
  }
  if (!conversion.fromQuantity.trim()) {
    throw new TypeError("Quantity awal konversi unit harus berisi teks.");
  }
  if (!conversion.fromUnit.trim()) {
    throw new TypeError("Unit awal konversi harus berisi teks.");
  }
  if (!conversion.toQuantity.trim()) {
    throw new TypeError("Quantity hasil konversi unit harus berisi teks.");
  }
  if (!conversion.toUnit.trim()) {
    throw new TypeError("Unit hasil konversi harus berisi teks.");
  }
  assertText(conversion.label, "Label konversi unit");
}

export function InventoryItemPicker(props: InventoryItemPickerProps) {
  assertNoInventorySensitiveData(props);

  const {
    ariaLabel = "Pilih item inventory",
    className,
    disabled = false,
    emptyLabel = "Tidak ada item yang cocok.",
    items,
    loading = false,
    onQueryChange,
    onSelectItem,
    query = "",
    resultCountLabel,
    selectedId,
  } = props;

  items.forEach(assertInventoryItem);

  const resultLabel =
    resultCountLabel ??
    (loading ? "Memuat item" : items.length === 0 ? emptyLabel : `${items.length} item ditemukan`);

  function handleQueryChange(event: ChangeEvent<HTMLInputElement>) {
    onQueryChange?.(event.currentTarget.value);
  }

  return (
    <section aria-label={ariaLabel} className={classes("ui-inventory-item-picker", className)}>
      <label className="ui-inventory-item-picker__search">
        <span>Cari item</span>
        <span className="ui-inventory-item-picker__search-control">
          <AppIcon icon={PackageSearch} size="sm" />
          <input
            aria-controls="inventory-item-picker-results"
            aria-expanded={!loading}
            disabled={disabled}
            onChange={handleQueryChange}
            placeholder="Nama item atau SKU"
            role="combobox"
            type="search"
            value={query}
          />
        </span>
      </label>

      <p className="ui-inventory-item-picker__result-count" aria-live="polite">
        {resultLabel}
      </p>

      {items.length === 0 ? (
        <p className="ui-inventory-item-picker__empty">{emptyLabel}</p>
      ) : (
        <ul
          aria-label="Hasil item inventory"
          className="ui-inventory-item-picker__results"
          id="inventory-item-picker-results"
          role="listbox"
        >
          {items.map((item) => {
            const selected = item.id === selectedId;
            const unavailable = item.disabled || item.status === "archived";
            const stockStatus = item.stockStatus ?? "unavailable";

            return (
              <li key={item.id} role="presentation">
                <button
                  aria-selected={selected}
                  className={classes(
                    "ui-inventory-item-picker__option",
                    selected && "is-selected",
                    unavailable && "is-unavailable",
                    `ui-inventory-item-picker__option--stock-${stockStatus}`,
                  )}
                  disabled={disabled || unavailable || !onSelectItem}
                  onClick={() => onSelectItem?.(item.id)}
                  role="option"
                  type="button"
                >
                  <span className="ui-inventory-item-picker__option-icon" aria-hidden="true">
                    <AppIcon icon={Boxes} size="md" />
                  </span>
                  <span className="ui-inventory-item-picker__option-main">
                    <strong>{item.name.trim()}</strong>
                    <span>
                      {item.sku ? <span>SKU {item.sku.trim()}</span> : null}
                      <span>Unit utama {item.primaryUnit.trim()}</span>
                    </span>
                  </span>
                  <span className="ui-inventory-item-picker__option-meta">
                    <span className="ui-inventory-item-picker__status">
                      {itemStatusLabel[item.status ?? "active"]}
                    </span>
                    {item.stockLabel ? (
                      <span className="ui-inventory-item-picker__stock">
                        {item.stockLabel.trim()}
                      </span>
                    ) : (
                      <span className="ui-inventory-item-picker__stock">
                        {stockStatusLabel[stockStatus]}
                      </span>
                    )}
                    {item.disabledReason ? (
                      <span className="ui-inventory-item-picker__reason">
                        {item.disabledReason.trim()}
                      </span>
                    ) : null}
                  </span>
                  {selected ? (
                    <span className="ui-inventory-item-picker__selected" aria-hidden="true">
                      <AppIcon icon={CheckCircle2} size="sm" />
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function InventoryUnitConversionList({
  ariaLabel = "Konversi unit inventory",
  className,
  conversions,
  primaryUnit,
}: InventoryUnitConversionListProps) {
  assertNoInventorySensitiveData({ conversions, primaryUnit });
  if (!primaryUnit.trim()) throw new TypeError("Daftar unit memerlukan unit utama.");
  conversions.forEach(assertInventoryUnitConversion);

  return (
    <section aria-label={ariaLabel} className={classes("ui-inventory-unit-list", className)}>
      <header className="ui-inventory-unit-list__header">
        <span className="ui-inventory-unit-list__icon" aria-hidden="true">
          <AppIcon icon={Scale} size="md" />
        </span>
        <span>
          <span>Unit utama</span>
          <strong>{primaryUnit.trim()}</strong>
        </span>
      </header>

      {conversions.length === 0 ? (
        <p className="ui-inventory-unit-list__empty">Belum ada konversi unit tambahan.</p>
      ) : (
        <ul className="ui-inventory-unit-list__rows">
          {conversions.map((conversion) => {
            const fromQuantity = conversion.fromQuantity.trim();
            const fromUnit = conversion.fromUnit.trim();
            const toQuantity = conversion.toQuantity.trim();
            const toUnit = conversion.toUnit.trim();

            return (
              <li key={conversion.id}>
                <span className="ui-inventory-unit-list__row-icon" aria-hidden="true">
                  <AppIcon icon={Ruler} size="sm" />
                </span>
                <span className="ui-inventory-unit-list__row-main">
                  <strong>
                    {fromQuantity} {fromUnit} = {toQuantity} {toUnit}
                  </strong>
                  {conversion.label ? <span>{conversion.label.trim()}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
