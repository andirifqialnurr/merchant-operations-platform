"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconChevronDown, IconSearch } from "@tabler/icons-react";

import { AppIcon } from "./app-icon";

export type SelectSize = "sm" | "md" | "lg";
export type SelectOption = {
  ariaLabel?: string;
  description?: string;
  disabled?: boolean;
  disabledReason?: string;
  label: string;
  value: string;
};
/*
 * Label props default to Indonesian until the i18n checkpoint moves every
 * default into the id/en dictionaries.
 */
type CommonProps = {
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  emptyLabel: string;
  error?: string;
  label: string;
  onValueChange?: (value: string) => void;
  options: readonly SelectOption[];
  placeholder: string;
  size?: SelectSize;
  value?: string;
};
export type SelectProps = CommonProps;
export type ComboboxProps = CommonProps & {
  errorLabel?: string | undefined;
  loading?: boolean | undefined;
  loadingLabel?: string;
  onRetry?: (() => void) | undefined;
  retryLabel?: string;
  /** Accessible name of the search input. */
  searchLabel?: string;
  searchPlaceholder: string;
};

function classes(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}
function selectedOption(options: readonly SelectOption[], value?: string) {
  return options.find((option) => option.value === value);
}

function useAnchoredMenu(open: boolean, onClose: () => void) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [style, setStyle] = useState<CSSProperties | undefined>(undefined);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const anchor = anchorRef.current?.querySelector(".ui-select__trigger");
      const isSheet =
        typeof window.matchMedia === "function" && window.matchMedia("(max-width: 40rem)").matches;
      if (!anchor || isSheet) {
        setStyle(undefined);
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight ?? 0;
      const gap = 4;
      const below = window.innerHeight - rect.bottom;
      const openUp = below < menuHeight + gap && rect.top > below;
      setStyle({
        left: rect.left,
        minInlineSize: rect.width,
        top: openUp ? Math.max(gap, rect.top - menuHeight - gap) : rect.bottom + gap,
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      onCloseRef.current();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return { anchorRef, menuRef, style };
}

function Options({
  emptyLabel,
  errorLabel,
  loading,
  loadingLabel,
  onRetry,
  retryLabel,
  options,
  selectedValue,
  onSelect,
}: {
  emptyLabel: string;
  errorLabel?: string | undefined;
  loading?: boolean | undefined;
  loadingLabel?: string | undefined;
  onRetry?: (() => void) | undefined;
  retryLabel?: string | undefined;
  options: readonly SelectOption[];
  selectedValue?: string | undefined;
  onSelect: (option: SelectOption) => void;
}) {
  if (loading)
    return (
      <p className="ui-select__status" role="status">
        {loadingLabel}
      </p>
    );
  if (errorLabel)
    return (
      <div className="ui-select__status" role="alert">
        <span>{errorLabel}</span>
        {onRetry ? (
          <button onClick={onRetry} type="button">
            {retryLabel}
          </button>
        ) : null}
      </div>
    );
  if (!options.length) return <p className="ui-select__status">{emptyLabel}</p>;
  return options.map((option) => (
    <button
      aria-label={option.ariaLabel}
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
      {option.value === selectedValue ? <AppIcon icon={IconCheck} size="sm" /> : null}
    </button>
  ));
}

function Menu({
  children,
  id,
  menuRef,
  mobileSheet,
  open,
  style,
}: {
  children: ReactNode;
  id: string;
  menuRef: RefObject<HTMLDivElement | null>;
  mobileSheet?: boolean;
  open: boolean;
  style: CSSProperties | undefined;
}) {
  if (!open) return null;
  const menu = (
    <div
      className={classes("ui-select__menu", mobileSheet && "ui-select__menu--sheet")}
      id={id}
      ref={menuRef}
      role="listbox"
      style={style}
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
  emptyLabel,
  error,
  label,
  onValueChange,
  options,
  placeholder,
  size = "md",
  value,
}: SelectProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const selectedValue = value ?? uncontrolledValue;
  const selected = selectedOption(options, selectedValue);
  const { anchorRef, menuRef, style } = useAnchoredMenu(open, () => setOpen(false));
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
      ref={anchorRef}
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
        <span className={selected ? undefined : "ui-select__placeholder"}>
          {selected?.label ?? placeholder}
        </span>
        <AppIcon icon={IconChevronDown} size={size === "sm" ? "sm" : "md"} />
      </button>
      {error ? (
        <p className="ui-select__error" role="alert">
          {error}
        </p>
      ) : null}
      <Menu id={id} menuRef={menuRef} mobileSheet open={open} style={style}>
        <Options
          emptyLabel={emptyLabel}
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
  emptyLabel,
  error,
  errorLabel,
  label,
  loading = false,
  loadingLabel,
  onRetry,
  onValueChange,
  options,
  placeholder,
  retryLabel,
  searchLabel,
  searchPlaceholder,
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
  const { anchorRef, menuRef, style } = useAnchoredMenu(open, () => setOpen(false));
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
      ref={anchorRef}
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
        <span className={selected ? undefined : "ui-select__placeholder"}>
          {selected?.label ?? placeholder}
        </span>
        <AppIcon icon={IconChevronDown} size={size === "sm" ? "sm" : "md"} />
      </button>
      {error ? (
        <p className="ui-select__error" role="alert">
          {error}
        </p>
      ) : null}
      <Menu id={id} menuRef={menuRef} mobileSheet open={open} style={style}>
        <div className="ui-select__search">
          <AppIcon icon={IconSearch} size="sm" />
          <input
            aria-label={searchLabel ?? label}
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
          loadingLabel={loadingLabel}
          onRetry={onRetry}
          retryLabel={retryLabel}
          onSelect={choose}
          options={filtered}
          selectedValue={selectedValue}
        />
      </Menu>
    </div>
  );
}
