"use client";

import { useTranslations } from "next-intl";
import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AppIcon } from "@merchant/ui/app-icon";
import { Brand } from "@merchant/ui/brand";
import { AppShell } from "@merchant/ui/app-shell";

import { useWorkspace } from "@/features/workspace";

import {
  isNavigableModule,
  MODULE_NAVIGATION,
  UNKNOWN_MODULE_ICON,
  useModuleNavigation,
} from "./module-navigation";
import { ShellAccount, ShellContext, type ShellUser } from "./shell-controls";

export function BackofficeShell({
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
  const { workspace } = useWorkspace();
  const entries = useModuleNavigation(workspace.tenant.id);

  // The menu comes from the API: modules in the subscription, installed, and
  // within the user's permissions. Until it arrives the menu is simply empty.
  const navigation = (entries.data?.entries ?? []).map((entry) => {
    const known = isNavigableModule(entry.moduleKey) ? MODULE_NAVIGATION[entry.moduleKey] : null;
    return {
      active: pathname === entry.path || pathname.startsWith(`${entry.path}/`),
      href: entry.path,
      icon: <AppIcon icon={known?.icon ?? UNKNOWN_MODULE_ICON} />,
      // A module this build cannot name yet is shown by its key rather than hidden.
      label: known ? t(known.labelKey) : entry.moduleKey,
    };
  });

  return (
    <AppShell
      account={<ShellAccount onSignOut={onSignOut} user={user} />}
      brand={<Brand name={t("brand")} />}
      context={<ShellContext />}
      labels={{
        closeNavigation: t("closeNavigation"),
        navigation: t("navigation"),
        openNavigation: t("openNavigation"),
        skipToContent: t("skipToContent"),
      }}
      navigation={navigation}
      renderLink={(_item, props) => <Link {...props} />}
    >
      {children}
    </AppShell>
  );
}
