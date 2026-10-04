"use client";

import { useQuery } from "@tanstack/react-query";
import {
  IconCashRegister,
  IconPackage,
  IconReceipt2,
  IconSquareRoundedLetterM,
} from "@tabler/icons-react";

import type { ModuleKey } from "@merchant/contracts";
import type { AppIconComponent } from "@merchant/ui/app-icon";

import { merchantApi } from "@/lib/api-client";

export const navigationKey = (tenantId: string) => ["modules", "navigation", tenantId] as const;

/**
 * The menu the API allows this user in this workspace: modules that are part
 * of the subscription, installed, and within the user's permissions.
 */
export function useModuleNavigation(tenantId: string) {
  return useQuery({
    queryFn: () => merchantApi.navigation(tenantId),
    queryKey: navigationKey(tenantId),
    staleTime: 60_000,
  });
}

/** Modules whose menu entry the web app can name and draw. */
export const MODULE_NAVIGATION = {
  CORE_CATALOG: { icon: IconPackage, labelKey: "moduleNav.CORE_CATALOG" },
  // Belongs to the whole business: only shown to people assigned to every outlet.
  CORE_SUBSCRIPTION: {
    icon: IconReceipt2,
    labelKey: "moduleNav.CORE_SUBSCRIPTION",
    wholeBusiness: true,
  },
  POS: { icon: IconCashRegister, labelKey: "moduleNav.POS" },
} as const satisfies Partial<
  Record<ModuleKey, { icon: AppIconComponent; labelKey: string; wholeBusiness?: boolean }>
>;

export type NavigableModule = keyof typeof MODULE_NAVIGATION;

export function isNavigableModule(moduleKey: ModuleKey): moduleKey is NavigableModule {
  return moduleKey in MODULE_NAVIGATION;
}

/** Settings come after the modules people work in every day. */
export function isSettingsPath(path: string) {
  return path === "/settings" || path.startsWith("/settings/");
}

/**
 * The order and the entries of the sidebar: daily modules first, settings
 * last, and entries about the whole business only for people assigned to
 * every outlet.
 */
export function arrangeNavigation<T extends { moduleKey: ModuleKey; path: string }>(
  entries: readonly T[],
  allOutlets: boolean,
): T[] {
  const visible = entries.filter((entry) => {
    if (!isNavigableModule(entry.moduleKey)) return true;
    const known = MODULE_NAVIGATION[entry.moduleKey];
    return allOutlets || !("wholeBusiness" in known && known.wholeBusiness);
  });
  return [
    ...visible.filter((entry) => !isSettingsPath(entry.path)),
    ...visible.filter((entry) => isSettingsPath(entry.path)),
  ];
}

/** Shown for a module the API lists but this build of the web app does not know yet. */
export const UNKNOWN_MODULE_ICON: AppIconComponent = IconSquareRoundedLetterM;
