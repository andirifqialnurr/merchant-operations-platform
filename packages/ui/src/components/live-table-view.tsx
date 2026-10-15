"use client";

import {
  TableLayoutCanvas,
  type TableLayoutCanvasItem,
  type TableLayoutCanvasLabels,
} from "./table-layout-canvas";
import { TableTile } from "./table-tile";

/** A table as the live view shows it; without a place it appears in the list only. */
export type LiveTableViewItem = Omit<TableLayoutCanvasItem, "gridX" | "gridY"> & {
  gridX: number | null;
  gridY: number | null;
};

export type LiveTableViewProps = {
  cellSize?: number;
  columns: number;
  items: readonly LiveTableViewItem[];
  /** The canvas's words, and the name of the list. */
  labels: TableLayoutCanvasLabels & { list: string };
  /** `plan` draws the floor; `list` lines the tables up for small screens. */
  layout: "list" | "plan";
  onSelectItem: (itemId: string) => void;
  rows: number;
  selectedId?: string;
};

/**
 * The tables of a floor as they are right now, for staff serving guests.
 * Status is written on every table, never told by color alone. Choosing a
 * table only selects it; what happens next belongs to the caller.
 */
export function LiveTableView({
  cellSize = 40,
  columns,
  items,
  labels,
  layout,
  onSelectItem,
  rows,
  selectedId,
}: LiveTableViewProps) {
  if (layout === "list") {
    return (
      <ul aria-label={labels.list} className="ui-live-table-view__list">
        {items.map((item) => {
          const { disabled, id, label, metrics, state, stateLabel } = item;
          return (
            <li key={id}>
              <TableTile
                label={label}
                {...(disabled !== undefined ? { disabled } : {})}
                {...(metrics ? { metrics } : {})}
                {...(state ? { state } : {})}
                {...(stateLabel !== undefined ? { stateLabel } : {})}
                mode="view"
                onClick={() => onSelectItem(id)}
                selected={id === selectedId}
                size="lg"
              />
            </li>
          );
        })}
      </ul>
    );
  }

  const placed = items.flatMap((item) =>
    item.gridX === null || item.gridY === null
      ? []
      : [{ ...item, gridX: item.gridX, gridY: item.gridY }],
  );
  return (
    <TableLayoutCanvas
      cellSize={cellSize}
      columns={columns}
      items={placed}
      labels={labels}
      mode="view"
      onSelectItem={onSelectItem}
      rows={rows}
      {...(selectedId ? { selectedId } : {})}
      variant="fit"
    />
  );
}
