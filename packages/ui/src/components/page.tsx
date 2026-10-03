"use client";

import { type ReactNode, useEffect, useState } from "react";
import { IconAdjustmentsHorizontal, IconX } from "@tabler/icons-react";

import { AppIcon } from "./app-icon";
import { Button } from "./button";
import { Sheet } from "./overlay";
import { Input } from "./text-field";

/*
 * Page-level patterns. Every label comes from props so the app can translate
 * them; none of these components fetch data or know about routing.
 */

export type ChipProps = {
  children: ReactNode;
  disabled?: boolean;
  /** Toggle chips: called when the chip body is pressed. */
  onClick?: () => void;
  /** Removable chips: shows a remove button. Requires `removeLabel`. */
  onRemove?: () => void;
  /** Accessible name of the remove button, e.g. "Hapus filter Status: Aktif". */
  removeLabel?: string;
  selected?: boolean;
};

/** A filter value. Unlike Badge it is interactive: it can be toggled or removed. */
export function Chip({ children, disabled, onClick, onRemove, removeLabel, selected }: ChipProps) {
  const className = ["ui-chip", selected && "ui-chip--selected"].filter(Boolean).join(" ");
  return (
    <span className={className}>
      {onClick ? (
        <button
          aria-pressed={selected ?? false}
          className="ui-chip__body"
          disabled={disabled}
          onClick={onClick}
          type="button"
        >
          {children}
        </button>
      ) : (
        <span className="ui-chip__body">{children}</span>
      )}
      {onRemove ? (
        <button
          aria-label={removeLabel}
          className="ui-chip__remove"
          disabled={disabled}
          onClick={onRemove}
          type="button"
        >
          <AppIcon icon={IconX} size="xs" />
        </button>
      ) : null}
    </span>
  );
}

export type PageHeaderProps = {
  /** Shown above the title on second-level pages only. */
  breadcrumb?: ReactNode;
  /** The single primary action of the page. */
  primaryAction?: ReactNode;
  /** At most two visible secondary actions; put the rest in an overflow menu. */
  secondaryActions?: ReactNode;
  /** Tabs for equivalent views of the same page. */
  tabs?: ReactNode;
  /** A short noun, at most three words. There is deliberately no description slot. */
  title: string;
};

export function PageHeader({
  breadcrumb,
  primaryAction,
  secondaryActions,
  tabs,
  title,
}: PageHeaderProps) {
  return (
    <header className={tabs ? "ui-page-header ui-page-header--with-tabs" : "ui-page-header"}>
      {breadcrumb ? <div className="ui-page-header__breadcrumb">{breadcrumb}</div> : null}
      <div className="ui-page-header__row">
        <h1>{title}</h1>
        {primaryAction || secondaryActions ? (
          <div className="ui-page-header__actions">
            {secondaryActions}
            {primaryAction}
          </div>
        ) : null}
      </div>
      {tabs ? <div className="ui-page-header__tabs">{tabs}</div> : null}
    </header>
  );
}

export type FilterChip = {
  key: string;
  label: ReactNode;
  onRemove: () => void;
  removeLabel: string;
};
export type FilterBarProps = {
  /** Active filters shown as removable chips under the bar. */
  chips?: readonly FilterChip[];
  /** Up to three filter controls shown inline; on small screens they move into a sheet. */
  children?: ReactNode;
  /** Label of the button that opens the filter sheet on small screens, e.g. "Filter". */
  filtersLabel?: string;
  onReset?: () => void;
  resetLabel?: string;
  search?: {
    clearLabel: string;
    label: string;
    onChange: (value: string) => void;
    placeholder?: string;
    value: string;
  };
  /** Title and close label of the filter sheet on small screens. */
  sheetCloseLabel: string;
  /** Label of the button that closes the sheet and shows results. */
  sheetDoneLabel?: string;
};

const SMALL_QUERY = "(max-width: 47.9375rem)";

function useIsSmall() {
  const [small, setSmall] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(SMALL_QUERY);
    const sync = () => setSmall(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return small;
}

export function FilterBar({
  chips = [],
  children,
  filtersLabel,
  onReset,
  resetLabel,
  search,
  sheetCloseLabel,
  sheetDoneLabel,
}: FilterBarProps) {
  const small = useIsSmall();
  const [sheetOpen, setSheetOpen] = useState(false);
  const inSheet = small && Boolean(children) && Boolean(filtersLabel);
  const hasActive = chips.length > 0;

  return (
    <div className="ui-filter-bar">
      <div className="ui-filter-bar__row">
        {search ? (
          <div className="ui-filter-bar__search">
            <Input
              aria-label={search.label}
              clearLabel={search.clearLabel}
              clearable={Boolean(search.value)}
              onChange={(event) => search.onChange(event.target.value)}
              onClear={() => search.onChange("")}
              placeholder={search.placeholder}
              value={search.value}
              variant="search"
            />
          </div>
        ) : null}
        {inSheet ? (
          <Button
            iconLeft={IconAdjustmentsHorizontal}
            onClick={() => setSheetOpen(true)}
            variant="secondary"
          >
            {hasActive ? `${filtersLabel} (${chips.length})` : filtersLabel}
          </Button>
        ) : children ? (
          <div className="ui-filter-bar__filters">{children}</div>
        ) : null}
      </div>
      {hasActive ? (
        <div className="ui-filter-bar__chips">
          {chips.map((chip) => (
            <Chip key={chip.key} onRemove={chip.onRemove} removeLabel={chip.removeLabel}>
              {chip.label}
            </Chip>
          ))}
          {onReset && resetLabel ? (
            <Button onClick={onReset} size="sm" variant="link">
              {resetLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
      {inSheet ? (
        <Sheet
          closeLabel={sheetCloseLabel}
          footer={
            sheetDoneLabel ? (
              <Button onClick={() => setSheetOpen(false)}>{sheetDoneLabel}</Button>
            ) : undefined
          }
          onOpenChange={setSheetOpen}
          open={sheetOpen}
          size="sm"
          title={filtersLabel ?? ""}
        >
          <div className="ui-filter-bar__sheet">{children}</div>
        </Sheet>
      ) : null}
    </div>
  );
}
