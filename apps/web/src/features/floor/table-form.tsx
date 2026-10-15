"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import type {
  FloorArea,
  FloorTable,
  FloorTableRotation,
  FloorTableShape,
  FloorTableSize,
} from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { FormField, Input } from "@merchant/ui/form-field";
import { Select } from "@merchant/ui/select";
import { QuantityStepper, SegmentedControl, Switch } from "@merchant/ui/selection-control";

import { Labeled } from "./labeled";
import type { Grid, TableEdit } from "./layout-draft";

export const SHAPES: readonly FloorTableShape[] = ["SQUARE", "RECTANGLE", "ROUND"];
export const SIZES: readonly FloorTableSize[] = ["SMALL", "MEDIUM", "LARGE"];

/**
 * Everything about one table that the editor may change. Every change goes
 * straight into the unsaved layout, so the canvas shows it at once; nothing
 * is written before "Save layout". The footprint is not a field: it follows
 * from shape, size, and turn.
 */
export function TableForm({
  areas,
  grid,
  onChange,
  onPlace,
  table,
}: Readonly<{
  /** The areas of the table's floor that a table may stand in. */
  areas: readonly FloorArea[];
  grid: Grid;
  onChange: (edit: TableEdit) => void;
  onPlace: () => void;
  table: FloorTable;
}>) {
  const t = useTranslations("floor");
  const labelId = useId();
  const placed = table.gridX !== null && table.gridY !== null;
  const labelError = table.label.trim() ? undefined : t("labelRequired");

  return (
    <div className="grid gap-4">
      <FormField
        {...(labelError ? { error: labelError } : {})}
        htmlFor={labelId}
        label={t("tableLabel")}
      >
        <Input
          id={labelId}
          maxLength={20}
          onChange={(event) => onChange({ label: event.target.value })}
          value={table.label}
        />
      </FormField>
      <Labeled label={t("capacity")}>
        <QuantityStepper
          decreaseLabel={t("capacityDown")}
          increaseLabel={t("capacityUp")}
          label={t("capacity")}
          max={50}
          min={1}
          onValueChange={(capacity) => onChange({ capacity })}
          value={table.capacity}
        />
      </Labeled>
      <Labeled label={t("shape")}>
        <SegmentedControl
          items={SHAPES.map((shape) => ({ label: t(`shapes.${shape}`), value: shape }))}
          label={t("shape")}
          onValueChange={(shape) => onChange({ shape: shape as FloorTableShape })}
          value={table.shape}
        />
      </Labeled>
      <Labeled label={t("size")}>
        <SegmentedControl
          items={SIZES.map((size) => ({ label: t(`sizes.${size}`), value: size }))}
          label={t("size")}
          onValueChange={(visualSize) => onChange({ visualSize: visualSize as FloorTableSize })}
          value={table.visualSize}
        />
      </Labeled>
      {/* Square and round tables look the same turned. */}
      {table.shape === "RECTANGLE" ? (
        <Labeled label={t("rotation")}>
          <SegmentedControl
            items={[
              { label: t("rotations.0"), value: "0" },
              { label: t("rotations.90"), value: "90" },
            ]}
            label={t("rotation")}
            onValueChange={(value) => onChange({ rotation: Number(value) as FloorTableRotation })}
            value={String(table.rotation)}
          />
        </Labeled>
      ) : null}
      <Labeled label={t("area")}>
        <Select
          emptyLabel={t("noArea")}
          label={t("area")}
          onValueChange={(areaId) => onChange({ areaId })}
          options={areas.map((area) => ({ label: area.name, value: area.id }))}
          placeholder={t("chooseArea")}
          value={table.areaId}
        />
      </Labeled>
      {placed ? (
        <div className="grid grid-cols-2 gap-3">
          <Labeled label={t("column")}>
            <QuantityStepper
              decreaseLabel={t("moveLeft")}
              increaseLabel={t("moveRight")}
              label={t("column")}
              max={grid.cols - table.gridW + 1}
              min={1}
              onValueChange={(column) => onChange({ gridX: column - 1 })}
              value={(table.gridX ?? 0) + 1}
            />
          </Labeled>
          <Labeled label={t("row")}>
            <QuantityStepper
              decreaseLabel={t("moveUp")}
              increaseLabel={t("moveDown")}
              label={t("row")}
              max={grid.rows - table.gridH + 1}
              min={1}
              onValueChange={(row) => onChange({ gridY: row - 1 })}
              value={(table.gridY ?? 0) + 1}
            />
          </Labeled>
        </div>
      ) : null}
      <Switch
        checked={table.qrOrdering}
        label={t("qrOrdering")}
        onChange={(event) => onChange({ qrOrdering: event.target.checked })}
      />
      <Switch
        checked={table.status === "ACTIVE"}
        label={t("tableActive")}
        onChange={(event) => onChange({ status: event.target.checked ? "ACTIVE" : "INACTIVE" })}
      />
      <div>
        {placed ? (
          <Button
            onClick={() => onChange({ gridX: null, gridY: null })}
            size="sm"
            variant="secondary"
          >
            {t("unplace")}
          </Button>
        ) : (
          <Button onClick={onPlace} size="sm" variant="secondary">
            {t("place")}
          </Button>
        )}
      </div>
    </div>
  );
}
