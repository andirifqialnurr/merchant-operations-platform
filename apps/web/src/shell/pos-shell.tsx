"use client";

import { useTranslations } from "next-intl";
import { type ReactNode } from "react";
import Link from "next/link";
import { IconLayoutSidebar } from "@tabler/icons-react";

import { PERMISSIONS } from "@merchant/contracts";
import { AppIcon } from "@merchant/ui/app-icon";

import { useWorkspace } from "@/features/workspace";

import { ShellAccount, ShellContext, type ShellUser } from "./shell-controls";

/**
 * Full-screen cashier shell: a 56px top bar with the outlet and the account
 * menu, and no sidebar, so the whole width belongs to the task.
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
  const { can } = useWorkspace();

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-foreground">
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-line-subtle bg-surface px-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <ShellContext />
        </div>
        {can(PERMISSIONS.catalogRead) ? (
          <Link
            aria-label={t("openBackoffice")}
            className="ui-button ui-icon-button ui-button--md ui-button--ghost"
            href="/catalog"
            title={t("openBackoffice")}
          >
            <AppIcon icon={IconLayoutSidebar} />
          </Link>
        ) : null}
        <ShellAccount onSignOut={onSignOut} user={user} />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
