"use client";

import {
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { Minus, Plus } from "lucide-react";

import { AppIcon } from "./app-icon";

export type SelectionControlSize = "sm" | "md" | "lg";
type NativeSelectionProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> & {
  label: ReactNode;
  size?: SelectionControlSize;
};
export type CheckboxProps = NativeSelectionProps & { indeterminate?: boolean };
export type RadioProps = NativeSelectionProps;
export type SwitchProps = NativeSelectionProps;
export type SegmentedControlItem = { disabled?: boolean; label: ReactNode; value: string };
export type SegmentedControlProps = {
  "aria-label"?: string;
  defaultValue?: string;
  disabled?: boolean;
  items: readonly SegmentedControlItem[];
  label: string;
  onValueChange?: (value: string) => void;
  size?: SelectionControlSize;
  value?: string;
};
export type QuantityStepperProps = {
  defaultValue?: number;
  disabled?: boolean;
  label: string;
  max?: number;
  min?: number;
  onValueChange?: (value: number) => void;
  size?: SelectionControlSize;
  step?: number;
  value?: number;
};

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function Checkbox({
  checked,
  className,
  disabled,
  indeterminate = false,
  label,
  size = "md",
  ...props
}: CheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label
      className={classes(
        "ui-selection-control",
        `ui-selection-control--${size}`,
        disabled && "ui-selection-control--disabled",
        className,
      )}
    >
      <input
        {...props}
        checked={checked}
        className="ui-selection-control__input ui-checkbox__input"
        disabled={disabled}
        ref={inputRef}
        type="checkbox"
      />
      <span aria-hidden="true" className="ui-checkbox__indicator" />
      <span>{label}</span>
    </label>
  );
}

export function Radio({ checked, className, disabled, label, size = "md", ...props }: RadioProps) {
  return (
    <label
      className={classes(
        "ui-selection-control",
        `ui-selection-control--${size}`,
        disabled && "ui-selection-control--disabled",
        className,
      )}
    >
      <input
        {...props}
        checked={checked}
        className="ui-selection-control__input ui-radio__input"
        disabled={disabled}
        type="radio"
      />
      <span aria-hidden="true" className="ui-radio__indicator" />
      <span>{label}</span>
    </label>
  );
}

export function Switch({
  checked,
  className,
  disabled,
  label,
  size = "md",
  ...props
}: SwitchProps) {
  return (
    <label
      className={classes(
        "ui-selection-control",
        `ui-selection-control--${size}`,
        disabled && "ui-selection-control--disabled",
        className,
      )}
    >
      <input
        {...props}
        checked={checked}
        className="ui-selection-control__input ui-switch__input"
        disabled={disabled}
        role="switch"
        type="checkbox"
      />
      <span aria-hidden="true" className="ui-switch__track">
        <span className="ui-switch__thumb" />
      </span>
      <span>{label}</span>
    </label>
  );
}

export function SegmentedControl({
  defaultValue,
  disabled = false,
  items,
  label,
  onValueChange,
  size = "md",
  value,
}: SegmentedControlProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(
    defaultValue ?? items.find((item) => !item.disabled)?.value ?? "",
  );
  const selectedValue = value ?? uncontrolledValue;
  const idPrefix = useId();
  function selectValue(nextValue: string) {
    if (!disabled && nextValue !== selectedValue) {
      if (value === undefined) setUncontrolledValue(nextValue);
      onValueChange?.(nextValue);
    }
  }
  function moveSelection(index: number, direction: 1 | -1) {
    for (let offset = 1; offset <= items.length; offset += 1) {
      const item = items[(index + direction * offset + items.length) % items.length];
      if (item && !item.disabled) {
        selectValue(item.value);
        document.getElementById(`${idPrefix}-${item.value}`)?.focus();
        return;
      }
    }
  }
  return (
    <div
      aria-label={label}
      className={classes("ui-segmented-control", `ui-segmented-control--${size}`)}
      role="radiogroup"
    >
      {items.map((item, index) => (
        <button
          aria-checked={item.value === selectedValue}
          className="ui-segmented-control__item"
          disabled={disabled || item.disabled}
          id={`${idPrefix}-${item.value}`}
          key={item.value}
          onClick={() => selectValue(item.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              event.preventDefault();
              moveSelection(index, 1);
            }
            if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              event.preventDefault();
              moveSelection(index, -1);
            }
          }}
          role="radio"
          tabIndex={item.value === selectedValue ? 0 : -1}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function QuantityStepper({
  defaultValue,
  disabled = false,
  label,
  max = Number.POSITIVE_INFINITY,
  min = 0,
  onValueChange,
  size = "md",
  step = 1,
  value,
}: QuantityStepperProps) {
  const id = useId();
  const [uncontrolledValue, setUncontrolledValue] = useState(clamp(defaultValue ?? min, min, max));
  const currentValue = clamp(value ?? uncontrolledValue, min, max);
  function update(nextValue: number) {
    const boundedValue = clamp(nextValue, min, max);
    if (boundedValue !== currentValue) {
      if (value === undefined) setUncontrolledValue(boundedValue);
      onValueChange?.(boundedValue);
    }
  }
  return (
    <div
      aria-label={label}
      className={classes("ui-quantity-stepper", `ui-quantity-stepper--${size}`)}
      role="group"
    >
      <button
        aria-label={`Kurangi ${label}`}
        disabled={disabled || currentValue <= min}
        onClick={() => update(currentValue - step)}
        type="button"
      >
        <AppIcon icon={Minus} size="sm" />
      </button>
      <output aria-atomic="true" aria-live="polite" id={id}>
        {currentValue}
      </output>
      <button
        aria-label={`Tambah ${label}`}
        disabled={disabled || currentValue >= max}
        onClick={() => update(currentValue + step)}
        type="button"
      >
        <AppIcon icon={Plus} size="sm" />
      </button>
    </div>
  );
}
