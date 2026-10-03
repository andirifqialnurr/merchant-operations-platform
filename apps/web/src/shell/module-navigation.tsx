"use client";

import { useQuery } from "@tanstack/react-query";
import { IconCashRegister, IconPackage, IconSquareRoundedLetterM } from "@tabler/icons-react";

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
  POS: { icon: IconCashRegister, labelKey: "moduleNav.POS" },
} as const satisfies Partial<Record<ModuleKey, { icon: AppIconComponent; labelKey: string }>>;

export type NavigableModule = keyof typeof MODULE_NAVIGATION;

export function isNavigableModule(moduleKey: ModuleKey): moduleKey is NavigableModule {
  return moduleKey in MODULE_NAVIGATION;
}

/** Shown for a module the API lists but this build of the web app does not know yet. */
export const UNKNOWN_MODULE_ICON: AppIconComponent = IconSquareRoundedLetterM;
