"use client";

import { useTranslations } from "next-intl";
import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCashRegister, IconPackage } from "@tabler/icons-react";

import { PERMISSIONS } from "@merchant/contracts";
import { AppIcon } from "@merchant/ui/app-icon";
import { Brand } from "@merchant/ui/brand";
import { AppShell } from "@merchant/ui/app-shell";

import { useWorkspace } from "@/features/workspace";

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
  const { can } = useWorkspace();

  // Only modules the user may open appear here; the API still enforces access.
  const navigation = [
    ...(can(PERMISSIONS.catalogRead)
      ? [
          {
            active: pathname.startsWith("/catalog"),
            href: "/catalog",
            icon: <AppIcon icon={IconPackage} />,
            label: t("navCatalog"),
          },
        ]
      : []),
    ...(can(PERMISSIONS.shiftOpen)
      ? [
          {
            active: false,
            href: "/pos",
            icon: <AppIcon icon={IconCashRegister} />,
            label: t("navPos"),
          },
        ]
      : []),
  ];

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
