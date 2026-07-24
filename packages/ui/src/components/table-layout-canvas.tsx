"use client";

import { type CSSProperties, type KeyboardEvent } from "react";
import {
  DragDropProvider,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";
import { Accessibility } from "@dnd-kit/dom";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";

import { AppIcon } from "./app-icon";
import { TableTile, type TableTileProps, type TableTileState } from "./table-tile";

export type TableLayoutCanvasMode = "view" | "edit" | "preview";
export type TableLayoutCanvasVariant = "compact" | "default" | "wide";

export type TableLayoutGridPosition = {
  gridH: number;
  gridW: number;
  gridX: number;
  gridY: number;
};

export type TableLayoutCanvasItem = TableLayoutGridPosition & {
  disabled?: boolean;
  durationMinutes?: number;
  guestCount?: number;
  id: string;
  label: string;
  orderCount?: number;
  state?: TableTileState;
};

export type TableLayoutOverlapIssue = {
  firstId: string;
  firstLabel: string;
  secondId: string;
  secondLabel: string;
};

export type TableLayoutCanvasProps = {
  ariaLabel?: string;
  cellSize?: number;
  className?: string;
  columns: number;
  items: readonly TableLayoutCanvasItem[];
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
  ariaLabel: string;
  cellSize: number;
  columns: number;
  conflictedItemIds: ReadonlySet<string>;
  items: readonly TableLayoutCanvasItem[];
  mode: TableLayoutCanvasMode;
  onKeyboardMove: ((itemId: string, direction: KeyboardMoveDirection) => void) | undefined;
  onSelectItem: ((itemId: string) => void) | undefined;
  rows: number;
  selectedId: string | undefined;
};

type KeyboardMoveDirection = "down" | "left" | "right" | "up";

function TableLayoutCanvasSurface({
  ariaLabel,
  cellSize,
  columns,
  conflictedItemIds,
  items,
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
      aria-label={ariaLabel}
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
  mode,
  onKeyboardMove,
  onSelectItem,
  selected,
}: {
  conflicted: boolean;
  item: TableLayoutCanvasItem;
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
  const humanPosition = `kolom ${item.gridX + 1}, baris ${item.gridY + 1}`;
  const tileProps: TableTileProps = {
    "aria-invalid": conflicted || undefined,
    "aria-label": conflicted
      ? `${item.label.trim()}, posisi ${humanPosition}, bertumpuk`
      : `${item.label.trim()}, posisi ${humanPosition}`,
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

  if (item.disabled !== undefined) tileProps.disabled = item.disabled;
  if (item.durationMinutes !== undefined) tileProps.durationMinutes = item.durationMinutes;
  if (item.guestCount !== undefined) tileProps.guestCount = item.guestCount;
  if (item.orderCount !== undefined) tileProps.orderCount = item.orderCount;
  if (item.state !== undefined) tileProps.state = item.state;

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
  onMove,
}: {
  disabled: boolean;
  onMove: (direction: KeyboardMoveDirection) => void;
}) {
  return (
    <div
      aria-label="Pindahkan meja terpilih"
      className="ui-table-layout-canvas__keyboard-controls"
      role="group"
    >
      <button
        aria-label="Pindahkan meja ke atas"
        disabled={disabled}
        onClick={() => onMove("up")}
        type="button"
      >
        <AppIcon icon={ArrowUp} size="sm" />
      </button>
      <button
        aria-label="Pindahkan meja ke kiri"
        disabled={disabled}
        onClick={() => onMove("left")}
        type="button"
      >
        <AppIcon icon={ArrowLeft} size="sm" />
      </button>
      <button
        aria-label="Pindahkan meja ke kanan"
        disabled={disabled}
        onClick={() => onMove("right")}
        type="button"
      >
        <AppIcon icon={ArrowRight} size="sm" />
      </button>
      <button
        aria-label="Pindahkan meja ke bawah"
        disabled={disabled}
        onClick={() => onMove("down")}
        type="button"
      >
        <AppIcon icon={ArrowDown} size="sm" />
      </button>
    </div>
  );
}

export function TableLayoutCanvas({
  ariaLabel = "Canvas layout meja",
  cellSize = 48,
  className,
  columns,
  items,
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
        <TableLayoutKeyboardControls disabled={!canMoveSelected} onMove={moveSelectedItem} />
      ) : null}

      {overlapIssues.length > 0 ? (
        <div
          aria-label="Validasi layout meja"
          aria-live="polite"
          className="ui-table-layout-canvas__validation"
          role="status"
        >
          <strong>Layout perlu diperiksa</strong>
          <ul>
            {overlapIssues.map((issue) => (
              <li key={`${issue.firstId}-${issue.secondId}`}>
                {issue.firstLabel} bertumpuk dengan {issue.secondLabel}.
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <DragDropProvider
        onDragEnd={handleDragEnd}
        plugins={(defaults) => defaults.filter((plugin) => plugin !== Accessibility)}
        sensors={[
          PointerSensor,
          KeyboardSensor.configure({ offset: { x: cellSize, y: cellSize } }),
        ]}
      >
        <TableLayoutCanvasSurface
          ariaLabel={ariaLabel}
          cellSize={cellSize}
          columns={columns}
          conflictedItemIds={conflictedItemIds}
          items={items}
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
