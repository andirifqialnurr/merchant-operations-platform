"use client";

import { type ChangeEvent } from "react";
import {
  IconEye,
  IconGridDots,
  IconHandStop,
  IconPencil,
  IconPointer,
  IconScan,
} from "@tabler/icons-react";

import { AppIcon } from "./app-icon";
import type { TableLayoutCanvasMode, TableLayoutGridPosition } from "./table-layout-canvas";

export type TableLayoutToolbarTool = "select" | "move";
export type TableLayoutPropertyPanelItem = TableLayoutGridPosition & {
  id: string;
  label: string;
};

/** Every text the toolbar shows or announces; it has none of its own. */
export type TableLayoutToolbarLabels = {
  modeGroup: string;
  modes: Record<TableLayoutCanvasMode, string>;
  snap: string;
  toolGroup: string;
  tools: Record<TableLayoutToolbarTool, string>;
};

export type TableLayoutToolbarProps = {
  className?: string;
  disabled?: boolean;
  labels: TableLayoutToolbarLabels;
  mode: TableLayoutCanvasMode;
  onModeChange?: (mode: TableLayoutCanvasMode) => void;
  onSnapToGridChange?: (enabled: boolean) => void;
  onToolChange?: (tool: TableLayoutToolbarTool) => void;
  snapToGrid?: boolean;
  tool?: TableLayoutToolbarTool;
};

/** Every text the panel shows or announces; it has none of its own. */
export type TableLayoutPropertyPanelLabels = {
  column: string;
  /** Shown while no table is selected. */
  empty: string;
  height: string;
  panel: string;
  row: string;
  selected: string;
  width: string;
};

export type TableLayoutPropertyPanelProps = {
  className?: string;
  columns: number;
  disabled?: boolean;
  item?: TableLayoutPropertyPanelItem | null;
  labels: TableLayoutPropertyPanelLabels;
  onItemChange?: (itemId: string, position: TableLayoutGridPosition) => void;
  rows: number;
};

const modeOptions: Array<{ icon: typeof IconEye; value: TableLayoutCanvasMode }> = [
  { icon: IconEye, value: "view" },
  { icon: IconPencil, value: "edit" },
  { icon: IconScan, value: "preview" },
];

