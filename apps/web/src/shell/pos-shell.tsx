"use client";

import { useTranslations } from "next-intl";
import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconLayoutSidebar } from "@tabler/icons-react";

import { PERMISSIONS } from "@merchant/contracts";
import { AppIcon } from "@merchant/ui/app-icon";

import { useWorkspace } from "@/features/workspace";

import { ShellAccount, ShellContext, type ShellUser } from "./shell-controls";

/**
 * Full-screen cashier shell: a 56px top bar with the outlet, the cashier's
 * two surfaces, and the account menu. No sidebar, so the whole width belongs
 * to the task.
 */
export function PosShell({
  children,
  onSignOut,
  user,
}: Readonly<{
  children: ReactNode;
  onSignOut: () => void;
  user: ShellUser;
}>) {
  const t = useTranslations("shell");
  const pathname = usePathname();
  const { can } = useWorkspace();
  const surfaces = [
    ...(can(PERMISSIONS.orderCreate) ? [{ href: "/pos", label: t("navSell") }] : []),
    ...(can(PERMISSIONS.orderCreate) ? [{ href: "/pos/orders", label: t("navOrders") }] : []),
    ...(can(PERMISSIONS.shiftOpen) ? [{ href: "/pos/shift", label: t("navShift") }] : []),
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-foreground">
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-line-subtle bg-surface px-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <ShellContext />
        </div>
        <nav aria-label={t("posNavigation")} className="flex shrink-0 items-center gap-1">
          {surfaces.map((surface) => {
            const active = pathname === surface.href;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`ui-button ui-button--md ${active ? "ui-button--secondary" : "ui-button--ghost"}`}
                href={surface.href}
                key={surface.href}
              >
                <span className="ui-button__label">{surface.label}</span>
              </Link>
            );
          })}
        </nav>
        {/* The way back to the backoffice gives its space to the outlet on phones. */}
        {can(PERMISSIONS.catalogRead) ? (
          <span className="max-sm:hidden">
            <Link
              aria-label={t("openBackoffice")}
              className="ui-button ui-icon-button ui-button--md ui-button--ghost"
              href="/catalog"
              title={t("openBackoffice")}
            >
              <AppIcon icon={IconLayoutSidebar} />
            </Link>
          </span>
        ) : null}
        <ShellAccount onSignOut={onSignOut} user={user} />
      </header>
      <main className="mx-auto w-full max-w-[90rem] flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
