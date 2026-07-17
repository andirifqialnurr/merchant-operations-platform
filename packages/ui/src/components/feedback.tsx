"use client";

import type { HTMLAttributes, ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CircleAlert,
  Info,
  LoaderCircle,
  WifiOff,
  X,
} from "lucide-react";
import { AppIcon } from "./app-icon";

export type FeedbackTone = "info" | "success" | "warning" | "danger" | "loading" | "offline";
export type BadgeSize = "xs" | "sm" | "md";
type ToneProps = { children: ReactNode; tone?: FeedbackTone | undefined };
export type BadgeProps = ToneProps & { size?: BadgeSize } & HTMLAttributes<HTMLSpanElement>;
export type AlertProps = ToneProps & {
  compact?: boolean;
  onDismiss?: (() => void) | undefined;
  title?: string | undefined;
} & HTMLAttributes<HTMLDivElement>;
export type ToastItem = {
  id: string;
  message: ReactNode;
  onDismiss?: (() => void) | undefined;
  tone?: FeedbackTone | undefined;
  title?: string | undefined;
};
export type ToastStackProps = {
  items: readonly ToastItem[];
  placement?: "top-right" | "bottom-right";
};
export type StatusBarProps = ToneProps & { label?: string } & HTMLAttributes<HTMLDivElement>;
export type ProgressProps = { label?: string; value?: number } & HTMLAttributes<HTMLDivElement>;
export type SkeletonProps = {
  className?: string;
  variant?: "text" | "avatar" | "product-card" | "table-row" | "metric-card" | "ticket";
};
export type StateProps = { action?: ReactNode; description: ReactNode; title: string };

const iconByTone = {
  info: Info,
  success: CheckCircle2,
  warning: CircleAlert,
  danger: AlertCircle,
  loading: LoaderCircle,
  offline: WifiOff,
} as const;
function classes(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Badge({ children, className, size = "sm", tone = "info", ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={classes("ui-badge", `ui-badge--${size}`, `ui-badge--${tone}`, className)}
    >
      {children}
    </span>
  );
}
export function Alert({
  children,
  className,
  compact = false,
  onDismiss,
  title,
  tone = "info",
  ...props
}: AlertProps) {
  const Icon = iconByTone[tone];
  return (
    <div
      {...props}
      className={classes(
        "ui-alert",
        `ui-alert--${tone}`,
        compact && "ui-alert--compact",
        className,
      )}
      role={tone === "danger" ? "alert" : "status"}
    >
      <AppIcon icon={Icon} size="md" />
      <div>
        {title ? <strong>{title}</strong> : null}
        <div>{children}</div>
      </div>
      {onDismiss ? (
        <button aria-label="Tutup notifikasi" onClick={onDismiss} type="button">
          <AppIcon icon={X} size="sm" />
        </button>
      ) : null}
    </div>
  );
}
export function ToastStack({ items, placement = "top-right" }: ToastStackProps) {
  return (
    <div aria-live="polite" className={classes("ui-toast-stack", `ui-toast-stack--${placement}`)}>
      {items.slice(0, 3).map((item) => (
        <Alert compact key={item.id} onDismiss={item.onDismiss} title={item.title} tone={item.tone}>
          {item.message}
        </Alert>
      ))}
    </div>
  );
}
export function StatusBar({ children, className, label, tone = "info", ...props }: StatusBarProps) {
  const Icon = iconByTone[tone];
  return (
    <div
      {...props}
      className={classes("ui-status-bar", `ui-status-bar--${tone}`, className)}
      role="status"
    >
      <AppIcon icon={Icon} size="sm" />
      <span>
        {label ? `${label}: ` : null}
        {children}
      </span>
    </div>
  );
}
export function Spinner({ label = "Memuat" }: { label?: string }) {
  return (
    <span aria-label={label} className="ui-spinner" role="status">
      <span className="ui-spinner__visual" />
      <span className="ui-visually-hidden">{label}</span>
    </span>
  );
}
export function Progress({ className, label, value, ...props }: ProgressProps) {
  const determinate = value !== undefined;
  return (
    <div
      {...props}
      aria-label={label ?? "Kemajuan"}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuenow={value}
      className={classes("ui-progress", className)}
      role="progressbar"
    >
      <span
        style={determinate ? { inlineSize: `${Math.max(0, Math.min(100, value))}%` } : undefined}
      />
    </div>
  );
}
export function Skeleton({ className, variant = "text" }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={classes("ui-skeleton", `ui-skeleton--${variant}`, className)}
    />
  );
}
export function EmptyState({ action, description, title }: StateProps) {
  return (
    <section className="ui-state">
      <Info aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}
export function ErrorState({ action, description, title }: StateProps) {
  return (
    <section className="ui-state ui-state--error" role="alert">
      <AlertCircle aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}
