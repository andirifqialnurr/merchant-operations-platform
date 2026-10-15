"use client";

import {
  IconBellRinging,
  IconChefHat,
  IconCircleCheck,
  IconClock,
  IconFlame,
  IconLoader2,
  IconPackageImport,
  IconWifiOff,
} from "@tabler/icons-react";

import { AppIcon } from "./app-icon";
import { Button } from "./button";

export type KdsTicketStatus = "new" | "accepted" | "preparing" | "ready" | "served" | "canceled";

/** `kiosk`: a kitchen monitor read from one to two meters away. */
export type KdsTicketSize = "sm" | "md" | "lg" | "kiosk";
export type KdsTicketVariant = "compact" | "default" | "touch" | "history";
/** How the waiting time reads: fine, close to the limit, or past it. */
export type KdsTicketTimerTone = "normal" | "warning" | "late";
/**
 * - `reconnecting`: the link to the server dropped and is being restored.
 * - `offline`: the device has no network at all.
 */
export type KdsConnectionState = "offline" | "reconnecting";

export type KdsTicketItem = {
  allergyNote?: string;
  modifiers?: readonly string[];
  name: string;
  note?: string;
  quantity: number;
};

export type KdsConnectionStatusProps = {
  /** Reads the queue again by hand, e.g. "Refresh". */
  action?: { busy?: boolean; label: string; onAction: () => void };
  className?: string;
  /** What it means for the screen, e.g. "Tickets on screen may be out of date." */
  message: string;
  state: KdsConnectionState;
  /** What is happening, e.g. "Reconnecting…". */
  title: string;
};

/**
 * One kitchen ticket. Every word on it comes from the caller, already in the
 * viewer's language; the component adds none of its own. It shows what to
 * prepare and never a price, a payment, or a customer's contact.
 */
export type KdsTicketProps = {
  /** The one next step. Left out for a finished ticket or a viewer who may not act. */
  action?: { busy?: boolean; label: string; onAction: () => void };
  /** Read before an allergy note, e.g. "Alergi". */
  allergyLabel: string;
  className?: string;
  /** How long the ticket has waited, e.g. "12 mnt". */
  elapsedLabel: string;
  /** Takes the width of its container instead of its own fixed width. */
  fill?: boolean;
  items: readonly KdsTicketItem[];
  /** Accessible name of the ticket, e.g. "Ticket A-12". */
  label: string;
  orderLabel: string;
  size?: KdsTicketSize;
  sourceLabel: string;
  status: KdsTicketStatus;
  statusLabel: string;
  tableLabel?: string;
  /** Accessible name of the waiting time, e.g. "Menunggu". */
  timerLabel: string;
  /** Just arrived: a steady ring around the ticket, never a blink. */
  highlighted?: boolean;
  timerTone?: KdsTicketTimerTone;
  variant?: KdsTicketVariant;
};

const actionIconByStatus: Partial<Record<KdsTicketStatus, typeof IconCircleCheck>> = {
  accepted: IconFlame,
  new: IconCircleCheck,
  preparing: IconBellRinging,
  ready: IconPackageImport,
};

const kdsSensitiveDataKeyPattern =
  /(?:payment|hpp|cogs|cost|price|profit|margin|customer|phone|telepon|email|billing|invoice|receipt|token|namespace|socket|payload)/i;

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertText(value: string | undefined, fieldName: string) {
  if (value !== undefined && !value.trim()) {
    throw new TypeError(`${fieldName} harus berisi teks bila dikirim.`);
  }
}

function assertNoKdsSensitiveData(value: unknown, path = "KDS payload") {
  if (value === null || value === undefined || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoKdsSensitiveData(item, `${path}[${index}]`));
    return;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (kdsSensitiveDataKeyPattern.test(key)) {
      throw new TypeError(`${path} tidak boleh menerima data sensitif: ${key}.`);
    }
    if (nestedValue && typeof nestedValue === "object") {
      assertNoKdsSensitiveData(nestedValue, `${path}.${key}`);
    }
  }
}

function assertKdsTicketContract({
  action,
  allergyLabel,
  elapsedLabel,
  items,
  label,
  orderLabel,
  sourceLabel,
  statusLabel,
  tableLabel,
  timerLabel,
}: Pick<
  KdsTicketProps,
  | "action"
  | "allergyLabel"
  | "elapsedLabel"
  | "items"
  | "label"
  | "orderLabel"
  | "sourceLabel"
  | "statusLabel"
  | "tableLabel"
  | "timerLabel"
>) {
  const required = {
    allergyLabel,
    elapsedLabel,
    label,
    orderLabel,
    sourceLabel,
    statusLabel,
    timerLabel,
  };
  for (const [name, value] of Object.entries(required)) {
    if (!value.trim()) throw new TypeError(`Kitchen Ticket needs ${name}.`);
  }
  assertText(tableLabel, "Kitchen Ticket tableLabel");
  if (action && !action.label.trim()) throw new TypeError("Kitchen Ticket needs an action label.");
  if (items.length === 0) throw new TypeError("Kitchen Ticket needs at least one item.");

  for (const item of items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw new TypeError("A Kitchen Ticket item quantity must be a positive safe integer.");
    }
    if (!item.name.trim()) throw new TypeError("A Kitchen Ticket item needs a name.");
    assertText(item.note, "Kitchen Ticket item note");
    assertText(item.allergyNote, "Kitchen Ticket allergy note");
    for (const modifier of item.modifiers ?? []) {
      if (!modifier.trim()) throw new TypeError("A Kitchen Ticket modifier must have text.");
    }
  }
}

