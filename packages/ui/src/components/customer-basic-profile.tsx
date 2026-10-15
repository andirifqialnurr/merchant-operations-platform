"use client";

import { Button } from "./button";

/** One customer in a list, already worded for the person reading it. */
export type CustomerBasicItem = {
  /** Phone number, or only its last digits, as the reader may see it. */
  contactLabel?: string;
  displayName: string;
  /** Hidden key used only for the callback. */
  id: string;
  noteLabel?: string;
  selected?: boolean;
  /** E.g. "3 visits · last on 12/10". */
  visitLabel?: string;
};

export type CustomerBasicProfileLabels = {
  /** Shown when the list has nobody in it. */
  empty: string;
  /** The name of the list. */
  region: string;
  /** The button that picks a customer, e.g. "Choose". */
  select: string;
  /** The same button once picked, e.g. "Chosen". */
  selected: string;
};

export type CustomerBasicProfileProps = {
  className?: string;
  /** Disables every choice, e.g. while a choice is being saved. */
  disabled?: boolean;
  items: readonly CustomerBasicItem[];
  labels: CustomerBasicProfileLabels;
  onSelectCustomer?: (id: string) => void;
};

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

/**
 * Customer Basic: a list of customers to choose from, each with what tells
 * them apart. One row per customer, separated by lines; nothing else.
 */
export function CustomerBasicProfile({
  className,
  disabled = false,
  items,
  labels,
  onSelectCustomer,
}: CustomerBasicProfileProps) {
  return (
    <section aria-label={labels.region} className={classes("ui-customer-basic", className)}>
      {items.length === 0 ? (
        <p className="ui-customer-basic__empty">{labels.empty}</p>
      ) : (
        <ul className="ui-customer-basic__list">
          {items.map((item) => {
            const facts = [item.contactLabel, item.visitLabel].filter(Boolean);
            return (
              <li className={classes(item.selected && "is-selected")} key={item.id}>
                <div className="ui-customer-basic__identity">
                  <strong>{item.displayName}</strong>
                  {facts.length > 0 ? <span>{facts.join(" · ")}</span> : null}
                  {item.noteLabel ? (
                    <span className="ui-customer-basic__note">{item.noteLabel}</span>
                  ) : null}
                </div>
                {onSelectCustomer ? (
                  <Button
                    aria-pressed={item.selected === true}
                    disabled={disabled}
                    onClick={() => onSelectCustomer(item.id)}
                    size="sm"
                    type="button"
                    variant={item.selected ? "primary" : "secondary"}
                  >
                    {item.selected ? labels.selected : labels.select}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
