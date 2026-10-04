"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { PERMISSIONS, limitDimensionKeySchema, usageQuantitySchema } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { UsageLimitState } from "@merchant/ui/usage-limit-state";

import { useWorkspace } from "@/features/workspace";
import { ApiClientError } from "@/lib/api-client";

import { useUsageMeterLabels } from "./usage-labels";

/** True when the API refused to create something because the package's limit is full. */
export function isLimitReached(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError && error.code === "LIMIT_REACHED";
}

/**
 * Shown where something new could not be created because the package's limit
 * is full. People who may see the subscription get the numbers and a way to
 * it; everyone else is told to ask the owner.
 */
export function LimitReachedState({ error }: Readonly<{ error: ApiClientError }>) {
  const t = useTranslations("usage");
  const router = useRouter();
  const { can, workspace } = useWorkspace();
  const meterProps = useUsageMeterLabels();
  const seesBilling = can(PERMISSIONS.organizationRead) && workspace.allOutlets;

  const dimensionKey = limitDimensionKeySchema.safeParse(error.details?.dimensionKey);
  const limit = usageQuantitySchema.safeParse(error.details?.limit);
  const usage = usageQuantitySchema.safeParse(error.details?.usage);
  const meter =
    seesBilling && dimensionKey.success && limit.success && usage.success
      ? meterProps({
          dimensionKey: dimensionKey.data,
          enforcement: "HARD_COUNT",
          limit: limit.data,
          periodEnd: null,
          periodStart: null,
          state: "REACHED",
          unit: "count",
          unlimited: false,
          used: usage.data,
        })
      : undefined;

  return (
    <UsageLimitState
      {...(seesBilling
        ? {
            action: (
              <Button onClick={() => router.push("/settings/subscription")} variant="secondary">
                {t("viewSubscription")}
              </Button>
            ),
          }
        : {})}
      description={seesBilling ? t("limitReached") : t("limitReachedAskOwner")}
      {...(meter ? { meter } : {})}
      title={t("limitReachedTitle")}
    />
  );
}
