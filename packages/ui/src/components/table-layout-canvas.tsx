"use client";

import { type CSSProperties, type KeyboardEvent } from "react";
import {
  DragDropProvider,
  PointerSensor,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";
import { Accessibility, PointerActivationConstraints } from "@dnd-kit/dom";
import { IconArrowDown, IconArrowLeft, IconArrowRight, IconArrowUp } from "@tabler/icons-react";

import { AppIcon } from "./app-icon";
import type { TableShapeKind } from "./table-shape";
import {
  TableTile,
  type TableTileMetric,
  type TableTileProps,
  type TableTileState,
} from "./table-tile";

export type TableLayoutCanvasMode = "view" | "edit" | "preview";
/** `fit` takes exactly the grid's size; the others keep a minimum area. */
export type TableLayoutCanvasVariant = "compact" | "default" | "fit" | "wide";

export type TableLayoutGridPosition = {
  gridH: number;
  gridW: number;
  gridX: number;
  gridY: number;
};

export type TableLayoutCanvasItem = TableLayoutGridPosition & {
  capacity?: number;
  disabled?: boolean;
  id: string;
  label: string;
  metrics?: readonly TableTileMetric[];
  shape?: TableShapeKind;
  state?: TableTileState;
  stateLabel?: string;
};

/** Every text the canvas shows or announces; it has none of its own. */
export type TableLayoutCanvasLabels = {
  canvas: string;
  /** The group of arrow buttons that move the selected table. */
  moveGroup: string;
  moveDown: string;
  moveLeft: string;
  moveRight: string;
  moveUp: string;
  /** A table on another, as listed above the canvas. */
  overlap: (first: string, second: string) => string;
  /** How a table and its place are announced, with 1-based column and row. */
  position: (label: string, column: number, row: number, overlapping: boolean) => string;
  /** The heading over the list of overlapping tables. */
  validationTitle: string;
};

export type TableLayoutOverlapIssue = {
  firstId: string;
  firstLabel: string;
  secondId: string;
  secondLabel: string;
};

export type TableLayoutCanvasProps = {
  cellSize?: number;
  className?: string;
  columns: number;
  items: readonly TableLayoutCanvasItem[];
  labels: TableLayoutCanvasLabels;
  mode?: TableLayoutCanvasMode;
  onItemMove?: (itemId: string, position: TableLayoutGridPosition) => void;
  onSelectItem?: (itemId: string) => void;
  rows: number;
  selectedId?: string;
  variant?: TableLayoutCanvasVariant;
};

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertPositiveInteger(value: number, fieldName: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${fieldName} harus berupa safe integer positif.`);
  }
}

function assertNonNegativeInteger(value: number, fieldName: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${fieldName} harus berupa safe integer non-negatif.`);
  }
}

function assertCanvasContract({
  cellSize,
  columns,
  items,
  rows,
}: Pick<TableLayoutCanvasProps, "cellSize" | "columns" | "items" | "rows"> & {
  cellSize: number;
}) {
  assertPositiveInteger(columns, "Jumlah kolom canvas");
  assertPositiveInteger(rows, "Jumlah baris canvas");
  assertPositiveInteger(cellSize, "Ukuran grid canvas");

  const ids = new Set<string>();
  for (const item of items) {
    if (!item.id.trim()) throw new TypeError("Table Layout Canvas memerlukan id internal item.");
    if (ids.has(item.id)) {
      throw new TypeError(`Table Layout Canvas menerima id item duplikat: ${item.id}.`);
    }
    if (!item.label.trim()) throw new TypeError("Table Layout Canvas memerlukan label meja.");

    assertNonNegativeInteger(item.gridX, "Posisi kolom meja");
    assertNonNegativeInteger(item.gridY, "Posisi baris meja");
    assertPositiveInteger(item.gridW, "Lebar grid meja");
    assertPositiveInteger(item.gridH, "Tinggi grid meja");

    if (item.gridX + item.gridW > columns || item.gridY + item.gridH > rows) {
      throw new TypeError("Posisi meja harus berada di dalam batas canvas.");
    }

    ids.add(item.id);
  }
}

