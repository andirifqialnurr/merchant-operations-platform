"use client";

import {
  type ChangeEvent,
  type InputHTMLAttributes,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { AppIcon } from "./app-icon";

/*
 * Label props default to Indonesian until the i18n checkpoint moves every
 * default into the id/en dictionaries. `locale` drives all Intl formatting.
 */
export type NumericSize = "sm" | "md" | "lg";
type NumericProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "size" | "type" | "value"
> & {
  allowDecimal?: boolean;
  invalid?: boolean;
  onValueChange?: (value: string) => void;
  size?: NumericSize;
  value?: string | undefined;
};
export type MoneyInputProps = Omit<NumericProps, "allowDecimal" | "onValueChange" | "value"> & {
  locale?: string;
  onValueChange?: (value: number | undefined) => void;
  value?: number;
};
type CalendarLabels = {
  nextMonthLabel?: string;
  previousMonthLabel?: string;
};
export type DatePickerProps = CalendarLabels & {
  disabled?: boolean;
  error?: string;
  label: string;
  locale?: string;
  onValueChange?: (value: string | undefined) => void;
  placeholder?: string;
  value?: string | undefined;
};
export type DateRangePickerProps = CalendarLabels & {
  disabled?: boolean;
  end?: string | undefined;
  endLabel?: string;
  endPlaceholder?: string;
  label: string;
  locale?: string;
  onValueChange?: (range: { start?: string | undefined; end?: string | undefined }) => void;
  start?: string | undefined;
  startLabel?: string;
  startPlaceholder?: string;
};
export type MonthPickerProps = {
  disabled?: boolean;
  label: string;
  onValueChange?: (value: string | undefined) => void;
  value?: string;
};
export type TimeInputProps = {
  disabled?: boolean;
  error?: string;
  /** Message shown when the typed value is not a valid 24-hour time. */
  formatError?: string;
  label: string;
  onValueChange?: (value: string | undefined) => void;
  value?: string;
};

const DEFAULT_LOCALE = "id-ID";

function classes(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}
/** Local calendar date as YYYY-MM-DD, without the timezone shift of toISOString(). */
function toDateValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
function fromDateValue(value: string) {
  return new Date(`${value}T00:00:00`);
}
function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(fromDateValue(value));
}
function weekdayNames(locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
  // 4 January 1970 was a Sunday.
  return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(1970, 0, 4 + index)));
}

export function NumericInput({
  allowDecimal = false,
  className,
  invalid = false,
  onValueChange,
  size = "md",
  value = "",
  ...props
}: NumericProps) {
  function change(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value.replace(allowDecimal ? /[^0-9,.-]/g : /[^0-9-]/g, "");
    onValueChange?.(next);
  }
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={classes(
        "ui-numeric-input",
        `ui-numeric-input--${size}`,
        invalid && "ui-numeric-input--invalid",
        className,
      )}
      inputMode={allowDecimal ? "decimal" : "numeric"}
      onChange={change}
      type="text"
      value={value}
    />
  );
}

export function MoneyInput({
  className,
  invalid = false,
  locale = DEFAULT_LOCALE,
  onValueChange,
  size = "md",
  value,
  ...props
}: MoneyInputProps) {
  const formatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const display = value === undefined ? "" : `Rp${formatter.format(value)}`;
  return (
    <NumericInput
      placeholder="Rp0"
      {...props}
      className={classes("ui-numeric-input--money", className)}
      invalid={invalid}
      onValueChange={(next) =>
        onValueChange?.(next ? Number(next.replace(/[^0-9]/g, "")) : undefined)
      }
      size={size}
      value={display}
    />
  );
}

