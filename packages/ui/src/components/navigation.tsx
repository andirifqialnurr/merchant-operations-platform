"use client";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppIcon } from "./app-icon";
export type NavItem = { href?: string; icon?: ReactNode; label: string; active?: boolean };
export type TabsVariant = "line" | "contained" | "vertical";
export type TabsSize = "sm" | "md" | "lg";
export function Sidebar({
  collapsed = false,
  items,
  mobile = false,
}: {
  collapsed?: boolean;
  items: readonly NavItem[];
  mobile?: boolean;
}) {
  return (
    <nav
      aria-label="Navigasi utama"
      className={`ui-sidebar ${collapsed ? "ui-sidebar--collapsed" : ""} ${mobile ? "ui-sidebar--mobile" : ""}`}
    >
      {items.map((item) => (
        <a
          aria-current={item.active ? "page" : undefined}
          className={item.active ? "is-active" : undefined}
          href={item.href ?? "#"}
          key={item.label}
        >
          {item.icon}
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}
export function TopBar({ children }: { children: ReactNode }) {
  return <header className="ui-top-bar">{children}</header>;
}
export function Tabs({
  items,
  size = "md",
  value,
  onValueChange,
  variant = "line",
}: {
  items: readonly { label: string; value: string; disabled?: boolean }[];
  size?: TabsSize;
  value: string;
  onValueChange: (value: string) => void;
  variant?: TabsVariant;
}) {
  return (
    <div className={`ui-tabs ui-tabs--${variant} ui-tabs--${size}`} role="tablist">
      {items.map((item, index) => (
        <button
          aria-selected={item.value === value}
          disabled={item.disabled}
          key={item.value}
          onClick={() => onValueChange(item.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              const next =
                items[
                  (index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length
                ];
              if (next && !next.disabled) onValueChange(next.value);
            }
          }}
          role="tab"
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
export function Breadcrumb({ items }: { items: readonly { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="ui-breadcrumb">
      <ol>
        {items.slice(-4).map((item, index) => {
          const last = index === Math.min(items.length, 4) - 1;
          return (
            <li key={item.label}>
              {last ? (
                <span aria-current="page">{item.label}</span>
              ) : (
                <a href={item.href ?? "#"}>{item.label}</a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
export function Pagination({
  page,
  onPageChange,
  pageSize = 25,
  total,
}: {
  page: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="ui-pagination">
      <span>
        {start}-{end} dari {total}
      </span>
      <button
        aria-label="Halaman sebelumnya"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        type="button"
      >
        <AppIcon icon={ChevronLeft} size="sm" />
      </button>
      <span>
        {page}/{pages}
      </span>
      <button
        aria-label="Halaman berikutnya"
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
        type="button"
      >
        <AppIcon icon={ChevronRight} size="sm" />
      </button>
    </nav>
  );
}
export function Stepper({
  steps,
  current,
}: {
  steps: readonly { label: string; error?: boolean }[];
  current: number;
}) {
  return (
    <ol className="ui-stepper">
      {steps.map((step, index) => (
        <li
          className={
            step.error
              ? "is-error"
              : index < current
                ? "is-complete"
                : index === current
                  ? "is-current"
                  : ""
          }
          key={step.label}
        >
          <span>{index + 1}</span>
          <span>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
