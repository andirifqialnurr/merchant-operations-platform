"use client";

import { type ReactNode, useState } from "react";
import { Check, ChevronsUpDown, LogOut, Menu } from "lucide-react";

import { AppIcon } from "./app-icon";
import { IconButton } from "./button";
import { Avatar } from "./data-display";
import { type NavItem, type NavLinkRenderer, Sidebar } from "./navigation";
import { Popover, Sheet } from "./overlay";
import { SegmentedControl } from "./selection-control";

/*
 * Application shell for Backoffice and Platform Admin. Workspace/location
 * context and the account menu live here and nowhere else, so pages never
 * repeat them. Every label comes from props.
 */

export type AppShellLabels = {
  /** Close button of the mobile navigation drawer. */
  closeNavigation: string;
  /** Accessible name of the bottom navigation group; required with footerNavigation. */
  moreNavigation?: string;
  /** Accessible name of the navigation landmark and title of the mobile drawer. */
  navigation: string;
  /** Button that opens the navigation drawer on small screens. */
  openNavigation: string;
  /** Skip link shown on keyboard focus. */
  skipToContent: string;
};
export type AppShellProps = {
  /** UserMenu, rendered at the end of the top bar. */
  account?: ReactNode;
  /** Product mark and name, shown at the top of the sidebar. */
  brand: ReactNode;
  children: ReactNode;
  /** ContextSwitcher, rendered at the start of the top bar. */
  context?: ReactNode;
  /** Items pinned to the bottom of the sidebar, e.g. "Explore modules". */
  footerNavigation?: readonly NavItem[];
  labels: AppShellLabels;
  /** Only installed, entitled, and permitted modules. */
  navigation: readonly NavItem[];
  renderLink?: NavLinkRenderer;
};

