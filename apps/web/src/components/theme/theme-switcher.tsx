"use client";

import { useSyncExternalStore } from "react";

import { useTheme } from "next-themes";

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
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Temporary control
          </p>
          <h2 className="mt-1 text-lg font-semibold" id="development-theme-switcher">
            Development theme switcher
          </h2>
          <p className="mt-1 text-sm text-foreground-secondary">
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
                    ? "rounded-lg border border-primary bg-primary px-3 py-2 text-sm font-semibold text-on-primary"
                    : "rounded-lg border border-line-control bg-surface px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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

      <p aria-live="polite" className="mt-3 text-xs text-foreground-muted">
        {mounted
          ? `Pilihan: ${themeLabels[selectedTheme]}. Tema aktif: ${resolvedTheme ?? "belum terdeteksi"}.`
          : "Menyiapkan preferensi tema..."}
      </p>

      <label className="mt-4 block text-sm font-medium" htmlFor="theme-draft-check">
        Uji draft lokal
      </label>
      <input
        className="mt-2 w-full rounded-lg border border-line-control bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-foreground-muted focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-focus"
        defaultValue="Teks ini tetap ada saat tema diganti"
        id="theme-draft-check"
      />
    </section>
  );
}
