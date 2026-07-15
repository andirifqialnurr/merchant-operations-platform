"use client";

import type { ReactNode } from "react";

import { ThemeProvider as NextThemesProvider } from "next-themes";

import { themeOptions, themeStorageKey } from "./theme-contract";

export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableColorScheme
      enableSystem
      storageKey={themeStorageKey}
      themes={themeOptions.filter((theme) => theme !== "system")}
    >
      {children}
    </NextThemesProvider>
  );
}
