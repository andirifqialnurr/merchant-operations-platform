"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, MonitorCog, PackageSearch, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AppIcon } from "@merchant/ui/app-icon";
import { Button } from "@merchant/ui/button";
import { Badge, StatusBar } from "@merchant/ui/feedback";

export type MerchantDeviceMode = "POS" | "KDS" | "BACKOFFICE" | "INVENTORY";

const DEVICE_MODE_STORAGE_KEY = "merchant-device-mode-v1";

type DeviceModeOption = {
  description: string;
  href: string;
  icon: LucideIcon;
  label: string;
  mode: MerchantDeviceMode;
  surface: string;
};

const deviceModes = [
  {
    description: "Mode kasir untuk tablet atau desktop transaksi.",
    href: "/pos",
    icon: MonitorCog,
    label: "POS",
    mode: "POS",
    surface: "Kasir",
  },
  {
    description: "Mode dapur untuk layar antrean pesanan.",
    href: "/kds",
    icon: ChefHat,
    label: "KDS",
    mode: "KDS",
    surface: "Kitchen display",
  },
  {
    description: "Mode administrasi merchant untuk katalog dan operasional.",
    href: "/backoffice/catalog",
    icon: Store,
    label: "Backoffice",
    mode: "BACKOFFICE",
    surface: "Backoffice",
  },
  {
    description: "Mode stok untuk pencatatan dan review inventory.",
    href: "/inventory",
    icon: PackageSearch,
    label: "Inventory",
    mode: "INVENTORY",
    surface: "Inventory",
  },
] as const satisfies readonly DeviceModeOption[];

function isMerchantDeviceMode(value: string | null): value is MerchantDeviceMode {
  return deviceModes.some((item) => item.mode === value);
}

function setRootDeviceMode(mode: MerchantDeviceMode) {
  document.documentElement.dataset.deviceMode = mode.toLowerCase();
}

function getDeviceModeSnapshot(): MerchantDeviceMode {
  if (typeof window === "undefined") {
    return "BACKOFFICE";
  }

  const storedMode = window.localStorage.getItem(DEVICE_MODE_STORAGE_KEY);
  return isMerchantDeviceMode(storedMode) ? storedMode : "BACKOFFICE";
}

function subscribeDeviceMode(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("merchant-device-mode-change", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("merchant-device-mode-change", onStoreChange);
  };
}

export function DeviceModeSelector() {
  const router = useRouter();
  const selectedMode = useSyncExternalStore<MerchantDeviceMode>(
    subscribeDeviceMode,
    getDeviceModeSnapshot,
    () => "BACKOFFICE",
  );

  useEffect(() => {
    setRootDeviceMode(selectedMode);
  }, [selectedMode]);

  const selectedDevice = useMemo(
    () => deviceModes.find((item) => item.mode === selectedMode) ?? deviceModes[2],
    [selectedMode],
  );

  function selectMode(item: DeviceModeOption) {
    window.localStorage.setItem(DEVICE_MODE_STORAGE_KEY, item.mode);
    window.dispatchEvent(
      new CustomEvent("merchant-device-mode-change", { detail: { mode: item.mode } }),
    );
    router.push(item.href);
  }

  return (
    <>
      <section aria-labelledby="device-mode-title" className="device-mode-panel">
        <p className="text-caption-xs uppercase text-primary">Merchant PWA</p>
        <div className="device-mode-panel__header">
          <div className="device-mode-panel__title-row">
            <div>
              <h1 className="text-title" id="device-mode-title">
                Device Mode
              </h1>
              <p className="mt-2 max-w-3xl text-body text-foreground-secondary">
                Pilih surface awal untuk perangkat ini. Hak akses tetap mengikuti sesi server saat
                pengguna masuk.
              </p>
            </div>
            <StatusBar label="Mode aktif" tone="info">
              {selectedDevice.label}
            </StatusBar>
          </div>
        </div>

        <div className="device-mode-grid">
          {deviceModes.map((item) => {
            const selected = item.mode === selectedMode;
            return (
              <article
                aria-current={selected ? "true" : undefined}
                className="device-mode-card"
                key={item.mode}
              >
                <div className="device-mode-card__top">
                  <span className="device-mode-card__icon">
                    <AppIcon icon={item.icon} label={item.label} size="lg" />
                  </span>
                  {selected ? <Badge tone="success">Aktif</Badge> : null}
                </div>
                <div className="device-mode-card__copy">
                  <p className="text-caption text-foreground-muted">{item.surface}</p>
                  <h2 className="text-heading-sm">{item.label}</h2>
                  <p className="text-body-sm text-foreground-secondary">{item.description}</p>
                </div>
                <Button
                  className="device-mode-card__action"
                  fullWidth
                  onClick={() => selectMode(item)}
                  size="md"
                  type="button"
                  variant={selected ? "primary" : "secondary"}
                >
                  {selected ? "Buka " + item.label : "Pilih " + item.label}
                </Button>
              </article>
            );
          })}
        </div>
      </section>

      <aside aria-label="Ringkasan device mode" className="device-mode-context">
        <div>
          <p className="text-caption text-foreground-muted">Landing surface</p>
          <h2 className="mt-1 text-heading-sm">{selectedDevice.surface}</h2>
          <p className="mt-2 text-body-sm text-foreground-secondary">
            Preferensi tersimpan lokal pada perangkat. Mutasi operasional tetap menunggu server
            acknowledgement.
          </p>
        </div>
        <div className="device-mode-context__rows">
          <div className="device-mode-context__row">
            <p className="text-caption text-foreground-muted">Aksi server</p>
            <p className="text-body-sm text-foreground">
              Submit order, payment confirmation, refund, stock adjustment, approval, dan shift
              closing.
            </p>
          </div>
          <div className="device-mode-context__row">
            <p className="text-caption text-foreground-muted">Cache lokal</p>
            <p className="text-body-sm text-foreground">
              Application shell, last-known menu, draft cart, dan display state aman.
            </p>
          </div>
        </div>
        <div className="device-mode-reference">
          <p className="text-caption text-foreground-muted">Design reference</p>
          <p className="text-body-sm text-foreground">
            Frame teal, sidebar pill, topbar search, dan panel kanan mengikuti Tasty Station.
          </p>
        </div>
        <div className="device-mode-context__actions">
          <a className="ui-button ui-button--md ui-button--primary" href={selectedDevice.href}>
            <span className="ui-button__label">Buka surface aktif</span>
          </a>
          <a className="ui-button ui-button--md ui-button--outline" href="/design-system">
            <span className="ui-button__label">Review design system</span>
          </a>
        </div>
      </aside>
    </>
  );
}
