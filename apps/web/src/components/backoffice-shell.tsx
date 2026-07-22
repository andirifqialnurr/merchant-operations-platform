"use client";

import { type ReactNode, useState } from "react";
import { LogOut, Menu, Store } from "lucide-react";

import { AppIcon } from "@merchant/ui/app-icon";
import { Button, IconButton } from "@merchant/ui/button";
import { Avatar } from "@merchant/ui/data-display";
import { Sidebar, TopBar, type NavItem } from "@merchant/ui/navigation";
import { Sheet } from "@merchant/ui/overlay";

import { CompactThemeSwitcher } from "@/components/theme/theme-switcher";

type BackofficeShellProps = {
  children: ReactNode;
  navigation: readonly NavItem[];
  onLogout: () => void;
  user: {
    displayName: string;
    email: string;
  };
};

function ShellNavigation({
  navigation,
  onLogout,
  user,
}: Pick<BackofficeShellProps, "navigation" | "onLogout" | "user">) {
  return (
    <>
      <div className="backoffice-shell__navigation">
        <span className="backoffice-shell__navigation-label">Menu utama</span>
        <Sidebar items={navigation} />
      </div>
      <div className="backoffice-shell__account">
        <div className="backoffice-shell__user">
          <Avatar name={user.displayName} size="sm" />
          <span>
            <strong>{user.displayName}</strong>
            <small>{user.email}</small>
          </span>
        </div>
        <Button fullWidth iconLeft={LogOut} onClick={onLogout} size="sm" variant="ghost">
          Keluar
        </Button>
      </div>
    </>
  );
}

export function BackofficeShell({ children, navigation, onLogout, user }: BackofficeShellProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <div className="backoffice-shell">
      <a className="backoffice-shell__skip-link" href="#backoffice-content">
        Lewati navigasi
      </a>
      <aside className="backoffice-shell__sidebar">
        <div className="backoffice-shell__brand">
          <span>
            <AppIcon icon={Store} size="md" />
          </span>
          <strong>Merchant Ops</strong>
        </div>
        <ShellNavigation navigation={navigation} onLogout={onLogout} user={user} />
      </aside>
      <div className="backoffice-shell__main">
        <TopBar>
          <IconButton
            className="backoffice-shell__menu-trigger"
            icon={Menu}
            label="Buka navigasi"
            onClick={() => setMobileNavigationOpen(true)}
          />
          <strong className="backoffice-shell__topbar-title">Backoffice</strong>
          <div className="backoffice-shell__topbar-actions">
            <CompactThemeSwitcher />
          </div>
        </TopBar>
        <main className="backoffice-shell__content" id="backoffice-content">
          {children}
        </main>
      </div>
      <Sheet
        onOpenChange={setMobileNavigationOpen}
        open={mobileNavigationOpen}
        size="sm"
        title="Merchant Operations"
      >
        <div className="backoffice-shell__mobile-navigation">
          <ShellNavigation navigation={navigation} onLogout={onLogout} user={user} />
        </div>
      </Sheet>
    </div>
  );
}
