import type { CatalogRecordStatus } from "@merchant/contracts";
import { Badge } from "@merchant/ui/feedback";

import { catalogMessages as t } from "./messages";

export type ProductStatusFilter = "ACTIVE" | "SOLD_OUT" | "INACTIVE";

/** One status per product: inactive wins over sold out, sold out over active. */
export function productStatusOf(
  status: CatalogRecordStatus,
  availability: "AVAILABLE" | "SOLD_OUT",
): ProductStatusFilter {
  if (status === "INACTIVE") return "INACTIVE";
  return availability === "SOLD_OUT" ? "SOLD_OUT" : "ACTIVE";
}

const labels: Record<ProductStatusFilter, string> = {
  ACTIVE: t.statusActive,
  INACTIVE: t.statusInactive,
  SOLD_OUT: t.soldOut,
};
const tones = { ACTIVE: "success", INACTIVE: "neutral", SOLD_OUT: "warning" } as const;

export function productStatusLabel(status: ProductStatusFilter) {
  return labels[status];
}

export function ProductStatusBadge({ status }: Readonly<{ status: ProductStatusFilter }>) {
  return <Badge tone={tones[status]}>{labels[status]}</Badge>;
}

export function RecordStatusBadge({ status }: Readonly<{ status: CatalogRecordStatus }>) {
  return (
    <Badge tone={status === "ACTIVE" ? "success" : "neutral"}>
      {status === "ACTIVE" ? t.statusActive : t.statusInactive}
    </Badge>
  );
}
