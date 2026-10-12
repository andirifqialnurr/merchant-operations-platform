"use client";

import { useId, useRef } from "react";
import { IconPlus, IconTrash } from "@tabler/icons-react";

import { Button, IconButton } from "./button";
import { QuantityStepper } from "./selection-control";
import { Input } from "./text-field";

/** One free-text line: what, how many, and an optional note. */
export type QuickItem = {
  /** Stable while the form is open; never shown and never sent. */
  key: string;
  name: string;
  note: string;
  quantity: number;
};

export type QuickItemEntryLabels = {
  add: string;
  decrease: string;
  increase: string;
  /** Accessible name of a line, e.g. "Item 2". */
  item: (position: number) => string;
  name: string;
  note: string;
  quantity: string;
  /** Accessible name of a line's remove button, e.g. "Hapus item 2". */
  remove: (position: number) => string;
};

export type QuickItemEntryProps = {
  disabled?: boolean;
  /** Shown under the list, e.g. "Add at least one item with a name". */
  error?: string;
  items: readonly QuickItem[];
  labels: QuickItemEntryLabels;
  maxItems?: number;
  maxQuantity?: number;
  nameMaxLength?: number;
  noteMaxLength?: number;
  onItemsChange: (items: QuickItem[]) => void;
};

export function emptyQuickItem(): QuickItem {
  return { key: crypto.randomUUID(), name: "", note: "", quantity: 1 };
}

/**
 * Typing a short list of items fast, without a catalog: a name, a count, and
 * a note per line. Enter in a name moves on to a new line, so a list is typed
 * without leaving the keyboard. There is always at least one line.
 */
export function QuickItemEntry({
  disabled = false,
  error,
  items,
  labels,
  maxItems = 100,
  maxQuantity = 999,
  nameMaxLength = 160,
  noteMaxLength = 300,
  onItemsChange,
}: QuickItemEntryProps) {
  const errorId = useId();
  const list = useRef<HTMLOListElement>(null);
  const canAdd = !disabled && items.length < maxItems;

  const change = (key: string, patch: Partial<QuickItem>) =>
    onItemsChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  const focusName = (index: number) => {
    // After the new line is in the document.
    requestAnimationFrame(() => {
      list.current
        ?.querySelectorAll<HTMLInputElement>("[data-quick-item-name]")
        .item(index)
        ?.focus();
    });
  };
  const add = () => {
    if (!canAdd) return;
    onItemsChange([...items, emptyQuickItem()]);
    focusName(items.length);
  };
  const remove = (key: string, index: number) => {
    const rest = items.filter((item) => item.key !== key);
    onItemsChange(rest.length > 0 ? rest : [emptyQuickItem()]);
    focusName(Math.max(0, index - 1));
  };

  return (
    <div className="ui-quick-item-entry">
      <ol className="ui-quick-item-entry__list" ref={list}>
        {items.map((item, index) => (
          <li
            aria-label={labels.item(index + 1)}
            className="ui-quick-item-entry__item"
            key={item.key}
          >
            <div className="ui-quick-item-entry__name">
              <Input
                aria-describedby={error ? errorId : undefined}
                aria-label={`${labels.name} ${index + 1}`}
                data-quick-item-name=""
                disabled={disabled}
                maxLength={nameMaxLength}
                onChange={(event) => change(item.key, { name: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  // Enter never submits the form from here: it moves on.
                  event.preventDefault();
                  if (index < items.length - 1) focusName(index + 1);
                  else if (item.name.trim()) add();
                }}
                placeholder={labels.name}
                value={item.name}
              />
            </div>
            <QuantityStepper
              decreaseLabel={labels.decrease}
              disabled={disabled}
              increaseLabel={labels.increase}
              label={`${labels.quantity} ${index + 1}`}
              max={maxQuantity}
              min={1}
              onValueChange={(quantity) => change(item.key, { quantity })}
              value={item.quantity}
            />
            <IconButton
              disabled={disabled || (items.length === 1 && !item.name && !item.note)}
              icon={IconTrash}
              label={labels.remove(index + 1)}
              onClick={() => remove(item.key, index)}
            />
            <div className="ui-quick-item-entry__note">
              <Input
                aria-label={`${labels.note} ${index + 1}`}
                disabled={disabled}
                maxLength={noteMaxLength}
                onChange={(event) => change(item.key, { note: event.target.value })}
                placeholder={labels.note}
                value={item.note}
              />
            </div>
          </li>
        ))}
      </ol>
      {error ? (
        <p className="ui-quick-item-entry__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={!canAdd} iconLeft={IconPlus} onClick={add} variant="secondary">
        {labels.add}
      </Button>
    </div>
  );
}
