"use client";

import { type KeyboardEvent, type ReactNode, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

import { AppIcon } from "./app-icon";

export type SelectSize = "sm" | "md" | "lg";
export type SelectOption = {
  description?: string;
  disabled?: boolean;
  disabledReason?: string;
  label: string;
  value: string;
};
type CommonProps = {
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  error?: string;
  label: string;
  onValueChange?: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  size?: SelectSize;
  value?: string;
};
export type SelectProps = CommonProps;
export type ComboboxProps = CommonProps & {
  emptyLabel?: string;
  errorLabel?: string | undefined;
  loading?: boolean | undefined;
  onRetry?: (() => void) | undefined;
  searchPlaceholder?: string;
};

function classes(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}
function selectedOption(options: readonly SelectOption[], value?: string) {
  return options.find((option) => option.value === value);
}

function Options({
  emptyLabel,
  errorLabel,
  loading,
  onRetry,
  options,
  selectedValue,
  onSelect,
}: {
  emptyLabel: string;
  errorLabel?: string | undefined;
  loading?: boolean | undefined;
  onRetry?: (() => void) | undefined;
  options: readonly SelectOption[];
  selectedValue?: string | undefined;
  onSelect: (option: SelectOption) => void;
}) {
  if (loading)
    return (
      <p className="ui-select__status" role="status">
        Memuat pilihan...
      </p>
    );
  if (errorLabel)
    return (
      <div className="ui-select__status" role="alert">
        <span>{errorLabel}</span>
        {onRetry ? (
          <button onClick={onRetry} type="button">
            Coba lagi
          </button>
        ) : null}
      </div>
    );
  if (!options.length) return <p className="ui-select__status">{emptyLabel}</p>;
  return options.map((option) => (
    <button
      aria-selected={option.value === selectedValue}
      className="ui-select__option"
      disabled={option.disabled}
      key={option.value}
      onClick={() => onSelect(option)}
      role="option"
      title={option.disabledReason}
      type="button"
    >
      <span>
        <span>{option.label}</span>
        {option.description ? <small>{option.description}</small> : null}
        {option.disabledReason ? <small>{option.disabledReason}</small> : null}
      </span>
      {option.value === selectedValue ? <AppIcon icon={Check} size="sm" /> : null}
    </button>
  ));
}

function Menu({
  children,
  id,
  mobileSheet,
  open,
}: {
  children: ReactNode;
  id: string;
  mobileSheet?: boolean;
  open: boolean;
}) {
  if (!open) return null;
  const menu = (
    <div
      className={classes("ui-select__menu", mobileSheet && "ui-select__menu--sheet")}
      id={id}
      role="listbox"
    >
      {children}
    </div>
  );
  return typeof document === "undefined" ? menu : createPortal(menu, document.body);
}

export function Select({
  className,
  defaultValue,
  disabled = false,
  error,
  label,
  onValueChange,
  options,
  placeholder = "Pilih opsi",
  size = "md",
  value,
}: SelectProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const selectedValue = value ?? uncontrolledValue;
  const selected = selectedOption(options, selectedValue);
  function choose(option: SelectOption) {
    if (!option.disabled) {
      if (value === undefined) setUncontrolledValue(option.value);
      onValueChange?.(option.value);
      setOpen(false);
    }
  }
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const enabled = options.filter((option) => !option.disabled);
    const current = enabled.findIndex((option) => option.value === selectedValue);
    if (event.key === "Escape") setOpen(false);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!open) setOpen(true);
      const next =
        event.key === "Home"
          ? enabled[0]
          : event.key === "End"
            ? enabled.at(-1)
            : enabled[
                (current + (event.key === "ArrowDown" ? 1 : -1) + enabled.length) % enabled.length
              ];
      if (next) choose(next);
    }
  }
  return (
    <div
      aria-label={label}
      className={classes(
        "ui-select",
        `ui-select--${size}`,
        error && "ui-select--invalid",
        className,
      )}
    >
      <button
        aria-controls={id}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="ui-select__trigger"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
        type="button"
      >
        <span>{selected?.label ?? placeholder}</span>
        <AppIcon icon={ChevronDown} size={size === "sm" ? "sm" : "md"} />
      </button>
      {error ? (
        <p className="ui-select__error" role="alert">
          {error}
        </p>
      ) : null}
      <Menu id={id} mobileSheet open={open}>
        <Options
          emptyLabel="Tidak ada opsi tersedia."
          onSelect={choose}
          options={options}
          selectedValue={selectedValue}
        />
      </Menu>
    </div>
  );
}

export function Combobox({
  className,
  defaultValue,
  disabled = false,
  emptyLabel = "Tidak ada hasil yang cocok.",
  error,
  errorLabel,
  label,
  loading = false,
  onRetry,
  onValueChange,
  options,
  placeholder = "Pilih atau cari opsi",
  searchPlaceholder = "Cari...",
  size = "md",
  value,
}: ComboboxProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const selectedValue = value ?? uncontrolledValue;
  const selected = selectedOption(options, selectedValue);
  const filtered = useMemo(
    () =>
      options.filter((option) =>
        option.label.toLocaleLowerCase("id-ID").includes(query.toLocaleLowerCase("id-ID")),
      ),
    [options, query],
  );
  function choose(option: SelectOption) {
    if (!option.disabled) {
      if (value === undefined) setUncontrolledValue(option.value);
      onValueChange?.(option.value);
      setOpen(false);
      setQuery("");
    }
  }
  return (
    <div
      className={classes(
        "ui-select",
        `ui-select--${size}`,
        error && "ui-select--invalid",
        className,
      )}
    >
      <button
        aria-controls={id}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="ui-select__trigger"
        disabled={disabled}
        onClick={() => setOpen(true)}
        type="button"
      >
        <span>{selected?.label ?? placeholder}</span>
        <AppIcon icon={ChevronDown} size={size === "sm" ? "sm" : "md"} />
      </button>
      {error ? (
        <p className="ui-select__error" role="alert">
          {error}
        </p>
      ) : null}
      <Menu id={id} mobileSheet open={open}>
        <div className="ui-select__search">
          <AppIcon icon={Search} size="sm" />
          <input
            aria-label={`Cari ${label}`}
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                const enabled = filtered.filter((option) => !option.disabled);
                const current = enabled.findIndex((option) => option.value === selectedValue);
                const next =
                  event.key === "Home"
                    ? enabled[0]
                    : event.key === "End"
                      ? enabled.at(-1)
                      : enabled[
                          (current + (event.key === "ArrowDown" ? 1 : -1) + enabled.length) %
                            enabled.length
                        ];
                if (next) choose(next);
              }
            }}
            placeholder={searchPlaceholder}
            value={query}
          />
        </div>
        <Options
          emptyLabel={emptyLabel}
          errorLabel={errorLabel}
          loading={loading}
          onRetry={onRetry}
          onSelect={choose}
          options={filtered}
          selectedValue={selectedValue}
        />
      </Menu>
    </div>
  );
}
