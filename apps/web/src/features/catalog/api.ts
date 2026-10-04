"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { merchantApi } from "@/lib/api-client";
import { useErrorMessage } from "@/lib/i18n";
import { useToast } from "@/providers/toast-provider";
import { isLimitReached } from "@/shell/limit-reached-state";

/** Every key carries the workspace so one workspace never reads another's cache. */
export const catalogKeys = {
  all: (tenantId: string) => ["catalog", tenantId] as const,
  master: (tenantId: string) => ["catalog", tenantId, "master"] as const,
  outlet: (tenantId: string, outletId: string) =>
    ["catalog", tenantId, "outlet", outletId] as const,
};

/** The full catalog; only readable by members with access to all outlets. */
export function useCatalog(tenantId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: () => merchantApi.catalog(tenantId),
    queryKey: catalogKeys.master(tenantId),
  });
}

export function useOutletCatalog(tenantId: string, outletId: string | undefined) {
  return useQuery({
    enabled: Boolean(outletId),
    queryFn: () => merchantApi.outletCatalog(tenantId, outletId ?? ""),
    queryKey: catalogKeys.outlet(tenantId, outletId ?? ""),
  });
}

/**
 * Runs one catalog write, then refetches the workspace's catalog. No optimistic
 * update: the screen only changes after the server confirms.
 */
export function useCatalogMutation(tenantId: string) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const errorMessage = useErrorMessage();
  return useMutation({
    mutationFn: ({ action }: { action: () => Promise<unknown>; success: string }) => action(),
    onError: (error) => {
      // A full limit is explained where the person tried to add, with what to do next.
      if (isLimitReached(error)) return;
      notify({ message: errorMessage(error), tone: "danger" });
    },
    onSuccess: async (_result, { success }) => {
      await queryClient.invalidateQueries({ queryKey: catalogKeys.all(tenantId) });
      notify({ message: success, tone: "success" });
    },
  });
}

export type CatalogMutation = ReturnType<typeof useCatalogMutation>;
