"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ChefHat, MonitorCog, PackageSearch, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AppIcon } from "@merchant/ui/app-icon";
import { Button } from "@merchant/ui/button";
import { Badge, StatusBar } from "@merchant/ui/feedback";

export type MerchantDeviceMode = "POS" | "KDS" | "BACKOFFICE" | "INVENTORY";

const DEVICE_MODE_STORAGE_KEY = "merchant-device-mode-v1";

const deviceModes = [
  {
    description: "Mode kasir untuk tablet atau desktop transaksi.",
    href: "/",
    icon: MonitorCog,
    label: "POS",
    mode: "POS",
    surface: "Kasir",
  },
  {
    description: "Mode dapur untuk layar antrean pesanan.",
    href: "/",
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
    href: "/",
    icon: PackageSearch,
    label: "Inventory",
    mode: "INVENTORY",
    surface: "Inventory",
  },
] as const satisfies readonly {
  description: string;
  href: string;
  icon: LucideIcon;
  label: string;
  mode: MerchantDeviceMode;
  surface: string;
}[];

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

  function selectMode(mode: MerchantDeviceMode) {
    window.localStorage.setItem(DEVICE_MODE_STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent("merchant-device-mode-change", { detail: { mode } }));
  }

  return (
    <section aria-labelledby="device-mode-title" className="grid gap-6">
      <div className="grid gap-3">
        <p className="text-caption-xs uppercase text-primary">Merchant PWA</p>
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="text-title" id="device-mode-title">
              Device Mode
            </h1>
            <p className="mt-2 max-w-3xl text-body text-foreground-secondary">
              Mode perangkat menentukan surface awal PWA pada perangkat ini. Hak akses tetap
              mengikuti sesi server saat pengguna masuk.
            </p>
          </div>
          <StatusBar label="Mode aktif" tone="info">
            {selectedDevice.label}
          </StatusBar>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {deviceModes.map((item) => {
          const selected = item.mode === selectedMode;
          return (
            <article
              aria-current={selected ? "true" : undefined}
              className={[
                "grid min-h-[220px] gap-4 rounded-lg border bg-surface p-5",
                selected ? "border-primary shadow-sm" : "border-line-default",
              ].join(" ")}
              key={item.mode}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-md border border-line-default bg-primary-subtle p-3 text-primary">
                  <AppIcon icon={item.icon} label={item.label} size="lg" />
                </span>
                {selected ? <Badge tone="success">Aktif</Badge> : null}
              </div>
              <div>
                <h2 className="text-heading-sm">{item.label}</h2>
                <p className="mt-2 text-body-sm text-foreground-secondary">{item.description}</p>
                <p className="mt-3 text-caption text-foreground-muted">{item.surface}</p>
              </div>
              <Button
                fullWidth
                onClick={() => selectMode(item.mode)}
                size="sm"
                type="button"
                variant={selected ? "primary" : "secondary"}
              >
                {selected ? "Mode dipilih" : `Pilih ${item.label}`}
              </Button>
            </article>
          );
        })}
      </div>

      <section className="grid gap-4 rounded-lg border border-line-default bg-surface-subtle p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-caption text-foreground-muted">Landing surface</p>
          <h2 className="mt-1 text-heading-sm">{selectedDevice.surface}</h2>
          <p className="mt-2 text-body-sm text-foreground-secondary">
            Preferensi ini tersimpan lokal di perangkat. Operasi order, pembayaran, stok, approval,
            dan shift closing tetap membutuhkan konfirmasi server.
          </p>
        </div>
        <a className="ui-button ui-button--md ui-button--primary" href={selectedDevice.href}>
          <span className="ui-button__label">Buka surface</span>
        </a>
      </section>
    </section>
  );
}
