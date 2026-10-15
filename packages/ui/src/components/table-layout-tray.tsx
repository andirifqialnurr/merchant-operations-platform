"use client";

import { IconLayoutRows, IconPlus } from "@tabler/icons-react";

import { AppIcon } from "./app-icon";

export type UnplacedTableTrayItem = {
  disabled?: boolean;
  id: string;
  label: string;
  /** Why the table cannot be placed, when it cannot. */
  reason?: string;
};

/** Every text the tray shows or announces; it has none of its own. */
export type UnplacedTableTrayLabels = {
  /** How many tables wait, e.g. "3 tables". */
  count: (count: number) => string;
  empty: string;
  /** The action on one table, e.g. "Place T4". */
  place: (label: string) => string;
  title: string;
};

export type UnplacedTableTrayProps = {
  className?: string;
  disabled?: boolean;
  items: readonly UnplacedTableTrayItem[];
  labels: UnplacedTableTrayLabels;
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

/** Tables that exist but have no place on the floor yet. */
export function UnplacedTableTray({
  className,
  disabled = false,
  items,
  labels,
  onPlaceItem,
  selectedId,
}: UnplacedTableTrayProps) {
  assertTrayContract(items);

  return (
    <section aria-label={labels.title} className={classes("ui-unplaced-table-tray", className)}>
      <header className="ui-unplaced-table-tray__header">
        <span className="ui-unplaced-table-tray__title">
          <AppIcon icon={IconLayoutRows} size="sm" />
          <span>{labels.title}</span>
        </span>
        <span className="ui-unplaced-table-tray__count">{labels.count(items.length)}</span>
      </header>

      {items.length === 0 ? (
        <p className="ui-unplaced-table-tray__empty" role="status">
          {labels.empty}
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
                      : labels.place(visibleLabel)
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
                    <AppIcon icon={IconPlus} size="sm" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
