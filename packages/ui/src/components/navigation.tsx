"use client";
import type { ReactNode } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { AppIcon } from "./app-icon";

/*
 * Label props default to Indonesian until the i18n checkpoint moves every
 * default into the id/en dictionaries.
 */
export type NavItem = { href?: string; icon?: ReactNode; label: string; active?: boolean };
/** Lets the app render its router link (e.g. next/link) instead of a plain anchor. */
export type NavLinkRenderer = (
  item: NavItem,
  props: {
    "aria-current": "page" | undefined;
    children: ReactNode;
    className: string | undefined;
    href: string;
    title: string | undefined;
  },
) => ReactNode;
export type TabsVariant = "line" | "contained" | "vertical";
export type TabsSize = "sm" | "md" | "lg";
export function Sidebar({
  collapsed = false,
  items,
  label = "Navigasi utama",
  mobile = false,
  onNavigate,
  renderLink,
}: {
  collapsed?: boolean;
  items: readonly NavItem[];
  /** Accessible name of the navigation landmark. */
  label?: string;
  mobile?: boolean;
  /** Called after an item is activated, e.g. to close a mobile drawer. */
  onNavigate?: () => void;
  renderLink?: NavLinkRenderer;
}) {
  return (
    <nav
      aria-label={label}
      className={`ui-sidebar ${collapsed ? "ui-sidebar--collapsed" : ""} ${mobile ? "ui-sidebar--mobile" : ""}`}
    >
      {items.map((item) => {
        const linkProps = {
          "aria-current": item.active ? ("page" as const) : undefined,
          children: (
            <>
              {item.icon ?? (
                <span aria-hidden="true" className="ui-sidebar__initial">
                  {item.label.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="ui-sidebar__label">{item.label}</span>
            </>
          ),
          className: item.active ? "is-active" : undefined,
          href: item.href ?? "#",
          title: collapsed ? item.label : undefined,
        };
        return (
          <span className="ui-sidebar__item" key={item.label} onClick={onNavigate}>
            {renderLink ? renderLink(item, linkProps) : <a {...linkProps} />}
          </span>
        );
      })}
    </nav>
  );
}
export function TopBar({ children }: { children: ReactNode }) {
  return <header className="ui-top-bar">{children}</header>;
}
export function Tabs({
  items,
  label,
  size = "md",
  value,
  onValueChange,
  variant = "line",
}: {
  items: readonly { label: string; value: string; disabled?: boolean }[];
  /** Accessible name of the tab list. */
  label?: string;
  size?: TabsSize;
  value: string;
  onValueChange: (value: string) => void;
  variant?: TabsVariant;
}) {
  const vertical = variant === "vertical";
  const forward = vertical ? "ArrowDown" : "ArrowRight";
  const backward = vertical ? "ArrowUp" : "ArrowLeft";
  function move(index: number, direction: 1 | -1, target: HTMLElement) {
    for (let offset = 1; offset <= items.length; offset += 1) {
      const nextIndex = (index + direction * offset + items.length) % items.length;
      const next = items[nextIndex];
      if (next && !next.disabled) {
        onValueChange(next.value);
        const tabs = target.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]');
        tabs?.[nextIndex]?.focus();
        return;
      }
    }
  }
  return (
    <div
      aria-label={label}
      aria-orientation={vertical ? "vertical" : "horizontal"}
      className={`ui-tabs ui-tabs--${variant} ui-tabs--${size}`}
      role="tablist"
    >
      {items.map((item, index) => (
        <button
          aria-selected={item.value === value}
          disabled={item.disabled}
          key={item.value}
          onClick={() => onValueChange(item.value)}
          onKeyDown={(event) => {
            if (event.key === forward || event.key === backward) {
              event.preventDefault();
              move(index, event.key === forward ? 1 : -1, event.currentTarget);
            }
          }}
          role="tab"
          tabIndex={item.value === value ? 0 : -1}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
export function Breadcrumb({
  items,
  label = "Breadcrumb",
}: {
  items: readonly { label: string; href?: string }[];
  label?: string;
}) {
  const visible = items.slice(-3);
  return (
    <nav aria-label={label} className="ui-breadcrumb">
      <ol>
        {visible.map((item, index) => {
          const last = index === visible.length - 1;
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
  formatRange = (start, end, total) => `${start}-${end} dari ${total}`,
  label = "Pagination",
  nextLabel = "Halaman berikutnya",
  page,
  onPageChange,
  pageSize = 25,
  previousLabel = "Halaman sebelumnya",
  total,
}: {
  /** Builds the visible range text, e.g. "1-25 dari 240". */
  formatRange?: (start: number, end: number, total: number) => string;
  label?: string;
  nextLabel?: string;
  page: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  previousLabel?: string;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <nav aria-label={label} className="ui-pagination">
      <span>{formatRange(start, end, total)}</span>
      <div>
        <button
          aria-label={previousLabel}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          type="button"
        >
          <AppIcon icon={IconChevronLeft} size="sm" />
        </button>
        <span aria-hidden="true">
          {page}/{pages}
        </span>
        <button
          aria-label={nextLabel}
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          <AppIcon icon={IconChevronRight} size="sm" />
        </button>
      </div>
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
          aria-current={index === current ? "step" : undefined}
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
