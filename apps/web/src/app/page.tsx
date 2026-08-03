import Link from "next/link";
import {
  Bell,
  ChefHat,
  HelpCircle,
  LayoutDashboard,
  MonitorCog,
  PackageSearch,
  Search,
  Settings,
  Store,
} from "lucide-react";

import { DeviceModeSelector } from "@/components/device-mode-selector";
import { AppIcon } from "@merchant/ui/app-icon";

const primaryNav = [
  { href: "/", icon: LayoutDashboard, label: "Device Mode" },
  { href: "/pos", icon: MonitorCog, label: "POS" },
  { href: "/kds", icon: ChefHat, label: "KDS" },
  { href: "/backoffice/catalog", icon: Store, label: "Catalog" },
  { href: "/inventory", icon: PackageSearch, label: "Inventory" },
] as const;

export default function HomePage() {
  return (
    <main className="device-home">
      <div className="device-home__frame">
        <aside aria-label="Navigasi merchant" className="device-home__sidebar">
          <div className="device-home__brand">
            <span aria-hidden="true" className="device-home__brand-mark">
              MO
            </span>
            <div>
              <p className="text-heading-sm">Merchant Ops</p>
              <p className="text-caption text-foreground-muted">Tasty Station reference</p>
            </div>
          </div>

          <nav className="device-home__nav">
            {primaryNav.map((item) => (
              <Link
                aria-current={item.href === "/" ? "page" : undefined}
                className={[
                  "device-home__nav-link",
                  item.href === "/" ? "device-home__nav-link--active" : "",
                ].join(" ")}
                href={item.href}
                key={item.href}
              >
                <AppIcon icon={item.icon} size="sm" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="device-home__secondary">
            <Link className="device-home__nav-link" href="/design-system">
              <AppIcon icon={Settings} size="sm" />
              <span>Design System</span>
            </Link>
            <Link className="device-home__nav-link" href="/foundation">
              <AppIcon icon={HelpCircle} size="sm" />
              <span>Foundation</span>
            </Link>
          </div>
        </aside>

        <section className="device-home__body">
          <header className="device-home__topbar">
            <div aria-label="Pencarian modul" className="device-home__search" role="search">
              <AppIcon icon={Search} size="sm" />
              <span>Pilih surface operasional merchant</span>
            </div>
            <div className="device-home__profile">
              <AppIcon icon={Bell} label="Notifikasi" size="sm" />
              <span aria-hidden="true" className="device-home__avatar">
                CO
              </span>
              <div>
                <p className="text-body-sm">Catalog Owner</p>
                <p className="text-caption text-foreground-muted">Local device</p>
              </div>
            </div>
          </header>

          <div className="device-home__content">
            <DeviceModeSelector />
          </div>
        </section>
      </div>
    </main>
  );
}
