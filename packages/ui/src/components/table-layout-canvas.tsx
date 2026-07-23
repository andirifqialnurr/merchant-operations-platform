"use client";

import { type CSSProperties } from "react";
import {
  DragDropProvider,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";
import { Accessibility } from "@dnd-kit/dom";

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
  items: readonly TableLayoutCanvasItem[];
  mode: TableLayoutCanvasMode;
  onSelectItem: ((itemId: string) => void) | undefined;
  rows: number;
  selectedId: string | undefined;
};

function TableLayoutCanvasSurface({
  ariaLabel,
  cellSize,
  columns,
  items,
  mode,
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
          item={item}
          key={item.id}
          mode={mode}
          onSelectItem={onSelectItem}
          selected={item.id === selectedId}
        />
      ))}
    </div>
  );
}

function TableLayoutCanvasItem({
  item,
  mode,
  onSelectItem,
  selected,
}: {
  item: TableLayoutCanvasItem;
  mode: TableLayoutCanvasMode;
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
    "aria-label": `${item.label.trim()}, posisi ${humanPosition}`,
    label: item.label,
    mode: mode === "edit" ? "edit" : "view",
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
      className={classes("ui-table-layout-canvas__item", isDragging && "is-dragging")}
      ref={ref}
      style={itemStyle}
    >
      <TableTile {...tileProps} ref={handleRef} />
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

  return (
    <div
      className={classes(
        "ui-table-layout-canvas",
        `ui-table-layout-canvas--${variant}`,
        `ui-table-layout-canvas--${mode}`,
        className,
      )}
    >
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
          items={items}
          mode={mode}
          onSelectItem={onSelectItem}
          rows={rows}
          selectedId={selectedId}
        />
      </DragDropProvider>
    </div>
  );
}
