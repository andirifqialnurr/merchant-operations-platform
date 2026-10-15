"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { merchantApi } from "@/lib/api-client";
import { useErrorMessage } from "@/lib/i18n";
import { useToast } from "@/providers/toast-provider";
import { isLimitReached } from "@/shell/limit-reached-state";

/** Keys carry the workspace and outlet: one outlet's floors are never another's. */
export const floorKeys = {
  floors: (tenantId: string, outletId: string) => ["floor", tenantId, outletId, "floors"] as const,
};

/** The outlet's floors with their areas, active or not, in display order. */
export function useFloors(tenantId: string, outletId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: () => merchantApi.floors(tenantId, outletId),
    queryKey: floorKeys.floors(tenantId, outletId),
  });
}

/**
 * Runs one write on the floors or areas, then reads them and the usage they
 * count against again. A full limit is explained where it was hit instead.
 */
export function useFloorMutation(tenantId: string, outletId: string) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const errorMessage = useErrorMessage();
  return useMutation({
    mutationFn: ({ action }: { action: () => Promise<unknown>; success?: string }) => action(),
    onError: (error) => {
      if (isLimitReached(error)) return;
      notify({ message: errorMessage(error), tone: "danger" });
    },
    onSuccess: async (_result, { success }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: floorKeys.floors(tenantId, outletId) }),
        queryClient.invalidateQueries({ queryKey: ["subscription", tenantId] }),
      ]);
      if (success) notify({ message: success, tone: "success" });
    },
  });
}

export type FloorMutation = ReturnType<typeof useFloorMutation>;
