"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Clock3, ReceiptText, Users } from "lucide-react";

import { AppIcon } from "./app-icon";

export type TableTileMode = "view" | "edit";
export type TableTileSize = "sm" | "md" | "lg";
export type TableTileState =
  | "available"
  | "occupied"
  | "waiting-order"
  | "waiting-payment"
  | "needs-service"
  | "reserved"
  | "disabled";

export type TableTileProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  durationMinutes?: number;
  guestCount?: number;
  label: string;
  mode?: TableTileMode;
  orderCount?: number;
  selected?: boolean;
  size?: TableTileSize;
  state?: TableTileState;
};

const tableTileStateLabels: Record<TableTileState, string> = {
  available: "Tersedia",
  occupied: "Terisi",
  "waiting-order": "Menunggu konfirmasi",
  "waiting-payment": "Menunggu pembayaran",
  "needs-service": "Butuh layanan",
  reserved: "Reservasi",
  disabled: "Nonaktif",
};

const activeServiceStates = new Set<TableTileState>([
  "occupied",
  "waiting-order",
  "waiting-payment",
  "needs-service",
]);

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertOptionalNonNegativeInteger(value: number | undefined, fieldName: string) {
  if (value === undefined) return;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${fieldName} harus berupa safe integer non-negatif.`);
  }
}

function assertTableTileContract({
  durationMinutes,
  guestCount,
  label,
  orderCount,
}: {
  durationMinutes: number | undefined;
  guestCount: number | undefined;
  label: string;
  orderCount: number | undefined;
}) {
  if (!label.trim()) throw new TypeError("Table Tile memerlukan label meja yang terlihat.");
  assertOptionalNonNegativeInteger(guestCount, "Jumlah tamu");
  assertOptionalNonNegativeInteger(orderCount, "Jumlah order");
  assertOptionalNonNegativeInteger(durationMinutes, "Durasi meja");
}

function formatDuration(minutes: number) {
  if (minutes < 60) {
    return { ariaLabel: `${minutes} menit`, label: `${minutes} mnt` };
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return { ariaLabel: `${hours} jam`, label: `${hours}j` };
  }

  return {
    ariaLabel: `${hours} jam ${remainingMinutes} menit`,
    label: `${hours}j ${remainingMinutes}m`,
  };
}

export const TableTile = forwardRef<HTMLButtonElement, TableTileProps>(function TableTile(
  {
    className,
    disabled,
    durationMinutes,
    guestCount,
    label,
    mode = "view",
    orderCount,
    selected = false,
    size = "md",
    state = "available",
    ...props
  },
  ref,
) {
  assertTableTileContract({ durationMinutes, guestCount, label, orderCount });

  const visibleLabel = label.trim();
  const stateLabel = tableTileStateLabels[state];
  const showsOperationalMeta = mode === "view" && activeServiceStates.has(state);
  const duration = durationMinutes === undefined ? undefined : formatDuration(durationMinutes);
  const isDisabled = disabled || (mode === "view" && state === "disabled");
  const accessibleParts = [
    visibleLabel,
    stateLabel,
    showsOperationalMeta && guestCount !== undefined ? `${guestCount} tamu` : undefined,
    showsOperationalMeta && orderCount !== undefined ? `${orderCount} order` : undefined,
    showsOperationalMeta && duration ? duration.ariaLabel : undefined,
  ].filter(Boolean);

  return (
    <button
      {...props}
      aria-label={props["aria-label"] ?? accessibleParts.join(", ")}
      aria-pressed={selected}
      className={classes(
        "ui-table-tile",
        `ui-table-tile--${size}`,
        `ui-table-tile--${mode}`,
        `ui-table-tile--${state}`,
        selected && "is-selected",
        className,
      )}
      disabled={isDisabled}
      ref={ref}
      type={props.type ?? "button"}
    >
      <span className="ui-table-tile__header">
        <strong className="ui-table-tile__label">{visibleLabel}</strong>
        <span className="ui-table-tile__status">{stateLabel}</span>
      </span>

      {showsOperationalMeta ? (
        <span className="ui-table-tile__meta">
          {guestCount !== undefined ? (
            <span aria-label={`${guestCount} tamu`} className="ui-table-tile__meta-item">
              <AppIcon icon={Users} size="xs" />
              <span>{guestCount}</span>
            </span>
          ) : null}
          {orderCount !== undefined ? (
            <span aria-label={`${orderCount} order`} className="ui-table-tile__meta-item">
              <AppIcon icon={ReceiptText} size="xs" />
              <span>{orderCount}</span>
            </span>
          ) : null}
          {duration ? (
            <span aria-label={duration.ariaLabel} className="ui-table-tile__meta-item">
              <AppIcon icon={Clock3} size="xs" />
              <span>{duration.label}</span>
            </span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
});
