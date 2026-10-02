"use client";

import { useTranslations } from "next-intl";
import type { CatalogOutletSnapshot } from "@merchant/contracts";
import { DataTable, Panel } from "@merchant/ui/data-display";
import { EmptyState } from "@merchant/ui/feedback";
import { Sheet } from "@merchant/ui/overlay";
import { Switch } from "@merchant/ui/selection-control";

import { merchantApi } from "@/lib/api-client";
import { useFormat } from "@/lib/i18n";

import type { CatalogMutation } from "./api";
import { ProductStatusBadge, productStatusOf } from "./status";

type Props = {
  canManage: boolean;
  mutation: CatalogMutation;
  onSelect: (id: string | undefined) => void;
  outletId: string;
  selectedId: string | undefined;
  snapshot: CatalogOutletSnapshot;
  tenantId: string;
};

/**
 * Catalog for members scoped to specific outlets. They see what their outlet
 * sells at its effective price and can only mark items sold out.
 */
export function OutletProductsView({
  canManage,
  mutation,
  onSelect,
  outletId,
  selectedId,
  snapshot,
  tenantId,
}: Readonly<Props>) {
  const t = useTranslations("catalog");
  const { money } = useFormat();
  const items = snapshot.items;
  const selected = items.find((item) => item.assignment.id === selectedId);

  return (
    <>
      <Panel>
        <DataTable
          caption={t("products")}
          columns={[t("product"), t("status"), { align: "end", label: t("price") }]}
          empty={<EmptyState description={t("emptyProducts")} title={t("products")} />}
          {...(canManage
            ? { onRowSelect: (index: number) => onSelect(items[index]?.assignment.id) }
            : {})}
          rows={items.map((item) => [
            item.product.name,
            <ProductStatusBadge
              key="status"
              status={productStatusOf(item.assignment.status, item.effectiveAvailability)}
            />,
            money(item.effectivePriceMinor, item.product.currency),
          ])}
        />
      </Panel>
      {selected && canManage ? (
        <Sheet
          closeLabel={t("closeSheet")}
          onOpenChange={(open) => {
            if (!open) onSelect(undefined);
          }}
          open
          size="sm"
          title={selected.product.name}
        >
          <Switch
            checked={selected.assignment.availabilityOverride === "SOLD_OUT"}
            disabled={mutation.isPending}
            label={t("outletSoldOut")}
            onChange={() =>
              mutation.mutate({
                action: () =>
                  merchantApi.updateOutletProduct(tenantId, outletId, selected.assignment.id, {
                    availabilityOverride:
                      selected.assignment.availabilityOverride === "SOLD_OUT" ? null : "SOLD_OUT",
                  }),
                success: t("outletUpdated"),
              })
            }
          />
        </Sheet>
      ) : null}
    </>
  );
}
