"use client";

import {
  BellRing,
  CheckCircle2,
  ChefHat,
  Clock3,
  Flame,
  PackageCheck,
  PauseCircle,
  Volume2,
  VolumeX,
} from "lucide-react";

import { AppIcon } from "./app-icon";

export type KdsTicketStatus =
  "new" | "accepted" | "preparing" | "ready" | "served" | "completed" | "cancelled";

export type KdsTicketSize = "sm" | "md" | "lg";
export type KdsTicketVariant = "compact" | "default" | "touch" | "history";
export type KdsTicketTimerState = "running" | "paused" | "completed";
export type KdsTicketSlaState = "on-track" | "warning" | "breached";
export type KdsNewTicketAlertAudioState = "ready" | "muted" | "blocked";
export type KdsNewTicketAlertTone = "standard" | "urgent";

export type KdsTicketItem = {
  allergyNote?: string;
  modifiers?: readonly string[];
  name: string;
  note?: string;
  quantity: number;
};

export type KdsTicketAction = "accept" | "mark-ready" | "mark-served" | "complete";

export type KdsNewTicketAlertProps = {
  alertId: string;
  audioState: KdsNewTicketAlertAudioState;
  className?: string;
  count: number;
  message?: string;
  onAcknowledge?: (alertId: string) => void;
  onEnableAudio?: (alertId: string) => void;
  tone?: KdsNewTicketAlertTone;
};

export type KdsTicketProps = {
  className?: string;
  disabled?: boolean;
  elapsedLabel: string;
  id: string;
  items: readonly KdsTicketItem[];
  onPrimaryAction?: (ticketId: string, action: KdsTicketAction) => void;
  orderLabel: string;
  size?: KdsTicketSize;
  slaLabel?: string;
  slaState?: KdsTicketSlaState;
  sourceLabel: string;
  status: KdsTicketStatus;
  tableLabel?: string;
  timerState?: KdsTicketTimerState;
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

const timerStateContent: Record<KdsTicketTimerState, { icon: typeof CheckCircle2; label: string }> =
  {
    completed: { icon: CheckCircle2, label: "Timer selesai" },
    paused: { icon: PauseCircle, label: "Timer ditahan" },
    running: { icon: Clock3, label: "Timer berjalan" },
  };

const slaStateLabel: Record<KdsTicketSlaState, string> = {
  breached: "Lewat SLA",
  "on-track": "Sesuai SLA",
  warning: "Mendekati SLA",
};

const audioStateContent: Record<
  KdsNewTicketAlertAudioState,
  { icon: typeof CheckCircle2; label: string }
> = {
  blocked: { icon: VolumeX, label: "Audio perlu izin perangkat" },
  muted: { icon: VolumeX, label: "Audio dimatikan" },
  ready: { icon: Volume2, label: "Audio siap" },
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

function assertKdsTicketTimerContract({
  slaLabel,
  slaState,
  timerState,
}: {
  slaLabel: string | undefined;
  slaState: KdsTicketSlaState | undefined;
  timerState: KdsTicketTimerState | undefined;
}) {
  assertText(slaLabel, "Label SLA Kitchen Ticket");
  if (slaLabel !== undefined && slaState === undefined) {
    throw new TypeError("Label SLA Kitchen Ticket hanya boleh dikirim bersama state SLA.");
  }
  if (timerState === "completed" && slaState === "warning") {
    throw new TypeError("Timer selesai tidak boleh memakai state SLA mendekati.");
  }
}

function assertKdsNewTicketAlertContract({
  alertId,
  count,
  message,
}: {
  alertId: string;
  count: number;
  message: string | undefined;
}) {
  if (!alertId.trim()) throw new TypeError("KDS new-ticket alert memerlukan id internal alert.");
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new TypeError("Jumlah ticket baru KDS harus berupa safe integer positif.");
  }
  assertText(message, "Pesan new-ticket alert KDS");
}

export function KdsNewTicketAlert({
  alertId,
  audioState,
  className,
  count,
  message,
  onAcknowledge,
  onEnableAudio,
  tone = "standard",
}: KdsNewTicketAlertProps) {
  assertKdsNewTicketAlertContract({ alertId, count, message });

  const audioContent = audioStateContent[audioState];
  const ticketLabel = count === 1 ? "1 ticket baru" : `${count} ticket baru`;

  return (
    <section
      aria-label="Alert ticket baru KDS"
      aria-live="polite"
      className={classes(
        "ui-kds-new-ticket-alert",
        `ui-kds-new-ticket-alert--${audioState}`,
        `ui-kds-new-ticket-alert--${tone}`,
        className,
      )}
      role="status"
    >
      <span className="ui-kds-new-ticket-alert__icon" aria-hidden="true">
        <AppIcon icon={BellRing} size="md" />
      </span>
      <span className="ui-kds-new-ticket-alert__content">
        <strong>{ticketLabel}</strong>
        <span>{message?.trim() ?? "Pesanan masuk dan perlu diproses dapur."}</span>
      </span>
      <span className="ui-kds-new-ticket-alert__audio">
        <AppIcon icon={audioContent.icon} size="xs" />
        {audioContent.label}
      </span>
      {audioState === "blocked" ? (
        <button
          className="ui-kds-new-ticket-alert__button"
          disabled={!onEnableAudio}
          onClick={() => onEnableAudio?.(alertId)}
          type="button"
        >
          Aktifkan audio
        </button>
      ) : null}
      <button
        className="ui-kds-new-ticket-alert__button ui-kds-new-ticket-alert__button--secondary"
        disabled={!onAcknowledge}
        onClick={() => onAcknowledge?.(alertId)}
        type="button"
      >
        Tandai dilihat
      </button>
    </section>
  );
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
  slaLabel,
  slaState,
  sourceLabel,
  status,
  tableLabel,
  timerState = "running",
  variant = "default",
}: KdsTicketProps) {
  assertKdsTicketContract({ elapsedLabel, id, items, orderLabel, sourceLabel, tableLabel });
  assertKdsTicketTimerContract({ slaLabel, slaState, timerState });

  const readOnly = variant === "history" || status === "completed" || status === "cancelled";
  const primaryAction = readOnly ? undefined : primaryActionByStatus[status];
  const order = orderLabel.trim();
  const table = tableLabel?.trim();
  const timerContent = timerStateContent[timerState];
  const slaText = slaLabel?.trim() ?? (slaState ? slaStateLabel[slaState] : undefined);

  return (
    <article
      aria-label={`Kitchen ticket ${order}`}
      className={classes(
        "ui-kds-ticket",
        `ui-kds-ticket--${status}`,
        `ui-kds-ticket--${size}`,
        `ui-kds-ticket--${variant}`,
        `ui-kds-ticket--timer-${timerState}`,
        slaState && `ui-kds-ticket--sla-${slaState}`,
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
        <span>
          <AppIcon icon={timerContent.icon} size="xs" />
          {timerContent.label}
        </span>
        {slaText ? <strong className="ui-kds-ticket__sla">{slaText}</strong> : null}
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
