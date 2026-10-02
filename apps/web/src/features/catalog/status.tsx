"use client";

import { useTranslations } from "next-intl";

import type { CatalogRecordStatus } from "@merchant/contracts";
import { Badge } from "@merchant/ui/feedback";

export type ProductStatusFilter = "ACTIVE" | "SOLD_OUT" | "INACTIVE";

/** One status per product: inactive wins over sold out, sold out over active. */
export function productStatusOf(
  status: CatalogRecordStatus,
  availability: "AVAILABLE" | "SOLD_OUT",
): ProductStatusFilter {
  if (status === "INACTIVE") return "INACTIVE";
  return availability === "SOLD_OUT" ? "SOLD_OUT" : "ACTIVE";
}

const labelKeys = {
  ACTIVE: "statusActive",
  INACTIVE: "statusInactive",
  SOLD_OUT: "soldOut",
} as const;
const tones = { ACTIVE: "success", INACTIVE: "neutral", SOLD_OUT: "warning" } as const;

/** Returns a translator from a product status to its label in the active language. */
export function useProductStatusLabel() {
  const t = useTranslations("catalog");
  return (status: ProductStatusFilter) => t(labelKeys[status]);
}

export function ProductStatusBadge({ status }: Readonly<{ status: ProductStatusFilter }>) {
  const label = useProductStatusLabel();
  return <Badge tone={tones[status]}>{label(status)}</Badge>;
}

export function RecordStatusBadge({ status }: Readonly<{ status: CatalogRecordStatus }>) {
  const t = useTranslations("catalog");
  return (
    <Badge tone={status === "ACTIVE" ? "success" : "neutral"}>
      {status === "ACTIVE" ? t("statusActive") : t("statusInactive")}
    </Badge>
  );
}
