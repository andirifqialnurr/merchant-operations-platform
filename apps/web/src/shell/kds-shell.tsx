"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { IconArrowsMaximize, IconArrowsMinimize, IconLayoutSidebar } from "@tabler/icons-react";

import { PERMISSIONS } from "@merchant/contracts";
import { AppIcon } from "@merchant/ui/app-icon";
import { IconButton } from "@merchant/ui/button";

import { useWorkspace } from "@/features/workspace";

import { ShellAccount, ShellContext, type ShellUser } from "./shell-controls";

/** Whether the page fills the screen, and a way to switch that. */
function useFullscreen() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const sync = () => setActive(document.fullscreenElement !== null);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggle = () => {
    // A browser may refuse (e.g. inside a frame); the screen then stays as it is.
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  return { active, toggle };
}

/**
 * Full-screen kitchen shell: a 56px top bar with the outlet and the account,
 * and the whole screen for tickets. No sidebar. In kiosk mode the browser's
 * own chrome is hidden too.
 */
export function KdsShell({
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
  const fullscreen = useFullscreen();

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-foreground">
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-line-subtle bg-surface px-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <ShellContext />
        </div>
        <IconButton
          aria-pressed={fullscreen.active}
          icon={fullscreen.active ? IconArrowsMinimize : IconArrowsMaximize}
          label={t(fullscreen.active ? "exitKiosk" : "enterKiosk")}
          onClick={fullscreen.toggle}
          variant="ghost"
        />
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
      <main className="w-full flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