export function doTableLayoutItemsOverlap(
  first: TableLayoutGridPosition,
  second: TableLayoutGridPosition,
) {
  return (
    first.gridX < second.gridX + second.gridW &&
    first.gridX + first.gridW > second.gridX &&
    first.gridY < second.gridY + second.gridH &&
    first.gridY + first.gridH > second.gridY
  );
}

export function getTableLayoutOverlapIssues(
  items: readonly TableLayoutCanvasItem[],
): TableLayoutOverlapIssue[] {
  const issues: TableLayoutOverlapIssue[] = [];

  for (let firstIndex = 0; firstIndex < items.length; firstIndex += 1) {
    const first = items[firstIndex];
    if (!first) continue;

    for (let secondIndex = firstIndex + 1; secondIndex < items.length; secondIndex += 1) {
      const second = items[secondIndex];
      if (!second) continue;
      if (!doTableLayoutItemsOverlap(first, second)) continue;

      issues.push({
        firstId: first.id,
        firstLabel: first.label.trim(),
        secondId: second.id,
        secondLabel: second.label.trim(),
      });
    }
  }

  return issues;
}

export function clampTableLayoutPosition(
  position: TableLayoutGridPosition,
  bounds: Pick<TableLayoutCanvasProps, "columns" | "rows">,
): TableLayoutGridPosition {
  const maxGridX = Math.max(0, bounds.columns - position.gridW);
  const maxGridY = Math.max(0, bounds.rows - position.gridH);

  return {
    gridH: position.gridH,
    gridW: position.gridW,
    gridX: Math.min(Math.max(position.gridX, 0), maxGridX),
    gridY: Math.min(Math.max(position.gridY, 0), maxGridY),
  };
}

export function snapTableLayoutPosition(
  position: TableLayoutGridPosition,
  movementPixels: { x: number; y: number },
  options: Pick<TableLayoutCanvasProps, "columns" | "rows"> & { cellSize: number },
): TableLayoutGridPosition {
  const deltaX = Math.round(movementPixels.x / options.cellSize);
  const deltaY = Math.round(movementPixels.y / options.cellSize);

  return clampTableLayoutPosition(
    {
      gridH: position.gridH,
      gridW: position.gridW,
      gridX: position.gridX + deltaX,
      gridY: position.gridY + deltaY,
    },
    options,
  );
}

type TableLayoutCanvasSurfaceProps = {
  cellSize: number;
  columns: number;
  conflictedItemIds: ReadonlySet<string>;
  items: readonly TableLayoutCanvasItem[];
  labels: TableLayoutCanvasLabels;
  mode: TableLayoutCanvasMode;
  onKeyboardMove: ((itemId: string, direction: KeyboardMoveDirection) => void) | undefined;
  onSelectItem: ((itemId: string) => void) | undefined;
  rows: number;
  selectedId: string | undefined;
};

type KeyboardMoveDirection = "down" | "left" | "right" | "up";

function TableLayoutCanvasSurface({
  cellSize,
  columns,
  conflictedItemIds,
  items,
  labels,
  mode,
  onKeyboardMove,
  onSelectItem,
  rows,
  selectedId,
}: TableLayoutCanvasSurfaceProps) {
  const { isDropTarget, ref } = useDroppable({
    id: "table-layout-canvas",
  });

  const surfaceStyle = {
    "--ui-table-layout-canvas-cell": `${cellSize}px`,
    "--ui-table-layout-canvas-columns": columns,
    "--ui-table-layout-canvas-rows": rows,
  } as CSSProperties;

  return (
    <div
      aria-label={labels.canvas}
      className={classes("ui-table-layout-canvas__surface", isDropTarget && "is-drop-target")}
      ref={ref}
      role="group"
      style={surfaceStyle}
    >
      {items.map((item) => (
        <TableLayoutCanvasItem
          conflicted={conflictedItemIds.has(item.id)}
          item={item}
          key={item.id}
          labels={labels}
          mode={mode}
          onKeyboardMove={onKeyboardMove}
          onSelectItem={onSelectItem}
          selected={item.id === selectedId}
        />
      ))}
    </div>
  );
}

