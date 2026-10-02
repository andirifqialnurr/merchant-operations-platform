"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import type { CatalogSnapshot } from "@merchant/contracts";
import { DataTable, Panel } from "@merchant/ui/data-display";
import { EmptyState } from "@merchant/ui/feedback";
import { FilterBar } from "@merchant/ui/page";
import { Select } from "@merchant/ui/select";

import { useFormat } from "@/lib/i18n";

import type { CatalogMutation } from "./api";
import { ProductSheet } from "./product-sheet";
import {
  ProductStatusBadge,
  type ProductStatusFilter,
  productStatusOf,
  useProductStatusLabel,
} from "./status";

const ALL = "ALL";
const statusFilters: readonly ProductStatusFilter[] = ["ACTIVE", "SOLD_OUT", "INACTIVE"];

type Props = {
  canManage: boolean;
  mutation: CatalogMutation;
  onSelect: (id: string | undefined) => void;
  outlet: { id: string; name: string } | undefined;
  /** Product id, "new", or undefined when no sheet is open. */
  selectedId: string | undefined;
  snapshot: CatalogSnapshot;
  tenantId: string;
};

export function ProductsView({
  canManage,
  mutation,
  onSelect,
  outlet,
  selectedId,
  snapshot,
  tenantId,
}: Readonly<Props>) {
  const t = useTranslations("catalog");
  const { money } = useFormat();
  const statusLabel = useProductStatusLabel();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [categoryId, setCategoryId] = useState<string>(ALL);

  const categoryNames = useMemo(
    () => new Map(snapshot.categories.map((item) => [item.id, item.name])),
    [snapshot.categories],
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return snapshot.products.filter(
      (item) =>
        (!needle || item.name.toLowerCase().includes(needle)) &&
        (status === ALL || productStatusOf(item.status, item.availability) === status) &&
        (categoryId === ALL || item.categoryId === categoryId),
    );
  }, [categoryId, query, snapshot.products, status]);

  const chips = [
    ...(status === ALL
      ? []
      : [
          {
            key: "status",
            label: t("filterValue", {
              name: t("status"),
              value: statusLabel(status as ProductStatusFilter),
            }),
            onRemove: () => setStatus(ALL),
          },
        ]),
    ...(categoryId === ALL
      ? []
      : [
          {
            key: "category",
            label: t("filterValue", {
              name: t("category"),
              value: categoryNames.get(categoryId) ?? "",
            }),
            onRemove: () => setCategoryId(ALL),
          },
        ]),
  ].map((chip) => ({ ...chip, removeLabel: t("removeFilter", { filter: chip.label }) }));

  const selected = snapshot.products.find((item) => item.id === selectedId);
  const sheetOpen = selectedId === "new" ? canManage : Boolean(selected);

  return (
    <>
      <FilterBar
        chips={chips}
        filtersLabel={t("filters")}
        onReset={() => {
          setStatus(ALL);
          setCategoryId(ALL);
        }}
        resetLabel={t("reset")}
        search={{
          clearLabel: t("clearSearch"),
          label: t("searchProducts"),
          onChange: setQuery,
          placeholder: t("searchProducts"),
          value: query,
        }}
        sheetCloseLabel={t("closeFilters")}
        sheetDoneLabel={t("showResults")}
      >
        <Select
          label={t("status")}
          onValueChange={setStatus}
          options={[
            { label: t("filterValue", { name: t("status"), value: t("filterAll") }), value: ALL },
            ...statusFilters.map((value) => ({ label: statusLabel(value), value })),
          ]}
          value={status}
        />
        <Select
          label={t("category")}
          onValueChange={setCategoryId}
          options={[
            { label: t("filterValue", { name: t("category"), value: t("filterAll") }), value: ALL },
            ...snapshot.categories.map((item) => ({ label: item.name, value: item.id })),
          ]}
          value={categoryId}
        />
      </FilterBar>
      <Panel>
        <DataTable
          caption={t("products")}
          columns={[
            t("product"),
            { label: t("category"), priority: 2 },
            t("status"),
            { align: "end", label: t("price") },
          ]}
          empty={
            <EmptyState
              description={snapshot.products.length ? t("emptySearch") : t("emptyProducts")}
              title={t("products")}
            />
          }
          onRowSelect={(index) => onSelect(visible[index]?.id)}
          rows={visible.map((item) => [
            item.name,
            categoryNames.get(item.categoryId) ?? "",
            <ProductStatusBadge
              key="status"
              status={productStatusOf(item.status, item.availability)}
            />,
            money(item.basePriceMinor, item.currency),
          ])}
        />
      </Panel>
      {sheetOpen ? (
        <ProductSheet
          canManage={canManage}
          key={selected?.id ?? "new"}
          mutation={mutation}
          onClose={() => onSelect(undefined)}
          outlet={outlet}
          product={selected}
          snapshot={snapshot}
          tenantId={tenantId}
        />
      ) : null}
    </>
  );
}