const toolOptions: Array<{ icon: typeof IconPointer; value: TableLayoutToolbarTool }> = [
  { icon: IconPointer, value: "select" },
  { icon: IconHandStop, value: "move" },
];

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertPositiveInteger(value: number, fieldName: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${fieldName} harus berupa safe integer positif.`);
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function parsePositiveInteger(value: string) {
  const parsed = Number(value.replace(/[^0-9]/g, ""));
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function assertPropertyPanelContract({
  columns,
  item,
  rows,
}: {
  columns: number;
  item: TableLayoutPropertyPanelItem | null | undefined;
  rows: number;
}) {
  assertPositiveInteger(columns, "Jumlah kolom canvas");
  assertPositiveInteger(rows, "Jumlah baris canvas");

  if (!item) return;
  if (!item.id.trim()) throw new TypeError("Property Panel memerlukan id internal item.");
  if (!item.label.trim()) throw new TypeError("Property Panel memerlukan label meja.");
  assertPositiveInteger(item.gridW, "Lebar grid meja");
  assertPositiveInteger(item.gridH, "Tinggi grid meja");

  if (!Number.isSafeInteger(item.gridX) || item.gridX < 0) {
    throw new TypeError("Kolom meja harus berupa safe integer non-negatif.");
  }
  if (!Number.isSafeInteger(item.gridY) || item.gridY < 0) {
    throw new TypeError("Baris meja harus berupa safe integer non-negatif.");
  }
  if (item.gridX + item.gridW > columns || item.gridY + item.gridH > rows) {
    throw new TypeError("Properti meja harus berada di dalam batas canvas.");
  }
}

export function TableLayoutToolbar({
  className,
  disabled = false,
  labels,
  mode,
  onModeChange,
  onSnapToGridChange,
  onToolChange,
  snapToGrid = true,
  tool = "select",
}: TableLayoutToolbarProps) {
  return (
    <div className={classes("ui-table-layout-toolbar", className)} role="toolbar">
      <div
        aria-label={labels.modeGroup}
        className="ui-table-layout-toolbar__segment"
        role="radiogroup"
      >
        {modeOptions.map((option) => (
          <button
            aria-checked={mode === option.value}
            className="ui-table-layout-toolbar__segment-item"
            disabled={disabled}
            key={option.value}
            onClick={() => onModeChange?.(option.value)}
            role="radio"
            tabIndex={mode === option.value ? 0 : -1}
            type="button"
          >
            <AppIcon icon={option.icon} size="sm" />
            <span>{labels.modes[option.value]}</span>
          </button>
        ))}
      </div>

      <div aria-label={labels.toolGroup} className="ui-table-layout-toolbar__tools">
        {toolOptions.map((option) => (
          <button
            aria-pressed={tool === option.value}
            className="ui-table-layout-toolbar__tool"
            disabled={disabled}
            key={option.value}
            onClick={() => onToolChange?.(option.value)}
            title={labels.tools[option.value]}
            type="button"
          >
            <AppIcon icon={option.icon} size="sm" />
            <span className="ui-table-layout-toolbar__sr">{labels.tools[option.value]}</span>
          </button>
        ))}
      </div>

      <label className="ui-table-layout-toolbar__switch">
        <input
          checked={snapToGrid}
          disabled={disabled}
          onChange={(event) => onSnapToGridChange?.(event.target.checked)}
          type="checkbox"
        />
        <span aria-hidden="true" className="ui-table-layout-toolbar__switch-track">
          <span className="ui-table-layout-toolbar__switch-thumb" />
        </span>
        <span>
          <AppIcon icon={IconGridDots} size="sm" />
          {labels.snap}
        </span>
      </label>
    </div>
  );
}

function PropertyNumberField({
  disabled,
  label,
  max,
  min = 1,
  onValueChange,
  value,
}: {
  disabled: boolean;
  label: string;
  max: number;
  min?: number;
  onValueChange: (value: number) => void;
  value: number;
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const parsed = parsePositiveInteger(event.target.value);
    if (parsed === undefined) return;
    onValueChange(clamp(parsed, min, max));
  }

  return (
    <label className="ui-table-layout-property-panel__field">
      <span>{label}</span>
      <input
        disabled={disabled}
        inputMode="numeric"
        max={max}
        min={min}
        onChange={handleChange}
        type="text"
        value={value}
      />
    </label>
  );
}

export function TableLayoutPropertyPanel({
  className,
  columns,
  disabled = false,
  item,
  labels,
  onItemChange,
  rows,
}: TableLayoutPropertyPanelProps) {
  assertPropertyPanelContract({ columns, item, rows });

  if (!item) {
    return (
      <aside className={classes("ui-table-layout-property-panel", className)} role="complementary">
        <p className="ui-table-layout-property-panel__empty" role="status">
          {labels.empty}
        </p>
      </aside>
    );
  }

  const maxColumn = columns - item.gridW + 1;
  const maxRow = rows - item.gridH + 1;
  const maxWidth = columns - item.gridX;
  const maxHeight = rows - item.gridY;

  function update(nextPosition: TableLayoutGridPosition) {
    if (!item || disabled) return;
    onItemChange?.(item.id, {
      gridH: nextPosition.gridH,
      gridW: nextPosition.gridW,
      gridX: nextPosition.gridX,
      gridY: nextPosition.gridY,
    });
  }

  return (
    <aside
      aria-label={labels.panel}
      className={classes("ui-table-layout-property-panel", className)}
      role="complementary"
    >
      <header className="ui-table-layout-property-panel__header">
        <span>{labels.selected}</span>
        <strong>{item.label.trim()}</strong>
      </header>

      <div className="ui-table-layout-property-panel__grid">
        <PropertyNumberField
          disabled={disabled}
          label={labels.column}
          max={maxColumn}
          onValueChange={(value) =>
            update({ ...item, gridX: clamp(value - 1, 0, columns - item.gridW) })
          }
          value={item.gridX + 1}
        />
        <PropertyNumberField
          disabled={disabled}
          label={labels.row}
          max={maxRow}
          onValueChange={(value) =>
            update({ ...item, gridY: clamp(value - 1, 0, rows - item.gridH) })
          }
          value={item.gridY + 1}
        />
        <PropertyNumberField
          disabled={disabled}
          label={labels.width}
          max={maxWidth}
          onValueChange={(value) => update({ ...item, gridW: clamp(value, 1, maxWidth) })}
          value={item.gridW}
        />
        <PropertyNumberField
          disabled={disabled}
          label={labels.height}
          max={maxHeight}
          onValueChange={(value) => update({ ...item, gridH: clamp(value, 1, maxHeight) })}
          value={item.gridH}
        />
      </div>
    </aside>
  );
}