function TableLayoutCanvasItem({
  conflicted,
  item,
  labels,
  mode,
  onKeyboardMove,
  onSelectItem,
  selected,
}: {
  conflicted: boolean;
  item: TableLayoutCanvasItem;
  labels: TableLayoutCanvasLabels;
  mode: TableLayoutCanvasMode;
  onKeyboardMove: ((itemId: string, direction: KeyboardMoveDirection) => void) | undefined;
  onSelectItem: ((itemId: string) => void) | undefined;
  selected: boolean;
}) {
  const canDrag = mode === "edit" && !item.disabled;
  const { handleRef, isDragging, ref } = useDraggable({
    data: { type: "table-layout-item" },
    disabled: !canDrag,
    id: item.id,
  });
  const itemStyle = {
    gridColumn: `${item.gridX + 1} / span ${item.gridW}`,
    gridRow: `${item.gridY + 1} / span ${item.gridH}`,
  };
  const tileProps: TableTileProps = {
    "aria-invalid": conflicted || undefined,
    // While editing, a table is found by where it stands; otherwise the tile
    // names itself with its status and service numbers.
    ...(mode === "edit"
      ? {
          "aria-label": labels.position(
            item.label.trim(),
            item.gridX + 1,
            item.gridY + 1,
            conflicted,
          ),
        }
      : {}),
    footprint: { height: item.gridH, width: item.gridW },
    label: item.label,
    mode: mode === "edit" ? "edit" : "view",
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (mode !== "edit" || !selected || item.disabled) return;
      const directionByKey: Partial<Record<string, KeyboardMoveDirection>> = {
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
      };
      const direction = directionByKey[event.key];
      if (!direction) return;
      event.preventDefault();
      onKeyboardMove?.(item.id, direction);
    },
    onClick: () => onSelectItem?.(item.id),
    selected,
  };

  if (item.capacity !== undefined) tileProps.capacity = item.capacity;
  if (item.disabled !== undefined) tileProps.disabled = item.disabled;
  if (item.metrics !== undefined) tileProps.metrics = item.metrics;
  if (item.shape !== undefined) tileProps.shape = item.shape;
  if (item.state !== undefined) tileProps.state = item.state;
  if (item.stateLabel !== undefined) tileProps.stateLabel = item.stateLabel;

  return (
    <div
      className={classes(
        "ui-table-layout-canvas__item",
        conflicted && "has-conflict",
        isDragging && "is-dragging",
      )}
      ref={ref}
      style={itemStyle}
    >
      <TableTile {...tileProps} ref={handleRef} />
    </div>
  );
}

function TableLayoutKeyboardControls({
  disabled,
  labels,
  onMove,
}: {
  disabled: boolean;
  labels: TableLayoutCanvasLabels;
  onMove: (direction: KeyboardMoveDirection) => void;
}) {
  return (
    <div
      aria-label={labels.moveGroup}
      className="ui-table-layout-canvas__keyboard-controls"
      role="group"
    >
      <button
        aria-label={labels.moveUp}
        disabled={disabled}
        onClick={() => onMove("up")}
        type="button"
      >
        <AppIcon icon={IconArrowUp} size="sm" />
      </button>
      <button
        aria-label={labels.moveLeft}
        disabled={disabled}
        onClick={() => onMove("left")}
        type="button"
      >
        <AppIcon icon={IconArrowLeft} size="sm" />
      </button>
      <button
        aria-label={labels.moveRight}
        disabled={disabled}
        onClick={() => onMove("right")}
        type="button"
      >
        <AppIcon icon={IconArrowRight} size="sm" />
      </button>
      <button
        aria-label={labels.moveDown}
        disabled={disabled}
        onClick={() => onMove("down")}
        type="button"
      >
        <AppIcon icon={IconArrowDown} size="sm" />
      </button>
    </div>
  );
}

