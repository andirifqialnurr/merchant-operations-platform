"use client";

import { CheckCircle2, ChefHat, Clock3, Flame, PackageCheck } from "lucide-react";

import { AppIcon } from "./app-icon";

export type KdsTicketStatus =
  "new" | "accepted" | "preparing" | "ready" | "served" | "completed" | "cancelled";

export type KdsTicketSize = "sm" | "md" | "lg";
export type KdsTicketVariant = "compact" | "default" | "touch" | "history";

export type KdsTicketItem = {
  allergyNote?: string;
  modifiers?: readonly string[];
  name: string;
  note?: string;
  quantity: number;
};

export type KdsTicketAction = "accept" | "mark-ready" | "mark-served" | "complete";

export type KdsTicketProps = {
  className?: string;
  disabled?: boolean;
  elapsedLabel: string;
  id: string;
  items: readonly KdsTicketItem[];
  onPrimaryAction?: (ticketId: string, action: KdsTicketAction) => void;
  orderLabel: string;
  size?: KdsTicketSize;
  sourceLabel: string;
  status: KdsTicketStatus;
  tableLabel?: string;
  variant?: KdsTicketVariant;
};

const statusLabel: Record<KdsTicketStatus, string> = {
  accepted: "Diterima",
  cancelled: "Dibatalkan",
  completed: "Selesai",
  new: "Pesanan baru",
  preparing: "Sedang disiapkan",
  ready: "Siap disajikan",
  served: "Sudah disajikan",
};

const primaryActionByStatus: Partial<
  Record<KdsTicketStatus, { action: KdsTicketAction; icon: typeof CheckCircle2; label: string }>
> = {
  accepted: { action: "mark-ready", icon: Flame, label: "Siap disajikan" },
  new: { action: "accept", icon: CheckCircle2, label: "Terima" },
  preparing: { action: "mark-ready", icon: Flame, label: "Siap disajikan" },
  ready: { action: "mark-served", icon: PackageCheck, label: "Tandai disajikan" },
  served: { action: "complete", icon: CheckCircle2, label: "Selesaikan" },
};

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertText(value: string | undefined, fieldName: string) {
  if (value !== undefined && !value.trim()) {
    throw new TypeError(`${fieldName} harus berisi teks bila dikirim.`);
  }
}

function assertKdsTicketContract({
  elapsedLabel,
  id,
  items,
  orderLabel,
  sourceLabel,
  tableLabel,
}: {
  elapsedLabel: string;
  id: string;
  items: readonly KdsTicketItem[];
  orderLabel: string;
  sourceLabel: string;
  tableLabel: string | undefined;
}) {
  if (!id.trim()) throw new TypeError("Kitchen Ticket memerlukan id internal ticket.");
  if (!orderLabel.trim()) throw new TypeError("Kitchen Ticket memerlukan nomor order.");
  if (!elapsedLabel.trim()) throw new TypeError("Kitchen Ticket memerlukan elapsed label.");
  if (!sourceLabel.trim()) throw new TypeError("Kitchen Ticket memerlukan source order.");
  assertText(tableLabel, "Label meja Kitchen Ticket");
  if (items.length === 0) throw new TypeError("Kitchen Ticket memerlukan minimal satu item.");

  for (const item of items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw new TypeError("Quantity item Kitchen Ticket harus berupa safe integer positif.");
    }
    if (!item.name.trim()) throw new TypeError("Nama item Kitchen Ticket harus berisi teks.");
    assertText(item.note, "Catatan item Kitchen Ticket");
    assertText(item.allergyNote, "Allergy note Kitchen Ticket");
    for (const modifier of item.modifiers ?? []) {
      if (!modifier.trim()) {
        throw new TypeError("Modifier Kitchen Ticket harus berisi teks bila dikirim.");
      }
    }
  }
}

export function KdsTicket({
  className,
  disabled = false,
  elapsedLabel,
  id,
  items,
  onPrimaryAction,
  orderLabel,
  size = "md",
  sourceLabel,
  status,
  tableLabel,
  variant = "default",
}: KdsTicketProps) {
  assertKdsTicketContract({ elapsedLabel, id, items, orderLabel, sourceLabel, tableLabel });

  const readOnly = variant === "history" || status === "completed" || status === "cancelled";
  const primaryAction = readOnly ? undefined : primaryActionByStatus[status];
  const order = orderLabel.trim();
  const table = tableLabel?.trim();

  return (
    <article
      aria-label={`Kitchen ticket ${order}`}
      className={classes(
        "ui-kds-ticket",
        `ui-kds-ticket--${status}`,
        `ui-kds-ticket--${size}`,
        `ui-kds-ticket--${variant}`,
        className,
      )}
    >
      <header className="ui-kds-ticket__header">
        <span className="ui-kds-ticket__order">
          <span>{order}</span>
          {table ? <strong>{table}</strong> : null}
        </span>
        <span className="ui-kds-ticket__status">{statusLabel[status]}</span>
      </header>

      <div className="ui-kds-ticket__meta">
        <span>
          <AppIcon icon={ChefHat} size="xs" />
          {sourceLabel.trim()}
        </span>
        <span>
          <AppIcon icon={Clock3} size="xs" />
          {elapsedLabel.trim()}
        </span>
      </div>

      <ul className="ui-kds-ticket__items">
        {items.map((item, index) => (
          <li key={`${item.name}-${index}`}>
            <span className="ui-kds-ticket__item-main">
              <strong aria-label={`${item.quantity} ${item.name.trim()}`}>{item.quantity}</strong>
              <span>{item.name.trim()}</span>
            </span>

            {item.modifiers && item.modifiers.length > 0 ? (
              <ul className="ui-kds-ticket__modifiers" aria-label={`Modifier ${item.name.trim()}`}>
                {item.modifiers.map((modifier) => (
                  <li key={modifier}>{modifier.trim()}</li>
                ))}
              </ul>
            ) : null}

            {item.note ? <p className="ui-kds-ticket__note">{item.note.trim()}</p> : null}
            {item.allergyNote ? (
              <p className="ui-kds-ticket__allergy">{item.allergyNote.trim()}</p>
            ) : null}
          </li>
        ))}
      </ul>

      {primaryAction ? (
        <button
          className="ui-kds-ticket__action"
          disabled={disabled || !onPrimaryAction}
          onClick={() => onPrimaryAction?.(id, primaryAction.action)}
          type="button"
        >
          <AppIcon icon={primaryAction.icon} size="sm" />
          <span>{primaryAction.label}</span>
        </button>
      ) : null}
    </article>
  );
}
