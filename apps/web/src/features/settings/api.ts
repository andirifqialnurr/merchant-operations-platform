"use client";

import { useQuery } from "@tanstack/react-query";

import { merchantApi } from "@/lib/api-client";

/** Every key carries the workspace so one workspace never reads another's cache. */
export const subscriptionKey = (tenantId: string) => ["subscription", tenantId] as const;

/** The workspace's package, its modules with tiers, and usage against limits. */
export function useSubscriptionOverview(tenantId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: () => merchantApi.subscription(tenantId),
    queryKey: subscriptionKey(tenantId),
  });
}
