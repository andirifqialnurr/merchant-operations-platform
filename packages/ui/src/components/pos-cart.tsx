"use client";

import { type ReactNode, useId, useState } from "react";
import { IconTrash } from "@tabler/icons-react";

import { IconButton } from "./button";
import { QuantityStepper } from "./selection-control";

export type CartItemVariant = "compact" | "default" | "receipt";

export type CartItemLabels = {
  collapseDetails: string;
  decrease: string;
  expandDetails: (hiddenCount: number) => string;
  increase: string;
  lineTotal: string;
  modifiers: string;
  note: string;
  quantity: string;
  remove: string;
  unitPrice: string;
};

export type CartItemProps = {
  className?: string;
  disabled?: boolean;
  labels: CartItemLabels;
  lineTotalLabel: ReactNode;
  maxQuantity?: number;
  modifierCollapseAfter?: number;
  modifiers?: readonly ReactNode[];
  name: string;
  note?: ReactNode;
  onQuantityChange?: (quantity: number) => void;
  onRemove?: () => void;
  quantity: number;
  unitPriceLabel: ReactNode;
  variant?: CartItemVariant;
};

export type CartSummaryLabels = {
  amountDue: string;
  discount: string;
  paymentRecorded: string;
  rounding: string;
  serviceCharge: string;
  subtotal: string;
  tax: string;
  total: string;
};

export type CartSummaryProps = {
  amountDueLabel?: ReactNode;
  ariaLabel: string;
  className?: string;
  labels: CartSummaryLabels;
  discountLabel?: ReactNode;
  paymentRecordedLabel?: ReactNode;
  roundingLabel?: ReactNode;
  serviceChargeLabel?: ReactNode;
  subtotalLabel: ReactNode;
  taxLabel?: ReactNode;
  totalLabel: ReactNode;
};

type SummaryRow = {
  emphasis?: "total" | "outstanding";
  label: string;
  value: ReactNode;
};

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function CartItem({
  className,
  disabled = false,
  labels,
  lineTotalLabel,
  maxQuantity = 99,
  modifierCollapseAfter = 3,
  modifiers = [],
  name,
  note,
  onQuantityChange,
  onRemove,
  quantity,
  unitPriceLabel,
  variant = "default",
}: CartItemProps) {
  const modifierListId = useId();
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const collapseLimit = Math.max(1, Math.floor(modifierCollapseAfter));
  const hasCollapsedModifiers = modifiers.length > collapseLimit;
  const visibleModifiers =
    hasCollapsedModifiers && !detailsExpanded ? modifiers.slice(0, collapseLimit) : modifiers;
  const readOnly = variant === "receipt";

  return (
    <article className={classes("ui-cart-item", `ui-cart-item--${variant}`, className)}>
      <header className="ui-cart-item__header">
        <div>
          <h3>{name}</h3>
          <span className="ui-cart-item__unit-price">
            {labels.unitPrice} {unitPriceLabel}
          </span>
        </div>
        {!readOnly && onRemove ? (
          <IconButton
            className="ui-cart-item__remove"
            disabled={disabled}
            icon={IconTrash}
            label={labels.remove}
            onClick={onRemove}
            size={variant === "compact" ? "sm" : "md"}
            tooltip={labels.remove}
            variant="ghost"
          />
        ) : null}
      </header>

      {modifiers.length > 0 ? (
        <div className="ui-cart-item__modifiers">
          <span>{labels.modifiers}</span>
          <ul id={modifierListId}>
            {visibleModifiers.map((modifier, index) => (
              <li key={index}>{modifier}</li>
            ))}
          </ul>
          {hasCollapsedModifiers ? (
            <button
              aria-controls={modifierListId}
              aria-expanded={detailsExpanded}
              className="ui-cart-item__detail-toggle"
              onClick={() => setDetailsExpanded((expanded) => !expanded)}
              type="button"
            >
              {detailsExpanded
                ? labels.collapseDetails
                : labels.expandDetails(modifiers.length - collapseLimit)}
            </button>
          ) : null}
        </div>
      ) : null}

      {note ? (
        <div className="ui-cart-item__note">
          <span>{labels.note}</span>
          <p>{note}</p>
        </div>
      ) : null}

      <footer className="ui-cart-item__footer">
        {readOnly ? (
          <span
            aria-label={`${labels.quantity} ${quantity}`}
            className="ui-cart-item__receipt-quantity"
          >
            {quantity}×
          </span>
        ) : (
          <QuantityStepper
            decreaseLabel={labels.decrease}
            disabled={disabled || !onQuantityChange}
            increaseLabel={labels.increase}
            label={name}
            max={maxQuantity}
            min={1}
            size={variant === "compact" ? "sm" : "md"}
            value={quantity}
            {...(onQuantityChange ? { onValueChange: onQuantityChange } : {})}
          />
        )}
        <div className="ui-cart-item__line-total">
          <span>{labels.lineTotal}</span>
          <strong>{lineTotalLabel}</strong>
        </div>
      </footer>
    </article>
  );
}

export function CartSummary({
  amountDueLabel,
  ariaLabel,
  className,
  discountLabel,
  labels,
  paymentRecordedLabel,
  roundingLabel,
  serviceChargeLabel,
  subtotalLabel,
  taxLabel,
  totalLabel,
}: CartSummaryProps) {
  const rows: SummaryRow[] = [{ label: labels.subtotal, value: subtotalLabel }];
  if (discountLabel !== undefined) rows.push({ label: labels.discount, value: discountLabel });
  if (taxLabel !== undefined) rows.push({ label: labels.tax, value: taxLabel });
  if (serviceChargeLabel !== undefined) {
    rows.push({ label: labels.serviceCharge, value: serviceChargeLabel });
  }
  if (roundingLabel !== undefined) rows.push({ label: labels.rounding, value: roundingLabel });
  rows.push({ emphasis: "total", label: labels.total, value: totalLabel });
  if (paymentRecordedLabel !== undefined) {
    rows.push({ label: labels.paymentRecorded, value: paymentRecordedLabel });
  }
  if (amountDueLabel !== undefined) {
    rows.push({ emphasis: "outstanding", label: labels.amountDue, value: amountDueLabel });
  }

  return (
    <section aria-label={ariaLabel} className={classes("ui-cart-summary", className)}>
      <dl>
        {rows.map((row) => (
          <div
            className={classes(
              "ui-cart-summary__row",
              row.emphasis && `ui-cart-summary__row--${row.emphasis}`,
            )}
            key={row.label}
          >
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
