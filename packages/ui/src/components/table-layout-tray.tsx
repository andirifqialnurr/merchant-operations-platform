"use client";

import { Plus, Rows3 } from "lucide-react";

import { AppIcon } from "./app-icon";

export type UnplacedTableTrayItem = {
  disabled?: boolean;
  id: string;
  label: string;
  reason?: string;
};

export type UnplacedTableTrayProps = {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  emptyLabel?: string;
  items: readonly UnplacedTableTrayItem[];
  onPlaceItem?: (itemId: string) => void;
  selectedId?: string;
};

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertTrayContract(items: readonly UnplacedTableTrayItem[]) {
  const ids = new Set<string>();

  for (const item of items) {
    if (!item.id.trim()) throw new TypeError("Unplaced Table Tray memerlukan id internal item.");
    if (ids.has(item.id)) {
      throw new TypeError(`Unplaced Table Tray menerima id item duplikat: ${item.id}.`);
    }
    if (!item.label.trim()) throw new TypeError("Unplaced Table Tray memerlukan label meja.");
    if (item.reason !== undefined && !item.reason.trim()) {
      throw new TypeError("Alasan disabled meja harus berisi teks bila dikirim.");
    }
    ids.add(item.id);
  }
}

export function UnplacedTableTray({
  ariaLabel = "Meja belum ditempatkan",
  className,
  disabled = false,
  emptyLabel = "Tidak ada meja yang menunggu ditempatkan.",
  items,
  onPlaceItem,
  selectedId,
}: UnplacedTableTrayProps) {
  assertTrayContract(items);

  const availableCount = items.filter((item) => !item.disabled).length;

  return (
    <section aria-label={ariaLabel} className={classes("ui-unplaced-table-tray", className)}>
      <header className="ui-unplaced-table-tray__header">
        <span className="ui-unplaced-table-tray__title">
          <AppIcon icon={Rows3} size="sm" />
          <span>{ariaLabel}</span>
        </span>
        <span aria-label={`${items.length} meja`} className="ui-unplaced-table-tray__count">
          {items.length} meja
        </span>
      </header>

      {items.length === 0 ? (
        <p className="ui-unplaced-table-tray__empty" role="status">
          {emptyLabel}
        </p>
      ) : (
        <ul className="ui-unplaced-table-tray__list">
          {items.map((item) => {
            const isDisabled = disabled || item.disabled;
            const visibleLabel = item.label.trim();
            return (
              <li key={item.id}>
                <button
                  aria-label={
                    item.reason
                      ? `${visibleLabel}, ${item.reason.trim()}`
                      : `Tempatkan ${visibleLabel}`
                  }
                  aria-pressed={item.id === selectedId}
                  className="ui-unplaced-table-tray__item"
                  disabled={isDisabled}
                  onClick={() => onPlaceItem?.(item.id)}
                  type="button"
                >
                  <span className="ui-unplaced-table-tray__item-main">
                    <strong>{visibleLabel}</strong>
                    {item.reason ? <span>{item.reason.trim()}</span> : null}
                  </span>
                  <span aria-hidden="true" className="ui-unplaced-table-tray__item-action">
                    <AppIcon icon={Plus} size="sm" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 0 ? (
        <span className="ui-unplaced-table-tray__summary">{availableCount} siap ditempatkan</span>
      ) : null}
    </section>
  );
}
