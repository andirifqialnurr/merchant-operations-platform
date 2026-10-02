"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

import { ContextSwitcher, UserMenu } from "@merchant/ui/app-shell";

import { useWorkspace } from "@/features/workspace";
import { localeOptions, useLocaleSwitch } from "@/i18n/use-locale-switch";

export type ShellUser = { displayName: string; email: string };

function subscribeToHydration() {
  return () => undefined;
}

/** Account, language, theme, and sign out; shared by every signed-in shell. */
export function ShellAccount({
  onSignOut,
  user,
}: Readonly<{ onSignOut: () => void; user: ShellUser }>) {
  const t = useTranslations("shell");
  const { setTheme, theme } = useTheme();
  const { locale, setLocale } = useLocaleSwitch();
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );

  return (
    <UserMenu
      email={user.email}
      label={t("accountMenu")}
      language={{
        label: t("language"),
        onChange: setLocale,
        options: localeOptions,
        value: locale,
      }}
      name={user.displayName}
      onSignOut={onSignOut}
      signOutLabel={t("signOut")}
      theme={{
        label: t("theme"),
        onChange: setTheme,
        options: [
          { label: t("themeLight"), value: "light" },
          { label: t("themeDark"), value: "dark" },
          { label: t("themeSystem"), value: "system" },
        ],
        value: mounted ? (theme ?? "system") : "system",
      }}
    />
  );
}

/** Active workspace and outlet; the only place they are shown and changed. */
export function ShellContext() {
  const t = useTranslations("shell");
  const { outlet, setOutletId, setTenantId, workspace, workspaces } = useWorkspace();

  return (
    <ContextSwitcher
      label={t("switchContext")}
      locationId={outlet?.id}
      locationLabel={t("outlet")}
      locations={workspace.outlets.map((item) => ({ id: item.id, name: item.name }))}
      onLocationChange={setOutletId}
      onWorkspaceChange={setTenantId}
      workspaceId={workspace.tenant.id}
      workspaceLabel={t("workspace")}
      workspaces={workspaces.map((item) => ({ id: item.tenant.id, name: item.tenant.name }))}
    />
  );
}
