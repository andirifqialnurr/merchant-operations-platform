"use client";

import { type KeyboardEvent, useRef } from "react";

export type AreaSelectorItem = { id: string; label: string };

export type AreaSelectorLabels = {
  /** The choice that shows every area. */
  all: string;
  /** The name of the whole control. */
  selector: string;
};

export type AreaSelectorProps = {
  /** The chosen area, or null for every area. */
  activeId: string | null;
  areas: readonly AreaSelectorItem[];
  className?: string;
  labels: AreaSelectorLabels;
  onValueChange: (areaId: string | null) => void;
};

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

/**
 * Narrows a floor to one of its areas. A floor with a single area needs no
 * choice, so nothing is drawn then.
 */
export function AreaSelector({
  activeId,
  areas,
  className,
  labels,
  onValueChange,
}: AreaSelectorProps) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  if (areas.length < 2) return null;

  const choices = [
    { id: "", label: labels.all },
    ...areas.map((area) => ({ id: area.id, label: area.label })),
  ];
  const current = activeId ?? "";

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = choices[(index + step + choices.length) % choices.length];
    if (!next) return;
    onValueChange(next.id || null);
    refs.current.get(next.id)?.focus();
  }

  return (
    <div
      aria-label={labels.selector}
      className={classes("ui-area-selector", className)}
      role="radiogroup"
    >
      {choices.map((choice, index) => {
        const checked = choice.id === current;
        return (
          <button
            aria-checked={checked}
            className="ui-area-selector__item"
            key={choice.id || "all"}
            onClick={() => onValueChange(choice.id || null)}
            onKeyDown={(event) => onKeyDown(event, index)}
            ref={(node) => {
              if (node) refs.current.set(choice.id, node);
              else refs.current.delete(choice.id);
            }}
            role="radio"
            tabIndex={checked ? 0 : -1}
            type="button"
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
