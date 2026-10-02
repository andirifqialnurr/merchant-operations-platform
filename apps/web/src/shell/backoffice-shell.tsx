"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Package } from "lucide-react";

import { PERMISSIONS } from "@merchant/contracts";
import { AppIcon } from "@merchant/ui/app-icon";
import { AppShell, ContextSwitcher, UserMenu } from "@merchant/ui/app-shell";

import { useWorkspace } from "@/features/workspace";

import { shellMessages as t } from "./messages";

function subscribeToHydration() {
  return () => undefined;
}

export function BackofficeShell({
  children,
  onSignOut,
  user,
}: Readonly<{
  children: ReactNode;
  onSignOut: () => void;
  user: { displayName: string; email: string };
}>) {
  const pathname = usePathname();
  const { can, outlet, setOutletId, setTenantId, workspace, workspaces } = useWorkspace();
  const { setTheme, theme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );

  // Only modules the user may open appear here; the API still enforces access.
  const navigation = can(PERMISSIONS.catalogRead)
    ? [
        {
          active: pathname.startsWith("/catalog"),
          href: "/catalog",
          icon: <AppIcon icon={Package} />,
          label: t.navCatalog,
        },
      ]
    : [];

  return (
    <AppShell
      account={
        <UserMenu
          email={user.email}
          label={t.accountMenu}
          name={user.displayName}
          onSignOut={onSignOut}
          signOutLabel={t.signOut}
          theme={{
            label: t.theme,
            onChange: setTheme,
            options: [
              { label: t.themeLight, value: "light" },
              { label: t.themeDark, value: "dark" },
              { label: t.themeSystem, value: "system" },
            ],
            value: mounted ? (theme ?? "system") : "system",
          }}
        />
      }
      brand={t.brand}
      context={
        <ContextSwitcher
          label={t.switchContext}
          locationId={outlet?.id}
          locationLabel={t.outlet}
          locations={workspace.outlets.map((item) => ({ id: item.id, name: item.name }))}
          onLocationChange={setOutletId}
          onWorkspaceChange={setTenantId}
          workspaceId={workspace.tenant.id}
          workspaceLabel={t.workspace}
          workspaces={workspaces.map((item) => ({ id: item.tenant.id, name: item.tenant.name }))}
        />
      }
      labels={{
        closeNavigation: t.closeNavigation,
        navigation: t.navigation,
        openNavigation: t.openNavigation,
        skipToContent: t.skipToContent,
      }}
      navigation={navigation}
      renderLink={(_item, props) => <Link {...props} />}
    >
      {children}
    </AppShell>
  );
}
