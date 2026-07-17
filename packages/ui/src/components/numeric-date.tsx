"use client";

import { type ChangeEvent, type InputHTMLAttributes, useId, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { AppIcon } from "./app-icon";

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
  onValueChange?: (value: number | undefined) => void;
  value?: number;
};
export type DatePickerProps = {
  disabled?: boolean;
  error?: string;
  label: string;
  onValueChange?: (value: string | undefined) => void;
  placeholder?: string;
  value?: string | undefined;
};
export type DateRangePickerProps = {
  disabled?: boolean;
  end?: string | undefined;
  label: string;
  onValueChange?: (range: { start?: string | undefined; end?: string | undefined }) => void;
  start?: string | undefined;
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
  label: string;
  onValueChange?: (value: string | undefined) => void;
  value?: string;
};
const idFormatter = new Intl.NumberFormat("id-ID");
function classes(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}
function formatDate(value?: string) {
  return value
    ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(
        new Date(`${value}T00:00:00`),
      )
    : "Pilih tanggal";
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
  onValueChange,
  size = "md",
  value,
  ...props
}: MoneyInputProps) {
  const display = value === undefined ? "" : `Rp${idFormatter.format(value)}`;
  return (
    <NumericInput
      {...props}
      className={className}
      invalid={invalid}
      onValueChange={(next) =>
        onValueChange?.(next ? Number(next.replace(/[^0-9]/g, "")) : undefined)
      }
      placeholder="Rp0"
      size={size}
      value={display}
    />
  );
}

function Calendar({
  onSelect,
  value,
}: {
  onSelect: (value: string) => void;
  value?: string | undefined;
}) {
  const [month, setMonth] = useState(() => (value ? new Date(`${value}T00:00:00`) : new Date()));
  const days = useMemo(() => {
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: count }, (_, index) =>
      new Date(month.getFullYear(), month.getMonth(), index + 1).toISOString().slice(0, 10),
    );
  }, [month]);
  return (
    <div className="ui-calendar" role="dialog">
      <header>
        <button
          aria-label="Bulan sebelumnya"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          type="button"
        >
          <AppIcon icon={ChevronLeft} size="sm" />
        </button>
        <strong>
          {new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(month)}
        </strong>
        <button
          aria-label="Bulan berikutnya"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          type="button"
        >
          <AppIcon icon={ChevronRight} size="sm" />
        </button>
      </header>
      <div className="ui-calendar__week">
        {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div
        className="ui-calendar__days"
        style={{ gridColumnStart: new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 1 }}
      >
        {days.map((day) => (
          <button
            aria-pressed={day === value}
            key={day}
            onClick={() => onSelect(day)}
            type="button"
          >
            {new Date(`${day}T00:00:00`).getDate()}
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
  onValueChange,
  placeholder,
  value,
}: DatePickerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <div aria-label={label} className="ui-date-control">
      <button
        aria-controls={id}
        aria-expanded={open}
        className="ui-date-control__trigger"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <AppIcon icon={CalendarDays} size="sm" />
        <span>{value ? formatDate(value) : (placeholder ?? "Pilih tanggal")}</span>
      </button>
      {open ? (
        <div id={id}>
          <Calendar
            onSelect={(next) => {
              onValueChange?.(next);
              setOpen(false);
            }}
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
  label,
  onValueChange,
  start,
}: DateRangePickerProps) {
  return (
    <div className="ui-date-range">
      <DatePicker
        disabled={disabled}
        label={`${label} mulai`}
        onValueChange={(next) => onValueChange?.({ start: next, end })}
        placeholder="Tanggal mulai"
        value={start}
      />
      <DatePicker
        disabled={disabled}
        label={`${label} selesai`}
        onValueChange={(next) => onValueChange?.({ start, end: next })}
        placeholder="Tanggal selesai"
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
        aria-invalid={Boolean(time) && !valid}
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
      {error || (time && !valid) ? (
        <small role="alert">{error ?? "Gunakan format 24 jam, misalnya 18:30."}</small>
      ) : null}
    </label>
  );
}
