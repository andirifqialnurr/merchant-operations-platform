"use client";

import type { ReactNode } from "react";

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export type StickyCartBarProps = {
  className?: string;
  /** How many items are in the cart, in words, e.g. "3 items". */
  countLabel: string;
  onOpen: () => void;
  /** What the cart comes to, already formatted. */
  totalLabel: ReactNode;
};

/**
 * The cart's summary, kept at the bottom of a small screen while the menu
 * scrolls. One tap opens the cart; the bar is the only place the running
 * total shows until then.
 */
export function StickyCartBar({ className, countLabel, onOpen, totalLabel }: StickyCartBarProps) {
  return (
    <div className={classes("ui-sticky-cart-bar", className)}>
      <button className="ui-sticky-cart-bar__button" onClick={onOpen} type="button">
        <span>{countLabel}</span>
        <span className="ui-sticky-cart-bar__total">{totalLabel}</span>
      </button>
    </div>
  );
}

export type OrderProgressProps = {
  className?: string;
  /** Index into `steps` of where the order is now. */
  current: number;
  /** The name of the whole progress, e.g. "Order 12 progress". */
  label: string;
  /** The steps an order goes through, in order. */
  steps: readonly string[];
};

/**
 * Where an order is on its way from the kitchen, as a row of steps: done
 * steps filled, the current one named, later ones muted.
 */
export function OrderProgress({ className, current, label, steps }: OrderProgressProps) {
  return (
    <ol aria-label={label} className={classes("ui-order-progress", className)}>
      {steps.map((step, index) => (
        <li
          aria-current={index === current ? "step" : undefined}
          className={index < current ? "is-done" : index === current ? "is-current" : undefined}
          key={step}
        >
          <span aria-hidden="true" className="ui-order-progress__bar" />
          <span className="ui-order-progress__label">{step}</span>
        </li>
      ))}
    </ol>
  );
}
