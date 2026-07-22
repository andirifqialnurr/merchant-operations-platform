"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { useTheme } from "next-themes";
import { IconButton } from "@merchant/ui/button";

import { themeOptions, type ThemePreference } from "./theme-contract";

const themeLabels: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

function subscribeToHydration() {
  return () => undefined;
}

function isThemePreference(theme: string | undefined): theme is ThemePreference {
  return themeOptions.some((option) => option === theme);
}

export function ThemeSwitcher() {
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const { resolvedTheme, setTheme, theme } = useTheme();
  const selectedTheme = isThemePreference(theme) ? theme : "system";

  return (
    <section
      aria-labelledby="development-theme-switcher"
      className="rounded-2xl border border-line-default bg-surface p-4"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-caption-xs uppercase text-primary">Temporary control</p>
          <h2 className="mt-1 text-heading" id="development-theme-switcher">
            Development theme switcher
          </h2>
          <p className="mt-1 text-body text-foreground-secondary">
            Preference disimpan lokal sementara; integrasi identity mengikuti contract user/device.
          </p>
        </div>

        <div aria-label="Pilih tema tampilan" className="grid grid-cols-3 gap-1" role="group">
          {themeOptions.map((option) => {
            const isSelected = mounted && selectedTheme === option;

            return (
              <button
                aria-pressed={isSelected}
                className={
                  isSelected
                    ? "rounded-lg border border-primary bg-primary px-3 py-2 text-label text-on-primary"
                    : "rounded-lg border border-line-control bg-surface px-3 py-2 text-label text-foreground hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                }
                disabled={!mounted}
                key={option}
                onClick={() => setTheme(option)}
                type="button"
              >
                {themeLabels[option]}
              </button>
            );
          })}
        </div>
      </div>

      <p aria-live="polite" className="mt-3 text-caption text-foreground-muted">
        {mounted
          ? `Pilihan: ${themeLabels[selectedTheme]}. Tema aktif: ${resolvedTheme ?? "belum terdeteksi"}.`
          : "Menyiapkan preferensi tema..."}
      </p>

      <label className="mt-4 block text-label" htmlFor="theme-draft-check">
        Uji draft lokal
      </label>
      <input
        className="mt-2 w-full rounded-lg border border-line-control bg-surface px-3 py-2 text-body text-foreground outline-none placeholder:text-foreground-muted focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-focus"
        defaultValue="Teks ini tetap ada saat tema diganti"
        id="theme-draft-check"
      />
    </section>
  );
}

const nextTheme: Record<ThemePreference, ThemePreference> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const themeIcons = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} as const;

export function CompactThemeSwitcher() {
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const { setTheme, theme } = useTheme();
  const selectedTheme = mounted && isThemePreference(theme) ? theme : "system";
  const label = `Tema ${themeLabels[selectedTheme]}. Ubah tema`;

  return (
    <IconButton
      disabled={!mounted}
      icon={themeIcons[selectedTheme]}
      label={label}
      onClick={() => setTheme(nextTheme[selectedTheme])}
      size="sm"
      tooltip={label}
    />
  );
}
