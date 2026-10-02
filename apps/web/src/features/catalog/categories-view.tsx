"use client";

import { type FormEvent, useState } from "react";

import type { CatalogCategory, CatalogSnapshot } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { DataTable, Panel } from "@merchant/ui/data-display";
import { EmptyState } from "@merchant/ui/feedback";
import { FormField, Input } from "@merchant/ui/form-field";
import { NumericInput } from "@merchant/ui/numeric-date";
import { Sheet } from "@merchant/ui/overlay";

import { merchantApi, nextCatalogStatus } from "@/lib/api-client";
import { slugify } from "@/lib/format";

import type { CatalogMutation } from "./api";
import { catalogMessages as t } from "./messages";
import { RecordStatusBadge } from "./status";

type Props = {
  canManage: boolean;
  mutation: CatalogMutation;
  onSelect: (id: string | undefined) => void;
  selectedId: string | undefined;
  snapshot: CatalogSnapshot;
  tenantId: string;
};

function CategorySheet({
  category,
  mutation,
  nextOrder,
  onClose,
  tenantId,
}: Readonly<{
  category: CatalogCategory | undefined;
  mutation: CatalogMutation;
  nextOrder: number;
  onClose: () => void;
  tenantId: string;
}>) {
  const [name, setName] = useState(category?.name ?? "");
  const [order, setOrder] = useState(String(category?.displayOrder ?? nextOrder));
  const [error, setError] = useState<string>();
  const busy = mutation.isPending;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError(t.nameRequired);
      return;
    }
    const fields = { displayOrder: Number(order) || 0, name: name.trim() };
    mutation.mutate(
      category
        ? {
            action: () => merchantApi.updateCategory(tenantId, category.id, fields),
            success: t.categoryUpdated,
          }
        : {
            action: () =>
              merchantApi.createCategory(tenantId, { ...fields, slug: slugify(fields.name) }),
            success: t.categoryCreated,
          },
      { onSuccess: onClose },
    );
  }

  return (
    <Sheet
      closeLabel={t.closeSheet}
      footer={
        <>
          {category ? (
            <Button
              disabled={busy}
              onClick={() =>
                mutation.mutate(
                  {
                    action: () =>
                      merchantApi.updateCategory(tenantId, category.id, {
                        status: nextCatalogStatus(category.status),
                      }),
                    success: t.categoryUpdated,
                  },
                  { onSuccess: onClose },
                )
              }
              variant="secondary"
            >
              {category.status === "ACTIVE" ? t.deactivate : t.activate}
            </Button>
          ) : null}
          <Button form="category-form" loading={busy} loadingLabel={t.saving} type="submit">
            {t.save}
          </Button>
        </>
      }
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      size="sm"
      title={category?.name ?? t.newCategory}
    >
      <form className="grid gap-4" id="category-form" noValidate onSubmit={submit}>
        <FormField {...(error ? { error } : {})} htmlFor="category-name" label={t.categoryName}>
          <Input
            id="category-name"
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </FormField>
        <FormField htmlFor="category-order" label={t.categoryOrder}>
          <NumericInput id="category-order" onValueChange={setOrder} value={order} />
        </FormField>
      </form>
    </Sheet>
  );
}

export function CategoriesView({
  canManage,
  mutation,
  onSelect,
  selectedId,
  snapshot,
  tenantId,
}: Readonly<Props>) {
  const categories = [...snapshot.categories].sort((a, b) => a.displayOrder - b.displayOrder);
  const selected = categories.find((item) => item.id === selectedId);
  const sheetOpen = canManage && (selectedId === "new" || Boolean(selected));

  return (
    <>
      <Panel>
        <DataTable
          caption={t.category}
          columns={[t.category, { align: "end", label: t.products }, t.status]}
          empty={<EmptyState description={t.emptyCategories} title={t.category} />}
          {...(canManage
            ? { onRowSelect: (index: number) => onSelect(categories[index]?.id) }
            : {})}
          rows={categories.map((item) => [
            item.name,
            snapshot.products.filter((product) => product.categoryId === item.id).length,
            <RecordStatusBadge key="status" status={item.status} />,
          ])}
        />
      </Panel>
      {sheetOpen ? (
        <CategorySheet
          category={selected}
          key={selected?.id ?? "new"}
          mutation={mutation}
          nextOrder={categories.length}
          onClose={() => onSelect(undefined)}
          tenantId={tenantId}
        />
      ) : null}
    </>
  );
}