export function AppShell({
  account,
  brand,
  children,
  context,
  footerNavigation = [],
  labels,
  navigation,
  renderLink,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const linkProps = renderLink ? { renderLink } : {};

  function navigationBlock(collapsed: boolean, onNavigate?: () => void) {
    const navigateProps = onNavigate ? { onNavigate } : {};
    return (
      <>
        <Sidebar
          {...linkProps}
          {...navigateProps}
          collapsed={collapsed}
          items={navigation}
          label={labels.navigation}
        />
        {footerNavigation.length ? (
          <div className="ui-app-shell__footer-navigation">
            <Sidebar
              {...linkProps}
              {...navigateProps}
              collapsed={collapsed}
              items={footerNavigation}
              label={labels.moreNavigation ?? labels.navigation}
            />
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="ui-app-shell">
      <a className="ui-app-shell__skip" href="#ui-app-shell-content">
        {labels.skipToContent}
      </a>
      <aside className="ui-app-shell__sidebar ui-app-shell__sidebar--expanded">
        <div className="ui-app-shell__brand">{brand}</div>
        {navigationBlock(false)}
      </aside>
      <aside className="ui-app-shell__sidebar ui-app-shell__sidebar--rail">
        {navigationBlock(true)}
      </aside>
      <div className="ui-app-shell__main">
        <header className="ui-app-shell__top-bar">
          <span className="ui-app-shell__menu">
            <IconButton
              aria-expanded={drawerOpen}
              icon={Menu}
              label={labels.openNavigation}
              onClick={() => setDrawerOpen(true)}
            />
          </span>
          <div className="ui-app-shell__context">{context}</div>
          <div className="ui-app-shell__account">{account}</div>
        </header>
        <main className="ui-app-shell__content" id="ui-app-shell-content" tabIndex={-1}>
          {children}
        </main>
      </div>
      <Sheet
        closeLabel={labels.closeNavigation}
        onOpenChange={setDrawerOpen}
        open={drawerOpen}
        side="start"
        size="sm"
        title={labels.navigation}
      >
        <div className="ui-app-shell__drawer">
          {navigationBlock(false, () => setDrawerOpen(false))}
        </div>
      </Sheet>
    </div>
  );
}

export type ContextOption = { id: string; name: string };
export type ContextSwitcherProps = {
  /** Accessible name of the trigger, e.g. "Ganti bisnis atau lokasi". */
  label: string;
  locationId?: string | undefined;
  /** Heading of the location list, following the business template (Outlet, Cabang, …). */
  locationLabel: string;
  locations: readonly ContextOption[];
  onLocationChange?: (id: string) => void;
  onWorkspaceChange?: (id: string) => void;
  workspaceId: string;
  /** Heading of the workspace list (Bisnis, Perusahaan, …). */
  workspaceLabel: string;
  workspaces: readonly ContextOption[];
};

function ContextList({
  heading,
  onSelect,
  options,
  selectedId,
}: {
  heading: string;
  onSelect: (id: string) => void;
  options: readonly ContextOption[];
  selectedId?: string | undefined;
}) {
  return (
    <div aria-label={heading} className="ui-context-switcher__group" role="group">
      <span className="ui-context-switcher__heading">{heading}</span>
      {options.map((option) => (
        <button
          aria-pressed={option.id === selectedId}
          key={option.id}
          onClick={() => onSelect(option.id)}
          type="button"
        >
          <span>{option.name}</span>
          {option.id === selectedId ? <AppIcon icon={Check} size="sm" /> : null}
        </button>
      ))}
    </div>
  );
}

/** The single place where the active workspace and location are shown and changed. */
export function ContextSwitcher({
  label,
  locationId,
  locationLabel,
  locations,
  onLocationChange,
  onWorkspaceChange,
  workspaceId,
  workspaceLabel,
  workspaces,
}: ContextSwitcherProps) {
  const [open, setOpen] = useState(false);
  const workspace = workspaces.find((item) => item.id === workspaceId);
  const location = locations.find((item) => item.id === locationId);
  const switchable = workspaces.length > 1 || locations.length > 1;

  const summary = (
    <span className="ui-context-switcher__summary">
      <strong>{workspace?.name}</strong>
      {location ? <span>{location.name}</span> : null}
    </span>
  );
  if (!switchable) return <div className="ui-context-switcher">{summary}</div>;

  return (
    <div className="ui-context-switcher">
      <Popover
        content={
          <div className="ui-context-switcher__menu">
            {workspaces.length > 1 ? (
              <ContextList
                heading={workspaceLabel}
                onSelect={(id) => {
                  onWorkspaceChange?.(id);
                  setOpen(false);
                }}
                options={workspaces}
                selectedId={workspaceId}
              />
            ) : null}
            {locations.length > 1 ? (
              <ContextList
                heading={locationLabel}
                onSelect={(id) => {
                  onLocationChange?.(id);
                  setOpen(false);
                }}
                options={locations}
                selectedId={locationId}
              />
            ) : null}
          </div>
        }
        label={label}
        onOpenChange={setOpen}
        open={open}
      >
        <span className="ui-context-switcher__trigger">
          {summary}
          <AppIcon icon={ChevronsUpDown} size="sm" />
        </span>
      </Popover>
    </div>
  );
}

export type UserMenuChoice = {
  label: string;
  onChange: (value: string) => void;
  options: readonly { label: string; value: string }[];
  value: string;
};
export type UserMenuProps = {
  email: string;
  /** Accessible name of the trigger, e.g. "Menu akun". */
  label: string;
  /** Language choice, e.g. Indonesia / English. */
  language?: UserMenuChoice;
  name: string;
  onSignOut: () => void;
  signOutLabel: string;
  /** Theme choice: light, dark, system. */
  theme?: UserMenuChoice;
};

/** Account, language, theme, and sign out. The only place the user's name and email appear. */
export function UserMenu({
  email,
  label,
  language,
  name,
  onSignOut,
  signOutLabel,
  theme,
}: UserMenuProps) {
  return (
    <Popover
      align="end"
      content={
        <div className="ui-user-menu">
          <div className="ui-user-menu__identity">
            <strong>{name}</strong>
            <span>{email}</span>
          </div>
          {[language, theme].map((choice) =>
            choice ? (
              <div className="ui-user-menu__choice" key={choice.label}>
                <span>{choice.label}</span>
                <SegmentedControl
                  items={choice.options}
                  label={choice.label}
                  onValueChange={choice.onChange}
                  size="sm"
                  value={choice.value}
                />
              </div>
            ) : null,
          )}
          <button className="ui-user-menu__sign-out" onClick={onSignOut} type="button">
            <AppIcon icon={LogOut} size="sm" />
            <span>{signOutLabel}</span>
          </button>
        </div>
      }
      label={label}
    >
      <Avatar name={name} size="sm" />
    </Popover>
  );
}
