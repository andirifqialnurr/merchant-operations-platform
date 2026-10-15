"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { IconClock, IconReceipt, IconUsers } from "@tabler/icons-react";

import { AppIcon } from "./app-icon";
import { TableShape, type TableShapeKind } from "./table-shape";

export type TableTileMode = "view" | "edit";
export type TableTileSize = "sm" | "md" | "lg";
export type TableTileState =
  | "available"
  | "occupied"
  | "closing"
  | "cleaning"
  | "waiting-order"
  | "waiting-payment"
  | "needs-service"
  | "reserved"
  | "disabled";

export type TableTileMetricKind = "duration" | "guests" | "orders";

/** A number about the service at the table, written by the caller: "4" read as "4 guests". */
export type TableTileMetric = { kind: TableTileMetricKind; label: string; text: string };

export type TableTileProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  /** The table's capacity; draws the chairs when `shape` is given. */
  capacity?: number;
  /** The footprint in grid cells, for the drawn table. Defaults to a single square. */
  footprint?: { height: number; width: number };
  label: string;
  /** Shown only in view mode while a table is being served. */
  metrics?: readonly TableTileMetric[];
  mode?: TableTileMode;
  selected?: boolean;
  /** Draws the table from above instead of a card. */
  shape?: TableShapeKind;
  size?: TableTileSize;
  state?: TableTileState;
  /**
   * The status in words, so it is never told by color alone. Shown in view
   * mode, and in edit mode only for a table that is set aside.
   */
  stateLabel?: string;
};

const activeServiceStates = new Set<TableTileState>([
  "occupied",
  "closing",
  "waiting-order",
  "waiting-payment",
  "needs-service",
]);

const metricIcons = { duration: IconClock, guests: IconUsers, orders: IconReceipt } as const;

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertTableTileContract({
  capacity,
  label,
  metrics,
}: {
  capacity: number | undefined;
  label: string;
  metrics: readonly TableTileMetric[] | undefined;
}) {
  if (!label.trim()) throw new TypeError("Table Tile memerlukan label meja yang terlihat.");
  if (capacity !== undefined && (!Number.isSafeInteger(capacity) || capacity < 0)) {
    throw new TypeError("Kapasitas meja harus berupa safe integer non-negatif.");
  }
  for (const metric of metrics ?? []) {
    if (!metric.text.trim() || !metric.label.trim()) {
      throw new TypeError("Metrik meja memerlukan teks dan label.");
    }
  }
}

export const TableTile = forwardRef<HTMLButtonElement, TableTileProps>(function TableTile(
  {
    capacity,
    className,
    disabled,
    footprint = { height: 1, width: 1 },
    label,
    metrics,
    mode = "view",
    selected = false,
    shape,
    size = "md",
    state = "available",
    stateLabel,
    ...props
  },
  ref,
) {
  assertTableTileContract({ capacity, label, metrics });

  const visibleLabel = label.trim();
  const showsState =
    stateLabel !== undefined && (mode === "view" || state === "disabled") && !!stateLabel.trim();
  const shownMetrics =
    mode === "view" && activeServiceStates.has(state) ? (metrics ?? []) : ([] as const);
  const isDisabled = disabled || (mode === "view" && state === "disabled");
  const accessibleName = [
    visibleLabel,
    showsState ? stateLabel?.trim() : undefined,
    ...shownMetrics.map((metric) => metric.label.trim()),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      {...props}
      aria-label={props["aria-label"] ?? accessibleName}
      aria-pressed={selected}
      className={classes(
        "ui-table-tile",
        `ui-table-tile--${size}`,
        `ui-table-tile--${mode}`,
        `ui-table-tile--${state}`,
        shape && "ui-table-tile--shaped",
        selected && "is-selected",
        className,
      )}
      disabled={isDisabled}
      ref={ref}
      type={props.type ?? "button"}
    >
      {shape ? (
        <TableShape
          capacity={capacity ?? 0}
          className="ui-table-tile__shape"
          footprint={footprint}
          shape={shape}
        />
      ) : null}
      <span className="ui-table-tile__header">
        <strong className="ui-table-tile__label">{visibleLabel}</strong>
        {showsState ? <span className="ui-table-tile__status">{stateLabel?.trim()}</span> : null}
      </span>

      {shownMetrics.length > 0 ? (
        <span className="ui-table-tile__meta">
          {shownMetrics.map((metric) => (
            <span
              aria-label={metric.label.trim()}
              className="ui-table-tile__meta-item"
              key={metric.kind}
            >
              <AppIcon icon={metricIcons[metric.kind]} size="xs" />
              <span>{metric.text.trim()}</span>
            </span>
          ))}
        </span>
      ) : null}
    </button>
  );
});
