"use client";

import { type ReactNode, useId, useState } from "react";
import { Trash2 } from "lucide-react";

import { IconButton } from "./button";
import { QuantityStepper } from "./selection-control";

export type CartItemVariant = "compact" | "default" | "receipt";

export type CartItemProps = {
  className?: string;
  disabled?: boolean;
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

export type CartSummaryProps = {
  amountDueLabel?: ReactNode;
  ariaLabel?: string;
  className?: string;
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
          <span className="ui-cart-item__unit-price">Harga satuan {unitPriceLabel}</span>
        </div>
        {!readOnly && onRemove ? (
          <IconButton
            className="ui-cart-item__remove"
            disabled={disabled}
            icon={Trash2}
            label={`Hapus ${name}`}
            onClick={onRemove}
            size={variant === "compact" ? "sm" : "md"}
            tooltip={`Hapus ${name}`}
            variant="ghost"
          />
        ) : null}
      </header>

      {modifiers.length > 0 ? (
        <div className="ui-cart-item__modifiers">
          <span>Modifier</span>
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
                ? "Tutup detail"
                : `Lihat detail (+${modifiers.length - collapseLimit})`}
            </button>
          ) : null}
        </div>
      ) : null}

      {note ? (
        <div className="ui-cart-item__note">
          <span>Catatan</span>
          <p>{note}</p>
        </div>
      ) : null}

      <footer className="ui-cart-item__footer">
        {readOnly ? (
          <span aria-label={`Jumlah ${quantity}`} className="ui-cart-item__receipt-quantity">
            {quantity}×
          </span>
        ) : (
          <QuantityStepper
            disabled={disabled || !onQuantityChange}
            label={name}
            max={maxQuantity}
            min={1}
            size={variant === "compact" ? "sm" : "md"}
            value={quantity}
            {...(onQuantityChange ? { onValueChange: onQuantityChange } : {})}
          />
        )}
        <div className="ui-cart-item__line-total">
          <span>Total item</span>
          <strong>{lineTotalLabel}</strong>
        </div>
      </footer>
    </article>
  );
}

export function CartSummary({
  amountDueLabel,
  ariaLabel = "Ringkasan keranjang",
  className,
  discountLabel,
  paymentRecordedLabel,
  roundingLabel,
  serviceChargeLabel,
  subtotalLabel,
  taxLabel,
  totalLabel,
}: CartSummaryProps) {
  const rows: SummaryRow[] = [{ label: "Subtotal", value: subtotalLabel }];
  if (discountLabel !== undefined) rows.push({ label: "Diskon", value: discountLabel });
  if (taxLabel !== undefined) rows.push({ label: "Pajak", value: taxLabel });
  if (serviceChargeLabel !== undefined) {
    rows.push({ label: "Service charge", value: serviceChargeLabel });
  }
  if (roundingLabel !== undefined) rows.push({ label: "Pembulatan", value: roundingLabel });
  rows.push({ emphasis: "total", label: "Total", value: totalLabel });
  if (paymentRecordedLabel !== undefined) {
    rows.push({ label: "Pembayaran tercatat", value: paymentRecordedLabel });
  }
  if (amountDueLabel !== undefined) {
    rows.push({ emphasis: "outstanding", label: "Sisa tagihan", value: amountDueLabel });
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
