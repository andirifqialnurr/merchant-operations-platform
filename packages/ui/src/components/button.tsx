"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import type { LucideIcon } from "lucide-react";

import { AppIcon, type AppIconSize } from "./app-icon";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "link";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
  fullWidth?: boolean;
  iconLeft?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  loadingLabel?: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: LucideIcon;
  label: string;
  loading?: boolean;
  size?: ButtonSize;
  tooltip?: string;
  variant?: Exclude<ButtonVariant, "link">;
};

const iconSizeByButtonSize: Record<ButtonSize, AppIconSize> = {
  xs: "xs",
  sm: "sm",
  md: "md",
  lg: "lg",
  xl: "xl",
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function LoadingIndicator() {
  return <span aria-hidden="true" className="ui-button__spinner" />;
}

export function Button({
  children,
  className,
  disabled,
  fullWidth = false,
  iconLeft: IconLeft,
  iconRight: IconRight,
  loading = false,
  loadingLabel,
  size = "md",
  variant = "primary",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      className={joinClasses(
        "ui-button",
        `ui-button--${size}`,
        `ui-button--${variant}`,
        fullWidth && "ui-button--full-width",
        className,
      )}
      disabled={isDisabled}
    >
      {loading ? (
        <LoadingIndicator />
      ) : IconLeft ? (
        <AppIcon icon={IconLeft} size={iconSizeByButtonSize[size]} />
      ) : null}
      <span className="ui-button__label">{loading ? (loadingLabel ?? children) : children}</span>
      {!loading && IconRight ? (
        <AppIcon icon={IconRight} size={iconSizeByButtonSize[size]} />
      ) : null}
    </button>
  );
}

export function IconButton({
  className,
  disabled,
  icon,
  label,
  loading = false,
  size = "md",
  tooltip,
  variant = "ghost",
  ...props
}: IconButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      aria-label={label}
      className={joinClasses(
        "ui-button",
        "ui-icon-button",
        `ui-button--${size}`,
        `ui-button--${variant}`,
        className,
      )}
      disabled={isDisabled}
      title={tooltip ?? label}
    >
      {loading ? <LoadingIndicator /> : <AppIcon icon={icon} size={iconSizeByButtonSize[size]} />}
    </button>
  );
}
