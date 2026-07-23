"use client";

import { type KeyboardEvent, useRef } from "react";

import { Select } from "./select";

export type FloorSelectorVariant = "tabs" | "select" | "compact";
export type FloorSelectorSize = "sm" | "md" | "lg";

export type FloorSelectorItem = {
  disabled?: boolean;
  id: string;
  label: string;
  tableCount?: number;
};

export type FloorSelectorProps = {
  activeId: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  emptyLabel?: string;
  floors: readonly FloorSelectorItem[];
  onValueChange: (floorId: string) => void;
  size?: FloorSelectorSize;
  variant?: FloorSelectorVariant;
};

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assertFloorContract(floors: readonly FloorSelectorItem[]) {
  const ids = new Set<string>();

  for (const floor of floors) {
    if (!floor.id.trim()) throw new TypeError("Floor Selector memerlukan id internal.");
    if (!floor.label.trim()) throw new TypeError("Floor Selector memerlukan label yang terlihat.");
    if (ids.has(floor.id)) throw new TypeError(`Floor Selector menerima id duplikat: ${floor.id}.`);
    if (
      floor.tableCount !== undefined &&
      (!Number.isSafeInteger(floor.tableCount) || floor.tableCount < 0)
    ) {
      throw new TypeError("Jumlah meja harus berupa safe integer non-negatif.");
    }
    ids.add(floor.id);
  }
}

export function FloorSelector({
  activeId,
  ariaLabel = "Pilih lantai",
  className,
  disabled = false,
  emptyLabel = "Belum ada lantai.",
  floors,
  onValueChange,
  size = "md",
  variant = "tabs",
}: FloorSelectorProps) {
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  assertFloorContract(floors);

  if (floors.length === 0) {
    return (
      <p className={classes("ui-floor-selector__empty", className)} role="status">
        {emptyLabel}
      </p>
    );
  }

  if (variant === "select" || variant === "compact") {
    return (
      <Select
        className={classes(
          "ui-floor-selector",
          `ui-floor-selector--${variant}`,
          `ui-floor-selector--${size}`,
          className,
        )}
        disabled={disabled}
        label={ariaLabel}
        onValueChange={onValueChange}
        options={floors.map((floor) => ({
          ...(floor.disabled === undefined ? {} : { disabled: floor.disabled }),
          label: floor.label,
          value: floor.id,
          ...(floor.tableCount === undefined
            ? {}
            : {
                ariaLabel: `${floor.label}, ${floor.tableCount} meja`,
                description: `${floor.tableCount} meja`,
              }),
        }))}
        placeholder="Pilih lantai"
        size={size}
        value={activeId}
      />
    );
  }

  const enabledFloors = floors.filter((floor) => !floor.disabled);
  const rovingFloorId = enabledFloors.some((floor) => floor.id === activeId)
    ? activeId
    : enabledFloors[0]?.id;

  function selectFromKeyboard(
    event: KeyboardEvent<HTMLButtonElement>,
    currentFloor: FloorSelectorItem,
  ) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (enabledFloors.length === 0) return;

    const currentIndex = enabledFloors.findIndex((floor) => floor.id === currentFloor.id);
    const next =
      event.key === "Home"
        ? enabledFloors[0]
        : event.key === "End"
          ? enabledFloors.at(-1)
          : enabledFloors[
              (Math.max(currentIndex, 0) +
                (event.key === "ArrowRight" ? 1 : -1) +
                enabledFloors.length) %
                enabledFloors.length
            ];

    if (next) {
      onValueChange(next.id);
      tabRefs.current.get(next.id)?.focus();
    }
  }

  return (
    <div
      aria-label={ariaLabel}
      className={classes(
        "ui-floor-selector",
        "ui-floor-selector--tabs",
        `ui-floor-selector--${size}`,
        className,
      )}
      role="tablist"
    >
      {floors.map((floor) => {
        const active = floor.id === activeId;
        return (
          <button
            aria-label={
              floor.tableCount === undefined
                ? floor.label
                : `${floor.label}, ${floor.tableCount} meja`
            }
            aria-selected={active}
            disabled={disabled || floor.disabled}
            key={floor.id}
            onClick={() => onValueChange(floor.id)}
            onKeyDown={(event) => selectFromKeyboard(event, floor)}
            ref={(node) => {
              if (node) tabRefs.current.set(floor.id, node);
              else tabRefs.current.delete(floor.id);
            }}
            role="tab"
            tabIndex={floor.id === rovingFloorId ? 0 : -1}
            type="button"
          >
            <span>{floor.label}</span>
            {floor.tableCount !== undefined ? (
              <span aria-label={`${floor.tableCount} meja`} className="ui-floor-selector__count">
                {floor.tableCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
