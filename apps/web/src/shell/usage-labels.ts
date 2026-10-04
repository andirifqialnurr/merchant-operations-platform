"use client";

import { useTranslations } from "next-intl";

import type { UsageMeter } from "@merchant/contracts";
import type { UsageMeterProps } from "@merchant/ui/usage-limit-state";

import { useFormat } from "@/lib/i18n";

/** The dictionary key of the words for how full a dimension is, if it needs any. */
export function usageLevelKey(used: number, limit: number | null) {
  if (limit === null) return undefined;
  if (used > limit) return "over";
  if (used === limit) return "reached";
  const percent = limit <= 0 ? 100 : (used / limit) * 100;
  if (percent >= 90) return "almost";
  return percent >= 80 ? "near" : undefined;
}

/**
 * Turns a usage meter from the API into the texts `UsageMeter` shows: the
 * dimension's name, "40 of 50", the level in words, and the reset date for
 * dimensions that start again each billing cycle.
 */
export function useUsageMeterLabels() {
  const t = useTranslations("usage");
  const { date, number } = useFormat();

  return (meter: UsageMeter): UsageMeterProps => {
    const used = Number(meter.used);
    const limit = meter.limit === null ? null : Number(meter.limit);
    const level = usageLevelKey(used, limit);
    const dimensionKey = `dimensions.${meter.dimensionKey}`;
    return {
      // A dimension this build cannot name yet is shown by its key rather than hidden.
      label: t.has(dimensionKey as never) ? t(dimensionKey as never) : meter.dimensionKey,
      ...(level ? { levelLabel: t(`level.${level}`) } : {}),
      limit,
      ...(meter.periodEnd ? { note: t("resetsOn", { date: date(meter.periodEnd) }) } : {}),
      used,
      valueLabel:
        limit === null
          ? t("valueUnlimited", { used: number(used) })
          : t("valueOf", { limit: number(limit), used: number(used) }),
    };
  };
}