export function TableLayoutCanvas({
  cellSize = 48,
  className,
  columns,
  items,
  labels,
  mode = "view",
  onItemMove,
  onSelectItem,
  rows,
  selectedId,
  variant = "default",
}: TableLayoutCanvasProps) {
  assertCanvasContract({ cellSize, columns, items, rows });
  const overlapIssues = getTableLayoutOverlapIssues(items);
  const conflictedItemIds = new Set(
    overlapIssues.flatMap((issue) => [issue.firstId, issue.secondId]),
  );
  const selectedItem = selectedId ? items.find((item) => item.id === selectedId) : undefined;
  const canMoveSelected = mode === "edit" && selectedItem !== undefined && !selectedItem.disabled;

  function handleDragEnd(event: DragEndEvent) {
    if (event.canceled || mode !== "edit") return;

    const sourceId = event.operation.source?.id;
    const sourceItem = items.find((item) => item.id === String(sourceId));
    if (!sourceItem) return;

    const nextPosition = snapTableLayoutPosition(sourceItem, event.operation.transform, {
      cellSize,
      columns,
      rows,
    });

    if (nextPosition.gridX === sourceItem.gridX && nextPosition.gridY === sourceItem.gridY) return;
    onItemMove?.(sourceItem.id, nextPosition);
  }

  function moveItemByKeyboard(itemId: string, direction: KeyboardMoveDirection) {
    const sourceItem = items.find((item) => item.id === itemId);
    if (mode !== "edit" || !sourceItem || sourceItem.disabled) return;

    const nextPosition = clampTableLayoutPosition(
      {
        gridH: sourceItem.gridH,
        gridW: sourceItem.gridW,
        gridX: sourceItem.gridX + (direction === "left" ? -1 : direction === "right" ? 1 : 0),
        gridY: sourceItem.gridY + (direction === "up" ? -1 : direction === "down" ? 1 : 0),
      },
      { columns, rows },
    );

    if (nextPosition.gridX === sourceItem.gridX && nextPosition.gridY === sourceItem.gridY) {
      return;
    }

    onItemMove?.(sourceItem.id, nextPosition);
  }

  function moveSelectedItem(direction: KeyboardMoveDirection) {
    if (!selectedItem) return;
    moveItemByKeyboard(selectedItem.id, direction);
  }

  return (
    <div
      className={classes(
        "ui-table-layout-canvas",
        `ui-table-layout-canvas--${variant}`,
        `ui-table-layout-canvas--${mode}`,
        className,
      )}
    >
      {mode === "edit" ? (
        <TableLayoutKeyboardControls
          disabled={!canMoveSelected}
          labels={labels}
          onMove={moveSelectedItem}
        />
      ) : null}

      {overlapIssues.length > 0 ? (
        <div aria-live="polite" className="ui-table-layout-canvas__validation" role="status">
          <strong>{labels.validationTitle}</strong>
          <ul>
            {overlapIssues.map((issue) => (
              <li key={`${issue.firstId}-${issue.secondId}`}>
                {labels.overlap(issue.firstLabel, issue.secondLabel)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <DragDropProvider
        onDragEnd={handleDragEnd}
        plugins={(defaults) => defaults.filter((plugin) => plugin !== Accessibility)}
        // A press that does not travel is a click that selects the table.
        // Keys are handled by the tiles themselves: Enter or Space selects,
        // the arrows move the selected table one cell.
        sensors={[
          PointerSensor.configure({
            activationConstraints: [new PointerActivationConstraints.Distance({ value: 5 })],
          }),
        ]}
      >
        <TableLayoutCanvasSurface
          cellSize={cellSize}
          columns={columns}
          conflictedItemIds={conflictedItemIds}
          items={items}
          labels={labels}
          mode={mode}
          onKeyboardMove={moveItemByKeyboard}
          onSelectItem={onSelectItem}
          rows={rows}
          selectedId={selectedId}
        />
      </DragDropProvider>
    </div>
  );
}