/**
 * A banner across the kitchen screen while it cannot hear about new tickets.
 * Every word comes from the caller.
 */
export function KdsConnectionStatus(props: KdsConnectionStatusProps) {
  assertNoKdsSensitiveData(props);
  const { action, className, message, state, title } = props;
  assertText(title, "Judul koneksi KDS");
  assertText(message, "Pesan koneksi KDS");

  return (
    <section
      aria-live="polite"
      className={classes(
        "ui-kds-connection-status",
        `ui-kds-connection-status--${state}`,
        className,
      )}
      role="status"
    >
      <span
        aria-hidden="true"
        className={classes(
          "ui-kds-connection-status__icon",
          state === "reconnecting" && "ui-kds-connection-status__icon--spin",
        )}
      >
        <AppIcon icon={state === "offline" ? IconWifiOff : IconLoader2} size="md" />
      </span>
      <span className="ui-kds-connection-status__content">
        <strong>{title.trim()}</strong>
        <span>{message.trim()}</span>
      </span>
      {action ? (
        <Button
          loading={action.busy ?? false}
          onClick={action.onAction}
          size="md"
          variant="secondary"
        >
          {action.label}
        </Button>
      ) : null}
    </section>
  );
}

const timerToneClass: Record<KdsTicketTimerTone, string | false> = {
  late: "ui-kds-ticket--sla-breached",
  normal: false,
  warning: "ui-kds-ticket--sla-warning",
};

export function KdsTicket(props: KdsTicketProps) {
  assertNoKdsSensitiveData(props);

  const {
    action,
    allergyLabel,
    className,
    elapsedLabel,
    fill = false,
    highlighted = false,
    items,
    label,
    orderLabel,
    size = "md",
    sourceLabel,
    status,
    statusLabel,
    tableLabel,
    timerLabel,
    timerTone = "normal",
    variant = "default",
  } = props;

  assertKdsTicketContract(props);

  const finished = status === "served" || status === "canceled";
  const shownAction = variant === "history" || finished ? undefined : action;
  const table = tableLabel?.trim();
  const ActionIcon = actionIconByStatus[status] ?? IconCircleCheck;

  return (
    <article
      aria-label={label.trim()}
      className={classes(
        "ui-kds-ticket",
        `ui-kds-ticket--${status === "canceled" ? "cancelled" : status}`,
        `ui-kds-ticket--${size}`,
        `ui-kds-ticket--${variant}`,
        fill && "ui-kds-ticket--fill",
        highlighted && !finished && "ui-kds-ticket--highlighted",
        !finished && timerToneClass[timerTone],
        className,
      )}
    >
      <header className="ui-kds-ticket__header">
        <span className="ui-kds-ticket__order">
          <span>{orderLabel.trim()}</span>
          {table ? <strong>{table}</strong> : null}
        </span>
        <span className="ui-kds-ticket__status">{statusLabel.trim()}</span>
      </header>

      <div className="ui-kds-ticket__meta">
        <span>
          <AppIcon icon={IconChefHat} size="xs" />
          {sourceLabel.trim()}
        </span>
        <span
          aria-label={`${timerLabel.trim()} ${elapsedLabel.trim()}`}
          className="ui-kds-ticket__sla"
        >
          <AppIcon icon={IconClock} size="xs" />
          {elapsedLabel.trim()}
        </span>
      </div>

      <ul className="ui-kds-ticket__items">
        {items.map((item, index) => (
          <li key={`${item.name}-${index}`}>
            <span className="ui-kds-ticket__item-main">
              <strong>{item.quantity}</strong>
              <span>{item.name.trim()}</span>
            </span>

            {item.modifiers && item.modifiers.length > 0 ? (
              <ul className="ui-kds-ticket__modifiers">
                {item.modifiers.map((modifier, modifierIndex) => (
                  <li key={`${modifier}-${modifierIndex}`}>{modifier.trim()}</li>
                ))}
              </ul>
            ) : null}

            {item.note ? <p className="ui-kds-ticket__note">{item.note.trim()}</p> : null}
            {item.allergyNote ? (
              <p className="ui-kds-ticket__allergy">
                <strong>{allergyLabel.trim()}</strong> {item.allergyNote.trim()}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {shownAction ? (
        <button
          aria-busy={shownAction.busy || undefined}
          className="ui-kds-ticket__action"
          disabled={shownAction.busy}
          onClick={shownAction.onAction}
          type="button"
        >
          <AppIcon icon={ActionIcon} size="sm" />
          <span>{shownAction.label.trim()}</span>
        </button>
      ) : null}
    </article>
  );
}