function Calendar({
  locale,
  nextMonthLabel,
  onSelect,
  previousMonthLabel,
  value,
}: {
  locale: string;
  nextMonthLabel: string;
  onSelect: (value: string) => void;
  previousMonthLabel: string;
  value?: string | undefined;
}) {
  const [month, setMonth] = useState(() => (value ? fromDateValue(value) : new Date()));
  const today = toDateValue(new Date());
  const days = useMemo(() => {
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: count }, (_, index) =>
      toDateValue(new Date(month.getFullYear(), month.getMonth(), index + 1)),
    );
  }, [month]);
  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const weekdays = useMemo(() => weekdayNames(locale), [locale]);
  return (
    <div className="ui-calendar" role="dialog">
      <header>
        <button
          aria-label={previousMonthLabel}
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          type="button"
        >
          <AppIcon icon={ChevronLeft} size="sm" />
        </button>
        <strong>
          {new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month)}
        </strong>
        <button
          aria-label={nextMonthLabel}
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          type="button"
        >
          <AppIcon icon={ChevronRight} size="sm" />
        </button>
      </header>
      <div aria-hidden="true" className="ui-calendar__week">
        {weekdays.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="ui-calendar__days">
        {days.map((day, index) => (
          <button
            aria-current={day === today ? "date" : undefined}
            aria-pressed={day === value}
            key={day}
            onClick={() => onSelect(day)}
            style={index === 0 ? { gridColumnStart: firstWeekday + 1 } : undefined}
            type="button"
          >
            {index + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DatePicker({
  disabled = false,
  error,
  label,
  locale = DEFAULT_LOCALE,
  nextMonthLabel = "Bulan berikutnya",
  onValueChange,
  placeholder = "Pilih tanggal",
  previousMonthLabel = "Bulan sebelumnya",
  value,
}: DatePickerProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      aria-label={label}
      className={classes("ui-date-control", error && "ui-date-control--invalid")}
      ref={rootRef}
    >
      <button
        aria-controls={id}
        aria-expanded={open}
        className="ui-date-control__trigger"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <AppIcon icon={CalendarDays} size="sm" />
        <span className={value ? undefined : "ui-date-control__placeholder"}>
          {value ? formatDate(value, locale) : placeholder}
        </span>
      </button>
      {open ? (
        <div id={id}>
          <Calendar
            locale={locale}
            nextMonthLabel={nextMonthLabel}
            onSelect={(next) => {
              onValueChange?.(next);
              setOpen(false);
            }}
            previousMonthLabel={previousMonthLabel}
            value={value}
          />
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
export function DateRangePicker({
  disabled = false,
  end,
  endLabel,
  endPlaceholder = "Tanggal selesai",
  label,
  locale = DEFAULT_LOCALE,
  nextMonthLabel,
  onValueChange,
  previousMonthLabel,
  start,
  startLabel,
  startPlaceholder = "Tanggal mulai",
}: DateRangePickerProps) {
  const calendarLabels = {
    ...(nextMonthLabel ? { nextMonthLabel } : {}),
    ...(previousMonthLabel ? { previousMonthLabel } : {}),
  };
  return (
    <div className="ui-date-range">
      <DatePicker
        {...calendarLabels}
        disabled={disabled}
        label={startLabel ?? `${label} mulai`}
        locale={locale}
        onValueChange={(next) => onValueChange?.({ start: next, end })}
        placeholder={startPlaceholder}
        value={start}
      />
      <DatePicker
        {...calendarLabels}
        disabled={disabled}
        label={endLabel ?? `${label} selesai`}
        locale={locale}
        onValueChange={(next) => onValueChange?.({ start, end: next })}
        placeholder={endPlaceholder}
        value={end}
      />
    </div>
  );
}
export function MonthPicker({ disabled = false, label, onValueChange, value }: MonthPickerProps) {
  const [month, setMonth] = useState(value ?? "");
  return (
    <label className="ui-month-picker">
      <span>{label}</span>
      <input
        disabled={disabled}
        onChange={(event) => {
          setMonth(event.target.value);
          onValueChange?.(event.target.value || undefined);
        }}
        pattern="[0-9]{4}-[0-9]{2}"
        placeholder="YYYY-MM"
        value={month}
      />
    </label>
  );
}
export function TimeInput({
  disabled = false,
  error,
  formatError = "Gunakan format 24 jam, misalnya 18:30.",
  label,
  onValueChange,
  value = "",
}: TimeInputProps) {
  const [time, setTime] = useState(value);
  const valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  return (
    <label className="ui-time-input">
      <span>{label}</span>
      <input
        aria-invalid={Boolean(error) || (Boolean(time) && !valid)}
        disabled={disabled}
        inputMode="numeric"
        maxLength={5}
        onChange={(event) => {
          const next = event.target.value.replace(/[^0-9:]/g, "");
          setTime(next);
          onValueChange?.(/^([01]\d|2[0-3]):[0-5]\d$/.test(next) ? next : undefined);
        }}
        placeholder="00:00"
        value={time}
      />
      {error || (time && !valid) ? <small role="alert">{error ?? formatError}</small> : null}
    </label>
  );
}
