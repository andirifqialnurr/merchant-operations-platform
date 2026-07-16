"use client";

import {
  createContext,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useContext,
  useId,
  useRef,
  useState,
} from "react";

import { Eye, EyeOff, Search, X } from "lucide-react";

import { AppIcon } from "./app-icon";

type FormFieldContextValue = {
  describedBy?: string | undefined;
  invalid: boolean;
};

const FormFieldContext = createContext<FormFieldContextValue>({ invalid: false });

export type FormFieldProps = {
  children: ReactNode;
  error?: string;
  helperText?: string;
  htmlFor: string;
  label: string;
  required?: boolean;
};

export type InputSize = "sm" | "md" | "lg";
export type InputVariant = "default" | "search" | "password";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> & {
  clearable?: boolean;
  invalid?: boolean;
  onClear?: () => void;
  prefix?: ReactNode;
  size?: InputSize;
  suffix?: ReactNode;
  variant?: InputVariant;
};

export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> & {
  autoGrow?: boolean;
  invalid?: boolean;
  size?: InputSize;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function joinDescribedBy(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ") || undefined;
}

export function FormField({
  children,
  error,
  helperText,
  htmlFor,
  label,
  required = false,
}: FormFieldProps) {
  const descriptionId = useId();
  const description = error ?? helperText;
  const contextValue = {
    describedBy: description ? descriptionId : undefined,
    invalid: Boolean(error),
  };

  return (
    <FormFieldContext.Provider value={contextValue}>
      <div className="ui-form-field">
        <label className="ui-form-field__label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="ui-form-field__required">Wajib</span> : null}
        </label>
        {children}
        {description ? (
          <p
            className={joinClasses(
              "ui-form-field__description",
              error && "ui-form-field__description--error",
            )}
            id={descriptionId}
            role={error ? "alert" : undefined}
          >
            {description}
          </p>
        ) : null}
      </div>
    </FormFieldContext.Provider>
  );
}

export function Input({
  "aria-describedby": ariaDescribedBy,
  className,
  clearable = false,
  disabled,
  id,
  invalid,
  onClear,
  prefix,
  readOnly,
  size = "md",
  suffix,
  variant = "default",
  ...props
}: InputProps) {
  const field = useContext(FormFieldContext);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isInvalid = invalid ?? field.invalid;
  const inputType = variant === "password" ? (passwordVisible ? "text" : "password") : "text";
  const canClear = variant === "search" && clearable && Boolean(onClear) && !disabled;

  return (
    <div
      className={joinClasses(
        "ui-text-field",
        `ui-text-field--${size}`,
        isInvalid && "ui-text-field--invalid",
        disabled && "ui-text-field--disabled",
        readOnly && "ui-text-field--readonly",
      )}
    >
      {variant === "search" ? <AppIcon icon={Search} size={size === "sm" ? "sm" : "md"} /> : null}
      {prefix ? <span className="ui-text-field__affix">{prefix}</span> : null}
      <input
        {...props}
        aria-describedby={joinDescribedBy(ariaDescribedBy, field.describedBy)}
        aria-invalid={isInvalid || undefined}
        className={joinClasses("ui-text-field__input", className)}
        disabled={disabled}
        id={id}
        readOnly={readOnly}
        type={inputType}
      />
      {suffix ? <span className="ui-text-field__affix">{suffix}</span> : null}
      {canClear ? (
        <button
          aria-label="Hapus pencarian"
          className="ui-text-field__action"
          onClick={onClear}
          type="button"
        >
          <AppIcon icon={X} size="sm" />
        </button>
      ) : null}
      {variant === "password" ? (
        <button
          aria-label={passwordVisible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          className="ui-text-field__action"
          disabled={disabled}
          onClick={() => setPasswordVisible((visible) => !visible)}
          type="button"
        >
          <AppIcon icon={passwordVisible ? EyeOff : Eye} size="sm" />
        </button>
      ) : null}
    </div>
  );
}

export function Textarea({
  "aria-describedby": ariaDescribedBy,
  autoGrow = false,
  className,
  invalid,
  onInput,
  size = "md",
  ...props
}: TextareaProps) {
  const field = useContext(FormFieldContext);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isInvalid = invalid ?? field.invalid;

  function resizeTextarea(textarea: HTMLTextAreaElement) {
    if (!autoGrow) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  return (
    <textarea
      {...props}
      aria-describedby={joinDescribedBy(ariaDescribedBy, field.describedBy)}
      aria-invalid={isInvalid || undefined}
      className={joinClasses(
        "ui-textarea",
        `ui-textarea--${size}`,
        autoGrow && "ui-textarea--auto-grow",
        isInvalid && "ui-textarea--invalid",
        className,
      )}
      onInput={(event) => {
        resizeTextarea(event.currentTarget);
        onInput?.(event);
      }}
      ref={textareaRef}
    />
  );
}
