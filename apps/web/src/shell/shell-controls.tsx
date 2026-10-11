"use client";

import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";

import { PERMISSIONS, type UserLocale, type UserTheme } from "@merchant/contracts";

import { ContextSwitcher, UserMenu } from "@merchant/ui/app-shell";

import { useUpdatePreferences } from "@/features/auth";
import { useOptionalWorkspace, useWorkspace } from "@/features/workspace";
import { merchantApi } from "@/lib/api-client";
import { localeOptions, useLocaleSwitch } from "@/i18n/use-locale-switch";

import { ApprovalPinDialog, approvalPinKey } from "./approval-pin-dialog";

export type ShellUser = {
  displayName: string;
  email: string;
  locale: UserLocale | null;
  theme: UserTheme | null;
};

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
  const savePreferences = useUpdatePreferences();
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );

  // Only someone who can approve has a PIN to look after, and only inside a workspace.
  const workspace = useOptionalWorkspace()?.workspace;
  const tenantId = workspace?.tenant.id;
  const mayApprove = workspace?.permissionKeys.includes(PERMISSIONS.paymentRefund) ?? false;
  const approvalPin = useQuery({
    enabled: Boolean(tenantId) && mayApprove,
    queryFn: () => merchantApi.approvalPinStatus(tenantId ?? ""),
    queryKey: approvalPinKey(tenantId ?? ""),
  });
  const [pinOpen, setPinOpen] = useState(false);

  return (
    <>
      <UserMenu
        {...(tenantId && approvalPin.data?.canApprove
          ? {
              actions: [
                {
                  label: approvalPin.data.hasPin ? t("changeApprovalPin") : t("setApprovalPin"),
                  onSelect: () => setPinOpen(true),
                },
              ],
            }
          : {})}
        email={user.email}
        label={t("accountMenu")}
        language={{
          label: t("language"),
          onChange: (next) => {
            setLocale(next);
            if (next === "id" || next === "en") savePreferences.mutate({ locale: next });
          },
          options: localeOptions,
          value: locale,
        }}
        name={user.displayName}
        onSignOut={onSignOut}
        signOutLabel={t("signOut")}
        theme={{
          label: t("theme"),
          onChange: (next) => {
            setTheme(next);
            if (next === "light" || next === "dark" || next === "system") {
              savePreferences.mutate({ theme: next });
            }
          },
          options: [
            { label: t("themeLight"), value: "light" },
            { label: t("themeDark"), value: "dark" },
            { label: t("themeSystem"), value: "system" },
          ],
          value: mounted ? (theme ?? "system") : "system",
        }}
      />
      {pinOpen && tenantId ? (
        <ApprovalPinDialog
          hasPin={approvalPin.data?.hasPin ?? false}
          onClose={() => setPinOpen(false)}
          tenantId={tenantId}
        />
      ) : null}
    </>
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
